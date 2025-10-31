
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

const db = admin.firestore();

// --- Configuração do OAuth2 Client ---
// Carregados na inicialização da função para evitar recriação a cada chamada
const GOOGLE_CLIENT_ID = functions.config().google?.client_id;
const GOOGLE_CLIENT_SECRET = functions.config().google?.client_secret;
const REDIRECT_URL = `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/googleAuthCallback`;

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
    functions.logger.log(`[Calendar] Função createCalendarEvent acionada para funcionário: ${employeeId}`, { interactionData });

    // 1. Validação inicial: só prosseguir para N3 Individual com data futura.
    if (interactionData.type !== 'N3 Individual' || !interactionData.nextInteractionDate) {
        functions.logger.log(`[Calendar] Ignorando interação: tipo=${interactionData.type || 'N/D'} ou sem data futura.`);
        return; // Termina a execução silenciosamente se não for relevante.
    }

    const nextDate = new Date(interactionData.nextInteractionDate);
    if (nextDate <= new Date()) {
        functions.logger.log(`[Calendar] Ignorando interação: a data futura (${nextDate.toISOString()}) já passou.`);
        return;
    }

    functions.logger.log(`[Calendar] Processando agendamento para funcionário ${employeeId} para data ${nextDate.toISOString()}.`);

    try {
        // 2. Obter dados do liderado e do líder.
        const employeeSnap = await db.collection('employees').doc(employeeId).get();
        const employee = employeeSnap.data() as EmployeeData | undefined;

        if (!employee || !employee.leaderId) {
            functions.logger.warn(`[Calendar] Funcionário ${employeeId} ou seu leaderId não foram encontrados.`);
            return;
        }

        functions.logger.log(`[Calendar] Liderado: ${employee.name || 'Sem Nome'}, Líder ID: ${employee.leaderId}`);

        const leaderSnap = await db.collection('employees').doc(employee.leaderId).get();
        const leader = leaderSnap.data() as LeaderData | undefined;
        
        if (!leader || !leader.email) {
             functions.logger.warn(`[Calendar] Dados do líder ${employee.leaderId} (nome/email) não encontrados.`);
             return;
        }

        const refreshToken = leader?.googleAuth?.refreshToken;

        if (!refreshToken) {
            functions.logger.warn(`[Calendar] Líder ${leader.name} (${leader.email}) não possui refresh token. O líder precisa autorizar o app.`);
            // Opcional: Futuramente, podemos enviar uma notificação ao líder aqui.
            return;
        }
        
        functions.logger.log(`[Calendar] Líder encontrado: ${leader.name}. Iniciando autenticação com Google.`);

        // 3. Autenticar com a API do Google usando o refresh token.
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // 4. Definir os detalhes do evento.
        const event = {
            summary: `N3 Individual: ${leader.name} e ${employee.name}`,
            description: `Reunião de acompanhamento N3 Individual agendada através da plataforma Nina 1.0.`,
            start: {
                dateTime: nextDate.toISOString(),
                timeZone: 'America/Sao_Paulo', // Fuso horário de Brasília
            },
            end: {
                // O evento durará 30 minutos por padrão.
                dateTime: new Date(nextDate.getTime() + 30 * 60 * 1000).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            attendees: [
                { email: leader.email },
                { email: employee.email } // Adiciona o liderado como convidado
            ],
            reminders: {
                useDefault: true,
            },
        };

        functions.logger.log('[Calendar] Objeto do evento preparado para ser enviado:', event);

        // 5. Criar o evento no calendário primário do líder.
        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendNotifications: true, // Garante que o convite seja enviado por e-mail.
        });

        functions.logger.log(`[Calendar] Evento criado com sucesso! ID do Evento: ${response.data.id}`, {
            leader: leader.email,
            employee: employee.email
        });

    } catch (error: any) {
        functions.logger.error(`[Calendar] Falha ao criar evento no calendário para o funcionário ${employeeId}:`, {
            errorMessage: error.message,
            errorStack: error.stack,
            errorResponse: error.response?.data
        });
        // A falha aqui não deve impedir outras operações, mas o log é crucial.
    }
}
