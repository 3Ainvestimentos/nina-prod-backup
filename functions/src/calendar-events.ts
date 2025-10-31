
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

const db = admin.firestore();

// --- Configuração do OAuth2 Client ---
const GOOGLE_CLIENT_ID = functions.config().google?.client_id;
const GOOGLE_CLIENT_SECRET = functions.config().google?.client_secret;
const REDIRECT_URL = `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/googleAuthCallback`;

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URL
);

// --- Interfaces ---
interface InteractionData {
    type?: string;
    nextInteractionDate?: string; // ISO String
}

interface EmployeeData {
    name?: string;
    email?: string;
    leaderId?: string;
}

interface LeaderData {
    name?: string;
    email?: string;
    googleAuth?: {
        refreshToken?: string;
    };
}


/**
 * Cria um evento no Google Calendar quando uma interação N3 Individual é registrada.
 * @param {InteractionData} interactionData - Os dados da nova interação.
 * @param {string} employeeId - O ID do funcionário que recebeu a interação.
 */
export async function createCalendarEvent(interactionData: InteractionData, employeeId: string) {
    // 1. Validação inicial: só prosseguir para N3 Individual com data futura.
    if (interactionData.type !== 'N3 Individual' || !interactionData.nextInteractionDate) {
        functions.logger.log(`[Calendar] Ignorando interação: tipo=${interactionData.type} ou sem data futura.`);
        return;
    }

    const nextDate = new Date(interactionData.nextInteractionDate);
    if (nextDate <= new Date()) {
        functions.logger.log(`[Calendar] Ignorando interação: a data futura (${nextDate.toISOString()}) já passou.`);
        return;
    }

    try {
        // 2. Obter dados do liderado e do líder.
        const employeeSnap = await db.collection('employees').doc(employeeId).get();
        const employee = employeeSnap.data() as EmployeeData | undefined;

        if (!employee || !employee.leaderId) {
            functions.logger.warn(`[Calendar] Funcionário ${employeeId} ou seu líder não foram encontrados.`);
            return;
        }

        const leaderSnap = await db.collection('employees').doc(employee.leaderId).get();
        const leader = leaderSnap.data() as LeaderData | undefined;
        const refreshToken = leader?.googleAuth?.refreshToken;

        if (!leader || !refreshToken) {
            functions.logger.warn(`[Calendar] Líder ${employee.leaderId} não encontrado ou não possui refresh token.`);
            return;
        }

        // 3. Autenticar com a API do Google.
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // 4. Definir os detalhes do evento.
        const event = {
            summary: `N3 Individual: ${leader.name} e ${employee.name}`,
            description: `Reunião de acompanhamento N3 Individual agendada através da plataforma Nina.`,
            start: {
                dateTime: nextDate.toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                // O evento durará 30 minutos por padrão.
                dateTime: new Date(nextDate.getTime() + 30 * 60 * 1000).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            attendees: [
                { email: leader.email },
                { email: employee.email }
            ],
            reminders: {
                useDefault: true,
            },
        };

        // 5. Criar o evento.
        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendNotifications: true, // Envia o convite para os participantes.
        });

        functions.logger.log(`[Calendar] Evento criado com sucesso para o líder ${leader.email} e liderado ${employee.email}.`);

    } catch (error) {
        functions.logger.error(`[Calendar] Falha ao criar evento no calendário para o funcionário ${employeeId}:`, error);
        // Opcional: registrar o erro em um log específico para falhas de integração.
    }
}
