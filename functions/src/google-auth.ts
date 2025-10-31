
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ATENÇÃO: Estas credenciais devem ser configuradas no ambiente do Firebase.
// `firebase functions:config:set google.client_id="SEU_CLIENT_ID"`
// `firebase functions:config:set google.client_secret="SEU_CLIENT_SECRET"`
const GOOGLE_CLIENT_ID = functions.config().google?.client_id;
const GOOGLE_CLIENT_SECRET = functions.config().google?.client_secret;

// O URL para onde o Google redirecionará após a autorização.
// Deve corresponder exatamente ao URI de redirecionamento autorizado no Google Cloud Console.
const REDIRECT_URL = `https://${process.env.GCLOUD_PROJECT}-uc.a.run.app/googleAuthCallback`;

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URL
);

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events', // Permissão para criar/editar eventos
    'https://www.googleapis.com/auth/userinfo.email', // Obter o e-mail para verificação
];

/**
 * Inicia o fluxo de autorização OAuth2 para o Google Calendar.
 * Retorna a URL de autorização para o cliente redirecionar o usuário.
 */
export const googleAuthInit = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'O usuário precisa estar autenticado.');
    }

    const uid = context.auth.uid;
    
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Necessário para obter um refresh token
        scope: SCOPES,
        state: uid, // Passa o UID do usuário para identificar no callback
        prompt: 'consent' // Garante que o refresh token seja sempre fornecido
    });

    return { authUrl };
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
            // Isso pode acontecer se o usuário já autorizou o app e não revogou o acesso.
            // O 'prompt: consent' na URL de autorização ajuda a mitigar isso.
            throw new Error('Refresh token não recebido do Google. O usuário pode já ter autorizado o app.');
        }

        // Armazena o refresh token de forma segura no documento do funcionário
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

        // Redireciona o usuário de volta para uma página de sucesso no app
        res.redirect('/dashboard/admin?auth=success');

    } catch (error) {
        console.error('Erro no callback de autenticação do Google:', error);
        res.status(500).send('Ocorreu um erro ao autorizar com o Google Calendar.');
    }
});
