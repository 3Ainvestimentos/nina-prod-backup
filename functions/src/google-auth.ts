// functions/src/google-auth.ts
import * as functions from "firebase-functions/v1";
import { auth, db, FieldValue } from "./admin-app";
import { google } from "googleapis";
import cors from "cors";
import { encrypt, markAsEncrypted } from "./kms-utils";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";
const corsHandler = cors({ origin: true });

// Usar process.env para compatibilidade com firebase-functions v7
// As variáveis são definidas via firebase functions:config:set ou secrets
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.google_client_id;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.google_client_secret;
const REDIRECT_URL = `https://${REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/googleAuthCallback`;

export const getOAuth2Client = () => {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URL);
};

const oauth2Client = getOAuth2Client();
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
];

export const googleAuthInit = functions
  .region(REGION)
  .https.onRequest((req, res) => {
    return corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      const uid = (req.query.uid as string) || "";
      if (!uid) {
        res.status(400).json({ error: "O UID do usuário é obrigatório." });
        return;
      }

      try {
        let loginHint: string | undefined;
        let hostedDomain: string | undefined;
        try {
          const user = await auth.getUser(uid);
          loginHint = user.email || undefined;
          if (loginHint && loginHint.includes("@")) {
            hostedDomain = loginHint.split("@")[1];
          }
        } catch (e) {
          console.warn("[GoogleAuthInit] Não foi possível obter email do usuário:", e);
        }

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          state: uid,
          prompt: "consent",
          include_granted_scopes: false,
          login_hint: loginHint,
          hd: hostedDomain,
        });

        res.status(200).json({ authUrl });
      } catch (error) {
        console.error("[GoogleAuthInit] Erro:", error);
        res.status(500).json({ error: "Falha ao gerar URL de autorização." });
      }
    });
  });

export const googleAuthCallback = functions
  .region(REGION)
  .https.onRequest((req, res) => {
    return corsHandler(req, res, async () => {
      const code = req.query.code as string;
      const uid = req.query.state as string;

      if (!code || !uid) {
        res.status(400).send("Código ou UID ausente.");
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
          throw new Error("Não foi possível obter o Refresh Token do Google.");
        }

        const encryptedToken = await encrypt(refreshToken);
        const payload = {
          googleAuth: {
            refreshToken: markAsEncrypted(encryptedToken),
            scope: tokens.scope,
            tokenType: tokens.token_type,
            expiryDate: tokens.expiry_date,
            updatedAt: FieldValue.serverTimestamp(),
            isEncrypted: true,
          },
        };

        await db.collection("employees").doc(uid).set(payload, { merge: true });

        res.status(200).send(`
          <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f7f6;">
              <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #00b894;">Autenticação Concluída!</h1>
                <p>O Google Calendar e Gmail foram autorizados com sucesso.</p>
                <p>Você pode fechar esta janela e voltar ao sistema.</p>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #00b894; color: white; border: none; border-radius: 4px; cursor: pointer;">Fechar Janela</button>
              </div>
            </body>
          </html>
        `);
      } catch (error) {
        console.error("[GoogleAuthCallback] Erro:", error);
        res.status(500).send("Erro ao processar autenticação.");
      }
    });
  });
