// functions/src/setup-admin.ts
import * as functions from "firebase-functions";
import { admin } from "./admin-app"; // ✅ usa a inicialização centralizada

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

/**
 * Função temporária para definir o primeiro administrador.
 * Remova após configurar o primeiro admin.
 */
export const setupFirstAdmin = functions
  .region(REGION)
  .https.onCall(async (data: { email: string }, _context) => {
    // 1) Validação de entrada
    const email = data?.email;
    if (typeof email !== "string" || email.trim().length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "O e-mail é obrigatório."
      );
    }

    // 2) Validação de segurança (lista branca temporária)
    const allowedEmails = [
      "lucas.nogueira@3ainvestimentos.com.br",
      "matheus@3ainvestimentos.com.br",
      "henrique.peixoto@3ainvestimentos.com.br",
    ];
    if (!allowedEmails.includes(email)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Email não autorizado para usar esta função."
      );
    }

    try {
      // 3) Busca usuário
      const user = await admin.auth().getUserByEmail(email);

      // 4) Define custom claim
      await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });

      // 5) Retorno
      return {
        message: `Sucesso! O usuário ${email} agora é um administrador.`,
        uid: user.uid,
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
