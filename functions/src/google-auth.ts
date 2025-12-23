import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import cors from "cors"; // ✅ default import
import { encrypt, markAsEncrypted } from "./kms-utils";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

const corsHandler = cors({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const GOOGLE_CLIENT_ID = functions.config().google?.client_id;
const GOOGLE_CLIENT_SECRET = functions.config().google?.client_secret;

// ✅ Redirect URI coerente com a MESMA região (us-central1)
const REDIRECT_URL = `https://${REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/googleAuthCallback`;

export const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URL
  );
};

const oauth2Client = getOAuth2Client();

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
];

// Helper para CORS + pré-flight
function withCors(handler: (req: any, res: any) => void) {
  return (req: any, res: any) =>
    corsHandler(req, res, () => {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      handler(req, res);
    });
}

/**
 * GET /googleAuthInit?uid=XYZ  -> { authUrl }
 */
export const googleAuthInit = functions
  .region(REGION)
  .https.onRequest(
    withCors(async (req, res) => {
      const uid = (req.query.uid as string) || "";
      if (!uid) {
        console.error("[GoogleAuthInit] UID não fornecido");
        res.status(400).json({ error: "O UID do usuário é obrigatório." });
        return;
      }

      try {
        console.log("[GoogleAuthInit] Iniciando autorização para UID:", uid);
        
        // Tenta obter o e-mail do usuário para melhorar UX (login_hint) e restringir domínio (hd)
        let loginHint: string | undefined;
        let hostedDomain: string | undefined;
        try {
          const user = await admin.auth().getUser(uid);
          loginHint = user.email || undefined;
          if (loginHint && loginHint.includes("@")) {
            hostedDomain = loginHint.split("@")[1];
          }
          console.log("[GoogleAuthInit] Usuário encontrado:", { email: loginHint, domain: hostedDomain });
        } catch (e) {
          console.warn("[GoogleAuthInit] Não foi possível obter email do usuário:", e);
        }

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          state: uid,
          prompt: "consent", // Força consent para sempre obter refresh_token e todos os escopos
          include_granted_scopes: false, // Não incluir escopos já concedidos - força pedir todos novamente
          login_hint: loginHint,
          hd: hostedDomain,
        });
        
        console.log("[GoogleAuthInit] URL de autorização gerada com sucesso para:", loginHint || uid);
        res.status(200).json({ authUrl });
      } catch (error) {
        console.error("[GoogleAuthInit] Erro ao gerar a URL de autenticação:", error);
        res.status(500).json({ error: "Falha ao gerar URL de autorização." });
      }
    })
  );

/**
 * GET /googleAuthCallback?code=...&state=uid
 * Troca code->tokens e persiste refresh_token
 */
export const googleAuthCallback = functions
  .region(REGION)
  .https.onRequest(
    withCors(async (req, res) => {
      const code = req.query.code as string;
      const uid = req.query.state as string;

      console.log("[GoogleAuthCallback] Recebido callback - UID:", uid, "Code presente:", !!code);

      if (!code || !uid) {
        console.error("[GoogleAuthCallback] Parâmetros inválidos - code:", !!code, "uid:", !!uid);
        const errorHtml = `
          <!DOCTYPE html>
          <html>
            <head><title>Erro</title></head>
            <body>
              <p>Parâmetros inválidos (código ou estado ausente).</p>
              <script>
                try { window.close(); } catch(e) {}
                setTimeout(() => { try { window.close(); } catch(e) {} }, 1000);
              </script>
            </body>
          </html>
        `;
        res.status(400).send(errorHtml);
        return;
      }

      try {
        console.log("[GoogleAuthCallback] Trocando código por tokens...");
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        console.log("[GoogleAuthCallback] Tokens recebidos:", {
          hasRefreshToken: !!refreshToken,
          hasAccessToken: !!tokens.access_token,
          scope: tokens.scope,
          expiryDate: tokens.expiry_date
        });

        const successHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Autorização Concluída</title>
              <meta charset="utf-8">
            </head>
            <body>
              <p>Autorização concluída com sucesso! Esta janela será fechada automaticamente.</p>
              <script>
                // Tenta fechar imediatamente
                if (window.opener) {
                  try {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                  } catch(e) {}
                }
                
                // Fecha a janela
                setTimeout(() => {
                  try {
                    window.close();
                  } catch(e) {
                    // Se não conseguir fechar (alguns navegadores bloqueiam), mostra mensagem
                    // CORRIGIDO: Usa textContent ao invés de innerHTML para evitar XSS
                    const message = document.createElement('p');
                    message.textContent = 'Você pode fechar esta janela agora.';
                    document.body.appendChild(message);
                  }
                }, 500);
                
                // Fallback: tenta fechar novamente após 1 segundo
                setTimeout(() => {
                  try { window.close(); } catch(e) {}
                }, 1000);
              </script>
            </body>
          </html>
        `;

        if (!refreshToken) {
          console.warn("[GoogleAuthCallback] Sem refresh_token para UID:", uid, "- Isso pode indicar que o usuário já autorizou anteriormente. Tentando usar access_token existente...");
          
          // Mesmo sem refresh_token, tenta salvar o access_token para debug
          const payload = {
            googleAuth: {
              scope: tokens.scope,
              tokenType: tokens.token_type,
              expiryDate: tokens.expiry_date,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              note: "Autorizado sem refresh_token - usuário pode precisar revogar e autorizar novamente"
            },
          } as const;

          try {
            oauth2Client.setCredentials(tokens);
            const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
            const { data } = await oauth2.userinfo.get();
            const email = data?.email;

            if (email) {
              console.log("[GoogleAuthCallback] Email obtido (sem refresh):", email);
              const snaps = await db
                .collection("employees")
                .where("email", "==", email)
                .get();

              if (!snaps.empty) {
                await Promise.all(
                  snaps.docs.map((doc) => {
                    console.log("[GoogleAuthCallback] Atualizando doc (sem refresh) para:", doc.id);
                    return db.collection("employees").doc(doc.id).set(payload, { merge: true });
                  })
                );
              }
            }
          } catch (e) {
            console.error("[GoogleAuthCallback] Erro ao processar sem refresh_token:", e);
          }
          
          res.send(successHtml);
          return;
        }

        // Criptografar o refreshToken antes de salvar
        console.log("[GoogleAuthCallback] Criptografando refresh_token...");
        const encryptedToken = await encrypt(refreshToken);
        console.log("[GoogleAuthCallback] Token criptografado com sucesso");

        // Define o payload a ser salvo (com token criptografado)
        const payload = {
          googleAuth: {
            refreshToken: markAsEncrypted(encryptedToken),
            scope: tokens.scope,
            tokenType: tokens.token_type,
            expiryDate: tokens.expiry_date,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isEncrypted: true, // flag para identificar tokens criptografados
          },
        } as const;

        console.log("[GoogleAuthCallback] Salvando refresh_token criptografado no Firestore...");

        // Tenta identificar o funcionário pelo e-mail do Google (mais estável que UID)
        let updatedAnyDoc = false;
        let userEmail: string | null | undefined;
        
        try {
          oauth2Client.setCredentials(tokens);
          const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
          const { data } = await oauth2.userinfo.get();
          userEmail = data?.email;

          console.log("[GoogleAuthCallback] Email do Google obtido:", userEmail);

          if (userEmail) {
            const snaps = await db
              .collection("employees")
              .where("email", "==", userEmail)
              .get();

            console.log("[GoogleAuthCallback] Documentos encontrados por email:", snaps.size);

            if (!snaps.empty) {
              // Atualiza TODOS os documentos com esse email (caso haja duplicatas)
              await Promise.all(
                snaps.docs.map((doc) => {
                  console.log("[GoogleAuthCallback] Atualizando documento:", doc.id, "para email:", userEmail);
                  return db.collection("employees").doc(doc.id).set(payload, { merge: true });
                })
              );
              updatedAnyDoc = true;
              console.log("[GoogleAuthCallback] ✅ Tokens salvos com sucesso para:", userEmail, "em", snaps.size, "documento(s)");
              
              // Alerta se houver múltiplos documentos
              if (snaps.size > 1) {
                console.warn("[GoogleAuthCallback] ⚠️ ATENÇÃO: Encontrados", snaps.size, "documentos para o mesmo email:", userEmail);
                console.warn("[GoogleAuthCallback] IDs dos documentos:", snaps.docs.map(d => d.id));
              }
            } else {
              console.warn("[GoogleAuthCallback] ⚠️ Nenhum documento encontrado com email:", userEmail);
            }
          }
        } catch (e) {
          console.error("[GoogleAuthCallback] Falha ao obter userinfo para mapear por e-mail:", e);
        }

        // Fallback 1: Tenta pelo UID também (garante que salva em pelo menos um lugar)
        console.log("[GoogleAuthCallback] Salvando também no documento com UID:", uid, "(garantia)");
        try {
          await db.collection("employees").doc(uid).set(payload, { merge: true });
          console.log("[GoogleAuthCallback] ✅ Tokens salvos também no documento UID:", uid);
          updatedAnyDoc = true;
        } catch (e) {
          console.error("[GoogleAuthCallback] Erro ao salvar por UID:", e);
        }

        // Fallback 2: Se ainda não salvou em lugar nenhum, cria um documento de emergência
        if (!updatedAnyDoc) {
          console.error("[GoogleAuthCallback] ❌ ERRO CRÍTICO: Não foi possível salvar tokens em nenhum lugar!");
          console.log("[GoogleAuthCallback] Criando documento de emergência com UID:", uid);
          await db.collection("employees").doc(uid).set({
            ...payload,
            email: userEmail,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            emergencyDoc: true
          }, { merge: true });
          console.log("[GoogleAuthCallback] ✅ Documento de emergência criado");
        }

        res.status(200).send(successHtml);
      } catch (error: any) {
        console.error("[GoogleAuthCallback] ❌ Erro no callback:", {
          message: error?.message,
          code: error?.code,
          stack: error?.stack
        });
        const errorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Erro</title>
              <meta charset="utf-8">
            </head>
            <body>
              <p>Ocorreu um erro ao autorizar com o Google Calendar. Por favor, feche esta janela e tente novamente.</p>
              <script>
                setTimeout(() => {
                  try { window.close(); } catch(e) {}
                }, 3000);
              </script>
            </body>
          </html>
        `;
        res.status(500).send(errorHtml);
      }
    })
  );
