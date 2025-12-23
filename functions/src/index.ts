// functions/src/index.ts
import * as functions from "firebase-functions";
import { admin } from "./admin-app"; // ✅ inicialização centralizada
import { updateLeaderRanking } from "./update-ranking";
import { createCalendarEvent } from "./calendar-events";
import { googleAuthInit, googleAuthCallback, getOAuth2Client } from "./google-auth";
import { migrateGoogleAuthTokens } from "./migrations";
import { setupFirstAdmin } from "./setup-admin";
import { listAdminClaims } from "./list-admin-claims";
import { formatN3EmailBody, sendEmail } from "./gmail-service";

// Região única do projeto
const REGION = process.env.FUNCTIONS_REGION || "us-central1";
const db = admin.firestore();

/**
 * Callable: promover admin
 */
export const setAdminClaim = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (context.auth?.token.isAdmin !== true) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores podem adicionar outros administradores."
      );
    }

    const email = data?.email as string;
    if (typeof email !== "string" || email.trim().length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "O e-mail é obrigatório.");
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
      return { message: `Sucesso! O usuário ${email} agora é um administrador.` };
    } catch (error: any) {
      console.error("Erro ao definir o claim de administrador:", error);
      if (error?.code === "auth/user-not-found") {
        throw new functions.https.HttpsError("not-found", `Usuário com e-mail ${email} não foi encontrado.`);
      }
      throw new functions.https.HttpsError("internal", "Erro interno ao tentar promover o usuário.");
    }
  });

/**
 * Trigger: criação de interação -> ranking + evento no calendário
 */
export const onInteractionCreate = functions
  .region(REGION)
  .firestore.document("/employees/{employeeId}/interactions/{interactionId}")
  .onCreate(async (snap, context) => {
    const { employeeId } = context.params;
    const interactionData = snap.data();

    functions.logger.log("[Interactions] onInteractionCreate disparado", {
      employeeId,
      interactionId: context.params.interactionId,
      hasData: !!interactionData,
      type: interactionData?.type,
      nextInteractionDate: interactionData?.nextInteractionDate,
      authorId: interactionData?.authorId,
      sendEmailToAssessor: interactionData?.sendEmailToAssessor,
    });

    const tasks: Promise<any>[] = [updateLeaderRanking(employeeId)];
    if (interactionData) tasks.push(createCalendarEvent(interactionData, employeeId));

    // --- Lógica de Envio de Email N3 (SEPARADO do calendário) ---
    // GARANTIA: Email só é enviado se sendEmailToAssessor for explicitamente true
    if (interactionData?.type === "N3 Individual") {
      if (interactionData.sendEmailToAssessor === true && interactionData.authorId) {
        functions.logger.log(`[EmailN3] ✅ Trigger de email N3 ativado! Tipo: ${interactionData.type}, AuthorId: ${interactionData.authorId}, sendEmailToAssessor: ${interactionData.sendEmailToAssessor}`);
        tasks.push((async () => {
        try {
          functions.logger.log(`[EmailN3] Interação N3 detectada. Buscando credenciais do líder (UID: ${interactionData.authorId})`);

          // 1. Obter email do autor pelo Firebase Auth (authorId é UID, não ID do documento)
          const authorUser = await admin.auth().getUser(interactionData.authorId).catch((e) => {
            functions.logger.warn('[EmailN3] getUser(authorId) falhou', { authorId: interactionData.authorId, errorMessage: e?.message });
            return null;
          });
          const authorEmail = authorUser?.email;
          
          if (!authorEmail) {
            functions.logger.warn(`[EmailN3] Não foi possível obter email do autor pelo UID.`, { authorId: interactionData.authorId });
            return;
          }
          
          functions.logger.log(`[EmailN3] Email do autor obtido: ${authorEmail}`);

          // 2. Buscar documento do líder em employees pelo email
          const leaderQuery = await db.collection("employees").where("email", "==", authorEmail).limit(1).get();
          
          if (leaderQuery.empty) {
            functions.logger.warn(`[EmailN3] Líder não encontrado em employees pelo email: ${authorEmail}`);
            return;
          }
          
          const leaderDoc = leaderQuery.docs[0];
          const leaderData = leaderDoc.data();
          const refreshToken = leaderData?.googleAuth?.refreshToken;
          const savedScope = leaderData?.googleAuth?.scope;
          
          // Verificar se o escopo está presente (pode ser string ou array)
          const scopeString = typeof savedScope === 'string' 
            ? savedScope 
            : (Array.isArray(savedScope) ? savedScope.join(' ') : '');
          const hasGmailScope = scopeString.includes('gmail.send');

          functions.logger.log(`[EmailN3] Refresh Token encontrado? ${!!refreshToken ? "Sim" : "Não"}`);
          functions.logger.log(`[EmailN3] Escopo salvo: ${savedScope || 'N/A'} (tipo: ${typeof savedScope})`);
          functions.logger.log(`[EmailN3] Escopo gmail.send presente? ${hasGmailScope ? "Sim" : "Não"}`);

          if (!refreshToken) {
            functions.logger.warn(`[EmailN3] Líder ${authorEmail} não possui refresh_token. Email não será enviado.`);
            return;
          }

          if (!hasGmailScope) {
            functions.logger.warn(`[EmailN3] ⚠️ ATENÇÃO: Líder ${authorEmail} não possui escopo 'gmail.send' autorizado.`);
            functions.logger.warn(`[EmailN3] ⚠️ SOLUÇÃO: O usuário precisa fazer logout e login novamente para forçar nova autorização.`);
            functions.logger.warn(`[EmailN3] ⚠️ Escopo atual salvo: ${savedScope || 'Nenhum escopo salvo'}`);
            return;
          }

          // 3. Buscar dados do Colaborador (destinatário)
          const employeeDoc = await db.collection("employees").doc(employeeId).get();
          const employeeData = employeeDoc.data();
          const employeeEmail = employeeData?.email;
          const employeeName = employeeData?.name || "Colaborador";
          const leaderName = leaderData?.name || "Líder";

          functions.logger.log(`[EmailN3] Email do colaborador encontrado: ${employeeEmail}`);

          if (!employeeEmail) {
            functions.logger.warn(`[EmailN3] Colaborador ${employeeId} não possui email cadastrado.`);
            return;
          }

          // 4. Configurar cliente OAuth2
          const oauth2Client = getOAuth2Client();
          oauth2Client.setCredentials({ refresh_token: refreshToken });

          // 5. Gerar corpo do email
          const htmlBody = formatN3EmailBody(interactionData, leaderName, employeeName);

          // 6. Enviar email (Para: Líder + Colaborador)
          const recipients = [employeeEmail];
          if (authorEmail && authorEmail !== employeeEmail) {
            recipients.push(authorEmail);
          }

          functions.logger.log(`[EmailN3] Enviando email para: ${recipients.join(", ")}`);

          const emailSubject = `Resumo da Interação N3 Individual - ${employeeName}`;
          
          functions.logger.log(`[EmailN3] Preparando envio de email separado (não relacionado ao calendário)`);
          functions.logger.log(`[EmailN3] Assunto: ${emailSubject}`);
          functions.logger.log(`[EmailN3] Destinatários: ${recipients.join(", ")}`);

          await sendEmail(
            oauth2Client,
            recipients,
            emailSubject,
            htmlBody
          );

          functions.logger.log(`[EmailN3] ✅ Email de resumo N3 enviado com sucesso! (Separado do convite do calendário)`);

        } catch (emailError: any) {
          // Erro não bloqueante
          functions.logger.error(`[EmailN3] ❌ Erro ao enviar email N3:`, {
            message: emailError?.message,
            code: emailError?.code,
            stack: emailError?.stack,
            response: emailError?.response?.data
          });
        }
      })());
      } else {
        functions.logger.log(`[EmailN3] ❌ Email N3 NÃO será enviado. sendEmailToAssessor: ${interactionData.sendEmailToAssessor}, authorId: ${!!interactionData.authorId}`);
      }
    }
    // -----------------------------------

    try {
      await Promise.all(tasks);
      functions.logger.log(`[Interactions] Tarefas concluídas para o funcionário ${employeeId}.`);
    } catch (error) {
      functions.logger.error(`[Interactions] Erro ao processar tarefas (${employeeId}):`, error);
    }
    return null;
  });

/**
 * Trigger: escrita em PDI -> ranking
 */
export const onPdiWrite = functions
  .region(REGION)
  .firestore.document("/employees/{employeeId}/pdiActions/{pdiId}")
  .onWrite(async (_change, context) => {
    const { employeeId } = context.params;
    try {
      await updateLeaderRanking(employeeId);
      functions.logger.log(`Ranking atualizado após PDI de ${employeeId}.`);
    } catch (error) {
      functions.logger.error(`Erro ao atualizar ranking (${employeeId}):`, error);
    }
    return null;
  });

// Reexporta as HTTPs
export { setupFirstAdmin, googleAuthInit, googleAuthCallback, migrateGoogleAuthTokens, listAdminClaims };
