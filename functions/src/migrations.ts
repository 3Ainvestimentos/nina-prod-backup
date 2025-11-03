import * as functions from "firebase-functions";
import { admin, db } from "./admin-app";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

interface MigrationResult {
  scanned: number;
  candidates: number;
  moved: number;
  skipped: number;
  errors: number;
  details: Array<{ sourceId: string; targetId?: string; action: string; reason?: string }>;
}

/**
 * Migra googleAuth.refreshToken salvo em docs `employees/{uid}` para o doc do funcionário encontrado por e-mail.
 * Requer usuário autenticado com claim `isAdmin`.
 * Parâmetros:
 *  - dryRun?: boolean (default true) -> não grava, apenas simula
 *  - limit?: number (default 500)   -> quantidade máxima de docs a escanear por chamada
 */
export const migrateGoogleAuthTokens = functions
  .region(REGION)
  .https.onCall(async (data: { dryRun?: boolean; limit?: number } | undefined, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Somente administradores podem rodar a migração.");
    }

    const dryRun = data?.dryRun !== false; // default true
    const limit = Math.min(Math.max(Number(data?.limit ?? 500), 1), 2000);

    const result: MigrationResult = {
      scanned: 0,
      candidates: 0,
      moved: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    const snapshot = await db.collection("employees").limit(limit).get();
    for (const doc of snapshot.docs) {
      result.scanned += 1;
      const data = doc.data() as any;
      const googleAuth = data?.googleAuth;
      if (!googleAuth?.refreshToken) {
        continue; // não é candidato
      }

      // Detecta se o docId parece ser um UID válido (existe no auth)
      let userRecord: admin.auth.UserRecord | null = null;
      try {
        userRecord = await admin.auth().getUser(doc.id);
      } catch (_e) {
        userRecord = null;
      }

      if (!userRecord || !userRecord.email) {
        result.skipped += 1;
        result.details.push({ sourceId: doc.id, action: "skip", reason: "doc não é UID de auth ou sem email" });
        continue;
      }

      result.candidates += 1;

      // Encontra destino por e-mail
      const targetSnaps = await db.collection("employees").where("email", "==", userRecord.email).get();
      if (targetSnaps.empty) {
        result.skipped += 1;
        result.details.push({ sourceId: doc.id, action: "skip", reason: `sem doc por email ${userRecord.email}` });
        continue;
      }

      // Usa o primeiro (esperado ser único)
      const targetDoc = targetSnaps.docs[0];
      const targetId = targetDoc.id;

      if (targetId === doc.id) {
        result.skipped += 1;
        result.details.push({ sourceId: doc.id, action: "skip", reason: "source == target" });
        continue;
      }

      try {
        if (!dryRun) {
          const batch = db.batch();
          batch.set(
            targetDoc.ref,
            {
              googleAuth: {
                refreshToken: googleAuth.refreshToken,
                scope: googleAuth.scope ?? null,
                tokenType: googleAuth.tokenType ?? null,
                expiryDate: googleAuth.expiryDate ?? null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
          // Remove do doc de origem para evitar duplicidade
          batch.set(doc.ref, { googleAuth: admin.firestore.FieldValue.delete() }, { merge: true });
          await batch.commit();
        }
        result.moved += 1;
        result.details.push({ sourceId: doc.id, targetId, action: dryRun ? "would-move" : "moved" });
      } catch (e) {
        result.errors += 1;
        result.details.push({ sourceId: doc.id, targetId, action: "error", reason: String(e) });
      }
    }

    return { ok: true, dryRun, ...result };
  });


