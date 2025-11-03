// functions/src/index.ts
import * as functions from "firebase-functions";
import { admin } from "./admin-app"; // ✅ inicialização centralizada
import { updateLeaderRanking } from "./update-ranking";
import { createCalendarEvent } from "./calendar-events";
import { googleAuthInit, googleAuthCallback } from "./google-auth";
import { migrateGoogleAuthTokens } from "./migrations";
import { setupFirstAdmin } from "./setup-admin";

// Região única do projeto
const REGION = process.env.FUNCTIONS_REGION || "us-central1";

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
    });

    const tasks: Promise<any>[] = [updateLeaderRanking(employeeId)];
    if (interactionData) tasks.push(createCalendarEvent(interactionData, employeeId));

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
export { setupFirstAdmin, googleAuthInit, googleAuthCallback, migrateGoogleAuthTokens };
