
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializa o SDK do Firebase Admin.
// As credenciais são gerenciadas automaticamente pelo ambiente do Cloud Functions.
admin.initializeApp();

/**
 * Função chamável para definir um Custom Claim de administrador em um usuário.
 *
 * @param data - Objeto contendo o `email` do usuário a ser promovido.
 * @param context - Contexto da chamada, incluindo informações de autenticação.
 *
 * @returns Um objeto com uma mensagem de sucesso ou erro.
 * @throws `functions.https.HttpsError` Se o chamador não for um administrador
 * ou se o usuário alvo não for encontrado.
 */
export const setAdminClaim = functions.https.onCall(async (data, context) => {
  // 1. Verificação de Segurança: Garante que o chamador já é um administrador.
  // O primeiro administrador precisa ser definido manualmente via terminal ou
  // temporariamente comentando este bloco para a primeira execução.
  if (context.auth?.token.isAdmin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas administradores podem adicionar outros administradores."
    );
  }

  // 2. Validação de Entrada: Garante que um e-mail foi fornecido.
  const email = data.email;
  if (typeof email !== "string" || email.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O e-mail é obrigatório."
    );
  }

  try {
    // 3. Lógica Principal: Encontra o usuário pelo e-mail.
    const user = await admin.auth().getUserByEmail(email);

    // 4. Define o Custom Claim `{ isAdmin: true }` para o usuário.
    await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });

    // 5. Retorna uma mensagem de sucesso.
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


// functions/src/index.ts - Adicionar no final
export { setupFirstAdmin } from './setup-admin';
export { updateLeaderRankingOnWrite } from './update-ranking';
export { googleAuthInit, googleAuthCallback } from './google-auth';
