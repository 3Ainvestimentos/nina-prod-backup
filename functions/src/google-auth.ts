import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import * as cors from "cors";

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
    withCors((req, res) => {
      const uid = (req.query.uid as string) || "";
      if (!uid) {
        res.status(400).json({ error: "O UID do usuário é obrigatório." });
        return;
      }

      try {
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          state: uid,
          prompt: "consent",
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
  .https.onRequest(async (req, res) => {
    const code = req.query.code as string;
    const uid = req.query.state as string;

    if (!code || !uid) {
      res.status(400).send("Parâmetros inválidos (código ou estado ausente).");
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        // Usuário já concedeu antes; Google pode não enviar novamente
        console.log(`Sem refresh_token para ${uid} (provável consent prévio).`);
        res.send("<script>window.close();</script>");
        return;
      }

      await db
        .collection("employees")
        .doc(uid)
        .set(
          {
            googleAuth: {
              refreshToken,
              scope: tokens.scope,
              tokenType: tokens.token_type,
              expiryDate: tokens.expiry_date,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );

      res.status(200).send("<script>window.close();</script>");
    } catch (error) {
      console.error("Erro no callback de autenticação do Google:", error);
      res
        .status(500)
        .send(
          "Ocorreu um erro ao autorizar com o Google Calendar. Por favor, feche esta janela e tente novamente."
        );
    }
  });
