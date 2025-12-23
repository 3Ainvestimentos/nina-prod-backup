
import * as functions from 'firebase-functions';
import { admin, db } from "./admin-app";  
import { google } from 'googleapis';
import { decrypt, isEncrypted, removeEncryptionMark } from "./kms-utils";

// --- Configuração do OAuth2 Client ---
// Carregados na inicialização da função para evitar recriação a cada chamada
const REGION = process.env.FUNCTIONS_REGION || "us-central1";
const GOOGLE_CLIENT_ID = functions.config().google?.client_id;
const GOOGLE_CLIENT_SECRET = functions.config().google?.client_secret;
const REDIRECT_URL = `https://${REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/googleAuthCallback`;

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URL
);

// --- Interfaces ---
interface InteractionData {
    type?: string;
    nextInteractionDate?: string; // ISO String
    authorId?: string; // UID de quem criou a interação
}

interface EmployeeData {
    name?: string;
    email?: string;
    leaderId?: string;
    googleAuth?: {
        refreshToken?: string;
    };
}

// Mantido apenas EmployeeData; o organizador agora é o autor da interação


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
        // 2. Obter dados do liderado
        const employeeSnap = await db.collection('employees').doc(employeeId).get();
        const employee = employeeSnap.data() as EmployeeData | undefined;
        functions.logger.log('[Calendar] Employee loaded', {
            employeeId,
            hasData: !!employee,
            employeeEmail: employee?.email,
            employeeName: employee?.name,
        });

        if (!employee || !employee.email) {
            functions.logger.warn(`[Calendar] Funcionário ${employeeId} ou seu email não foram encontrados.`);
            return;
        }

        // 3. Identificar autor da interação (organizador da reunião)
        const authorId = interactionData.authorId;
        if (!authorId) {
            functions.logger.warn(`[Calendar] authorId não informado na interação.`);
            return;
        }

        // Obtém email do autor pelo Auth
        const authorUser = await admin.auth().getUser(authorId).catch((e) => {
            functions.logger.warn('[Calendar] getUser(authorId) falhou', { authorId, errorMessage: e?.message });
            return null;
        });
        const authorEmail = authorUser?.email;
        if (!authorEmail) {
            functions.logger.warn(`[Calendar] Não foi possível obter email do autor pelo UID.`, { authorId });
            return;
        }
        functions.logger.log('[Calendar] Autor identificado', { authorId, authorEmail });

        // Busca doc do autor em employees pelo e-mail para recuperar nome e refreshToken
        const authorQuery = await db.collection('employees').where('email', '==', authorEmail).limit(1).get();
        functions.logger.log('[Calendar] Query employees por authorEmail', { authorEmail, count: authorQuery.size });
        if (authorQuery.empty) {
            functions.logger.warn(`[Calendar] Autor não encontrado em employees.`, { authorEmail });
            return;
        }
        const author = authorQuery.docs[0].data() as EmployeeData | undefined;
        let refreshToken = author?.googleAuth?.refreshToken;

        if (!refreshToken) {
            functions.logger.warn(`[Calendar] Autor ${authorEmail} não possui refresh token. É necessário autorizar o app.`);
            return;
        }

        // Descriptografar token se necessário (compatibilidade com tokens antigos e novos)
        if (isEncrypted(refreshToken)) {
            try {
                functions.logger.log(`[Calendar] Token criptografado detectado, descriptografando...`);
                refreshToken = await decrypt(removeEncryptionMark(refreshToken));
                functions.logger.log(`[Calendar] Token descriptografado com sucesso`);
            } catch (e) {
                functions.logger.error(`[Calendar] Erro ao descriptografar token:`, e);
                return; // Falha segura
            }
        }

        functions.logger.log(`[Calendar] Autor encontrado: ${author?.name || authorEmail}. Iniciando autenticação com Google.`);

        // 4. Autenticar com a API do Google usando o refresh token do autor
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // 5. Definir os detalhes do evento.
        // Monta attendees garantindo apenas e-mails válidos
        const attendees: Array<{ email: string }> = [];
        if (authorEmail) attendees.push({ email: authorEmail });
        if (employee.email) attendees.push({ email: employee.email });
        functions.logger.log('[Calendar] Attendees definidos', { attendees });

        const event = {
            summary: `N3 Individual: ${author?.name || authorEmail} e ${employee.name || 'Assessor'}`,
            description: `Reunião N3 Individual criada automaticamente pela plataforma.`,
            start: {
                dateTime: nextDate.toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                // Duração padrão de 30 minutos
                dateTime: new Date(nextDate.getTime() + 30 * 60 * 1000).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            attendees,
            reminders: {
                useDefault: true,
            },
        } as const;

        functions.logger.log('[Calendar] Objeto do evento preparado para ser enviado', {
            summary: event.summary,
            start: event.start,
            end: event.end,
            attendeesCount: attendees.length,
        });

        // 6. Criar o evento no calendário primário do autor.
        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendUpdates: 'all',
        });

        functions.logger.log(`[Calendar] Evento criado com sucesso!`, {
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            author: authorEmail,
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
