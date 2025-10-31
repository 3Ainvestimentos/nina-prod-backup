
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as cors from 'cors';

const corsHandler = cors({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const GOOGLE_CLIENT_ID = functions.config().google?.client_id;
const GOOGLE_CLIENT_SECRET = functions.config().google?.client_secret;

const REDIRECT_URL = `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/googleAuthCallback`;

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URL
);

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Inicia o fluxo de autorização OAuth2 para o Google Calendar.
 * Agora é uma função onRequest para controle total sobre CORS.
 */
export const googleAuthInit = functions.https.onRequest((req, res) => {
    corsHandler(req, res, () => {
        const uid = req.query.uid as string;
        if (!uid) {
            res.status(400).json({ error: "O UID do usuário é obrigatório." });
            return;
        }

        try {
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
                state: uid,
                prompt: 'consent'
            });

            res.status(200).json({ authUrl });
        } catch (error) {
            console.error("Erro ao gerar a URL de autenticação:", error);
            res.status(500).json({ error: "Falha ao gerar URL de autorização." });
        }
    });
});


/**
 * Callback da autorização OAuth2 do Google.
 * Recebe o código de autorização, troca por tokens e armazena o refresh token.
 */
export const googleAuthCallback = functions.https.onRequest(async (req, res) => {
    const code = req.query.code as string;
    const uid = req.query.state as string;

    if (!code || !uid) {
        res.status(400).send('Parâmetros inválidos (código ou estado ausente).');
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            // Este cenário pode ocorrer se o usuário já autorizou e o Google não envia um novo refresh token.
            // A interface do usuário deve idealmente já estar atualizada, mas podemos tratar isso graciosamente.
            console.log(`Refresh token não recebido para o usuário ${uid}. O usuário pode já ter autorizado o app.`);
            // Podemos fechar a janela pop-up ou redirecionar com uma mensagem de sucesso, pois a autorização já existe.
            res.send("<script>window.close();</script>");
            return;
        }
        
        const employeeRef = db.collection('employees').doc(uid);
        await employeeRef.set({
            googleAuth: {
                refreshToken: refreshToken,
                scope: tokens.scope,
                tokenType: tokens.token_type,
                expiryDate: tokens.expiry_date,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        // Em vez de redirecionar, enviamos um script para fechar a janela pop-up
        res.status(200).send("<script>window.close();</script>");

    } catch (error) {
        console.error('Erro no callback de autenticação do Google:', error);
        res.status(500).send('Ocorreu um erro ao autorizar com o Google Calendar. Por favor, feche esta janela e tente novamente.');
    }
});
