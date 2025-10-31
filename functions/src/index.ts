
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { updateLeaderRanking } from './update-ranking';
import { createCalendarEvent } from './calendar-events';
import { googleAuthInit, googleAuthCallback } from './google-auth';
import { setupFirstAdmin } from './setup-admin';

// Inicializa o SDK do Firebase Admin.
if (!admin.apps.length) {
    admin.initializeApp();
}

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
 * Função de gatilho para processar a criação de interações.
 * Aciona a atualização do ranking e a criação de eventos no calendário.
 */
export const onInteractionCreate = functions.firestore
    .document("/employees/{employeeId}/interactions/{interactionId}")
    .onCreate(async (snap, context) => {
        const { employeeId } = context.params;
        const interactionData = snap.data();

        // Lista de promessas para as tarefas a serem executadas.
        const tasks: Promise<any>[] = [];

        // Tarefa 1: Atualizar o ranking do líder (pode ser executada em paralelo).
        tasks.push(updateLeaderRanking(employeeId));

        // Tarefa 2: Tentar criar um evento no calendário (pode ser executada em paralelo).
        if (interactionData) {
            tasks.push(createCalendarEvent(interactionData, employeeId));
        }

        // Executa todas as tarefas em paralelo.
        try {
            await Promise.all(tasks);
            functions.logger.log(`Tarefas de criação de interação concluídas com sucesso para o funcionário ${employeeId}.`);
        } catch (error) {
            functions.logger.error(`Ocorreu um erro ao processar uma ou mais tarefas para a criação da interação do funcionário ${employeeId}:`, error);
        }

        return null;
    });

/**
 * Função de gatilho para processar escritas em PDIs.
 * Aciona apenas a atualização do ranking do líder.
 */
export const onPdiWrite = functions.firestore
    .document("/employees/{employeeId}/pdiActions/{pdiId}")
    .onWrite(async (change, context) => {
        const { employeeId } = context.params;
        
        try {
            await updateLeaderRanking(employeeId);
            functions.logger.log(`Ranking atualizado com sucesso devido à escrita no PDI do funcionário ${employeeId}.`);
        } catch (error) {
            functions.logger.error(`Erro ao atualizar ranking após escrita no PDI para o funcionário ${employeeId}:`, error);
        }

        return null;
    });


// Exporta as outras funções.
export { setupFirstAdmin, googleAuthInit, googleAuthCallback };
