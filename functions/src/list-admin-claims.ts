// functions/src/list-admin-claims.ts
import * as functions from "firebase-functions/v1";
import { auth } from "./admin-app";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

export const listAdminClaims = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }

    try {
      const listUsersResult = await auth.listUsers(1000);
      const admins: Array<{ uid: string; email: string | undefined; isAdmin: boolean }> = [];

      for (const userRecord of listUsersResult.users) {
        const customClaims = userRecord.customClaims || {};
        if (customClaims.isAdmin === true) {
          admins.push({
            uid: userRecord.uid,
            email: userRecord.email,
            isAdmin: true,
          });
        }
      }

      return {
        total: listUsersResult.users.length,
        admins: admins,
        count: admins.length,
      };
    } catch (error: any) {
      console.error("Erro ao listar usuários:", error);
      throw new functions.https.HttpsError("internal", "Erro ao listar usuários");
    }
  });
