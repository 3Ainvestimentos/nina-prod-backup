
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar admin se não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Função temporária para definir o primeiro administrador.
 * Esta função deve ser removida após configurar o primeiro admin.
 */
export const setupFirstAdmin = functions.https.onCall(async (data: { email: string }, context: functions.https.CallableContext) => {
  // 1. Validação de Entrada: Garante que um e-mail foi fornecido.
  const email = data.email;
  if (typeof email !== "string" || email.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O e-mail é obrigatório."
    );
  }

  // 2. Validação de Segurança: Apenas emails específicos podem usar esta função
  const allowedEmails = [
    'lucas.nogueira@3ainvestimentos.com.br',
    'matheus@3ainvestimentos.com.br',
    'henrique.peixoto@3ainvestimentos.com.br'
  ];
  
  if (!allowedEmails.includes(email)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Email não autorizado para usar esta função."
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
      uid: user.uid
    };
  } catch (error: any) {
    console.error("Erro ao definir o claim de administrador:", error);
    if (error?.code === "auth/user-not-found") {
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
