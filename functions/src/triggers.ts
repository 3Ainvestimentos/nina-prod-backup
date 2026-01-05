// functions/src/triggers.ts
import * as functions from "firebase-functions/v1";
import { auth, db } from "./admin-app";
import { updateLeaderRanking } from "./update-ranking";
import { createCalendarEvent } from "./calendar-events";
import { getOAuth2Client } from "./google-auth";
import { formatN3EmailBody, sendEmail } from "./gmail-service";
import { decrypt, isEncrypted, removeEncryptionMark } from "./kms-utils";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

// Configuração de secrets para acesso ao Google OAuth
const secretsConfig = {
  secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
};

export const onInteractionCreate = functions
  .runWith(secretsConfig)
  .region(REGION)
  .firestore.document("/employees/{employeeId}/interactions/{interactionId}")
  .onCreate(async (snap, context) => {
    const { employeeId } = context.params;
    const interactionData = snap.data();

    functions.logger.log("[Interactions] onInteractionCreate disparado", {
      employeeId,
      interactionId: context.params.interactionId,
      type: interactionData?.type,
    });

    const tasks: Promise<any>[] = [updateLeaderRanking(employeeId)];
    if (interactionData) tasks.push(createCalendarEvent(interactionData, employeeId));

    // Log detalhado para debug
    functions.logger.info("[Interactions] Verificando condições para email N3", {
      type: interactionData?.type,
      sendEmailToAssessor: interactionData?.sendEmailToAssessor,
      hasAuthorId: !!interactionData?.authorId,
      employeeId,
    });

    if (interactionData?.type === "N3 Individual" && interactionData.sendEmailToAssessor === true && interactionData.authorId) {
      functions.logger.info("[EmailN3] Iniciando task de envio de email", { employeeId, authorId: interactionData.authorId });
      tasks.push((async () => {
        try {
          const authorUser = await auth.getUser(interactionData.authorId).catch((e) => {
            functions.logger.warn("[EmailN3] Falha ao obter usuário autor", { authorId: interactionData.authorId, error: e?.message });
            return null;
          });
          const authorEmail = authorUser?.email;
          if (!authorEmail) {
            functions.logger.warn("[EmailN3] Email do autor não encontrado", { authorId: interactionData.authorId });
            return;
          }

          const leaderQuery = await db.collection("employees").where("email", "==", authorEmail).limit(1).get();
          if (leaderQuery.empty) {
            functions.logger.warn("[EmailN3] Líder não encontrado no Firestore", { authorEmail });
            return;
          }

          const leaderDoc = leaderQuery.docs[0];
          const leaderData = leaderDoc.data();
          let refreshToken = leaderData?.googleAuth?.refreshToken;
          const savedScope = leaderData?.googleAuth?.scope;

          if (refreshToken && isEncrypted(refreshToken)) {
            functions.logger.info("[EmailN3] Token criptografado detectado, descriptografando...");
            try {
              refreshToken = await decrypt(removeEncryptionMark(refreshToken));
              functions.logger.info("[EmailN3] Token descriptografado com sucesso");
            } catch (decryptError: any) {
              functions.logger.error("[EmailN3] Erro ao descriptografar token", { error: decryptError?.message, code: decryptError?.code });
              refreshToken = null;
            }
          }

          const scopeString = typeof savedScope === 'string' ? savedScope : (Array.isArray(savedScope) ? savedScope.join(' ') : '');
          if (!refreshToken || !scopeString.includes('gmail.send')) {
            functions.logger.warn("[EmailN3] Token ou escopo ausente", { 
              hasToken: !!refreshToken, 
              hasGmailScope: scopeString.includes('gmail.send'),
              scope: scopeString 
            });
            return;
          }

          const employeeDoc = await db.collection("employees").doc(employeeId).get();
          const employeeData = employeeDoc.data();
          if (!employeeData?.email) {
            functions.logger.warn("[EmailN3] Email do colaborador não encontrado", { employeeId });
            return;
          }

          const oauth2Client = getOAuth2Client();
          oauth2Client.setCredentials({ refresh_token: refreshToken });

          const htmlBody = formatN3EmailBody(interactionData, leaderData.name || "Líder", employeeData.name || "Colaborador");
          const recipients = [employeeData.email];
          if (authorEmail !== employeeData.email) recipients.push(authorEmail);

          functions.logger.info("[EmailN3] Enviando email", { recipients: recipients.length, to: recipients });
          await sendEmail(oauth2Client as any, recipients, `Resumo da Interação N3 Individual - ${employeeData.name}`, htmlBody);
          functions.logger.info("[EmailN3] Email enviado com sucesso", { recipients });
        } catch (error: any) {
          functions.logger.error(`[EmailN3] Erro ao enviar email:`, { 
            error: error?.message, 
            stack: error?.stack,
            employeeId,
            authorId: interactionData?.authorId 
          });
        }
      })());
    } else {
      functions.logger.info("[Interactions] Email N3 não será enviado", {
        reason: !interactionData?.sendEmailToAssessor ? "sendEmailToAssessor não está true" :
                !interactionData?.authorId ? "authorId ausente" :
                interactionData?.type !== "N3 Individual" ? "tipo não é N3 Individual" : "condição não atendida"
      });
    }

    functions.logger.info("[Interactions] Executando tasks", { taskCount: tasks.length });
    return Promise.all(tasks).catch((e: any) => {
      functions.logger.error(`[Interactions] Erro na execução de tasks:`, { error: e?.message, stack: e?.stack });
    });
  });

export const onPdiWrite = functions
  .region(REGION)
  .firestore.document("/employees/{employeeId}/pdiActions/{pdiId}")
  .onWrite(async (change, context) => {
    const { employeeId } = context.params;
    return updateLeaderRanking(employeeId).catch(e => functions.logger.error(`[PDI] Erro:`, e));
  });
