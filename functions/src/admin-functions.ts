// functions/src/admin-functions.ts
import * as functions from "firebase-functions/v1";
import { auth } from "./admin-app";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

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
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { isAdmin: true });
      return { message: `Sucesso! O usuário ${email} agora é um administrador.` };
    } catch (error: any) {
      console.error("Erro ao definir o claim de administrador:", error);
      if (error?.code === "auth/user-not-found") {
        throw new functions.https.HttpsError("not-found", `Usuário com e-mail ${email} não foi encontrado.`);
      }
      throw new functions.https.HttpsError("internal", "Erro interno ao tentar promover o usuário.");
    }
  });
