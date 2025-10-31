
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { updateLeaderRanking } from './update-ranking';
import { createCalendarEvent } from './calendar-events';

// Inicializa o SDK do Firebase Admin.
admin.initializeApp();

/**
 * Função chamável para definir um Custom Claim de administrador em um usuário.
 */
export const setAdminClaim = functions.https.onCall(async (data, context) => {
  if (context.auth?.token.isAdmin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas administradores podem adicionar outros administradores."
    );
  }

  const email = data.email;
  if (typeof email !== "string" || email.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O e-mail é obrigatório."
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
    return {
      message: `Sucesso! O usuário ${email} agora é um administrador.`,
    };
  } catch (error) {
    console.error("Erro ao definir o claim de administrador:", error);
    if (error instanceof Error && "code" in error && error.code === "auth/user-not-found") {
        throw new functions.https.HttpsError(
            "not-found",
            `Usuário com e-mail ${email} não foi encontrado.`
          );
    }
    throw new functions.https.HttpsError(
      "internal",
      "Ocorreu um erro interno ao tentar promover o usuário."
    );
  }
});

/**
 * Função de gatilho para processar escritas em interações e PDIs.
 * Aciona a atualização do ranking e a criação de eventos no calendário.
 */
export const onInteractionWrite = functions.region("southamerica-east1").firestore
    .document("/employees/{employeeId}/{collection}/{docId}")
    .onWrite(async (change, context) => {
        const { employeeId, collection } = context.params;

        // Lista de promessas para as tarefas a serem executadas.
        const tasks: Promise<any>[] = [];

        // Tarefa 1: Atualizar o ranking do líder.
        tasks.push(updateLeaderRanking(employeeId));

        // Tarefa 2: Se for uma nova interação, tentar criar um evento no calendário.
        if (collection === 'interactions' && !change.before.exists && change.after.exists) {
            const interactionData = change.after.data();
            tasks.push(createCalendarEvent(interactionData, employeeId));
        }

        // Executa todas as tarefas em paralelo.
        try {
            await Promise.all(tasks);
            functions.logger.log(`Tarefas concluídas com sucesso para o gatilho em /employees/${employeeId}/${collection}.`);
        } catch (error) {
            functions.logger.error("Ocorreu um erro ao processar uma ou mais tarefas do gatilho onInteractionWrite:", error);
        }

        return null;
    });


// Exporta as outras funções.
export { setupFirstAdmin } from './setup-admin';
export { googleAuthInit, googleAuthCallback } from './google-auth';
