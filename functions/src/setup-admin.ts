// functions/src/setup-admin.ts
import * as functions from "firebase-functions/v1";
import { auth } from "./admin-app";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

export const setupFirstAdmin = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    try {
      const listUsersResult = await auth.listUsers(10);
      const hasAdmins = listUsersResult.users.some(u => u.customClaims?.isAdmin);

      if (hasAdmins) {
        throw new functions.https.HttpsError("permission-denied", "Já existem administradores no sistema.");
      }

      const email = data?.email;
      if (!email) throw new functions.https.HttpsError("invalid-argument", "Email é obrigatório.");

      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { isAdmin: true });

      return { success: true, message: `Primeiro administrador definido: ${email}` };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
