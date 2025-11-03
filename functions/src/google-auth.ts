import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import cors from "cors"; // ✅ default import

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

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URL
);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
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
        res.status(400).json({ error: "O UID do usuário é obrigatório." });
        return;
      }

      try {
        // Tenta obter o e-mail do usuário para melhorar UX (login_hint) e restringir domínio (hd)
        let loginHint: string | undefined;
        let hostedDomain: string | undefined;
        try {
          const user = await admin.auth().getUser(uid);
          loginHint = user.email || undefined;
          if (loginHint && loginHint.includes("@")) {
            hostedDomain = loginHint.split("@")[1];
          }
        } catch (_e) {
          // ignora
        }

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          state: uid,
          prompt: "consent",
          include_granted_scopes: true as any,
          login_hint: loginHint,
          hd: hostedDomain,
        });
        res.status(200).json({ authUrl });
      } catch (error) {
        console.error("Erro ao gerar a URL de autenticação:", error);
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

      if (!code || !uid) {
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
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

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
                    document.body.innerHTML = '<p>Você pode fechar esta janela agora.</p>';
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
          console.log(`Sem refresh_token para ${uid} (provável consent prévio).`);
          res.send(successHtml);
          return;
        }

        // Define o payload a ser salvo
        const payload = {
          googleAuth: {
            refreshToken,
            scope: tokens.scope,
            tokenType: tokens.token_type,
            expiryDate: tokens.expiry_date,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        } as const;

        // Tenta identificar o funcionário pelo e-mail do Google (mais estável que UID)
        let updatedAnyDoc = false;
        try {
          oauth2Client.setCredentials(tokens);
          const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
          const { data } = await oauth2.userinfo.get();
          const email = data?.email;

          if (email) {
            const snaps = await db
              .collection("employees")
              .where("email", "==", email)
              .get();

            if (!snaps.empty) {
              await Promise.all(
                snaps.docs.map((doc) =>
                  db.collection("employees").doc(doc.id).set(payload, { merge: true })
                )
              );
              updatedAnyDoc = true;
            }
          }
        } catch (e) {
          console.log("[GoogleAuth] Falha ao obter userinfo para mapear por e-mail:", e);
        }

        // Fallback: se não encontrou pelo e-mail, grava no doc com o UID
        if (!updatedAnyDoc) {
          await db.collection("employees").doc(uid).set(payload, { merge: true });
        }

        res.status(200).send(successHtml);
      } catch (error) {
        console.error("Erro no callback de autenticação do Google:", error);
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
