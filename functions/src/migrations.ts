// functions/src/migrations.ts
import * as functions from "firebase-functions/v1";
import { auth, db, FieldValue } from "./admin-app";
import { encrypt, markAsEncrypted, isEncrypted } from "./kms-utils";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

interface MigrationResult {
  scanned: number;
  candidates: number;
  moved: number;
  skipped: number;
  errors: number;
  details: Array<{ sourceId: string; targetId?: string; action: string; reason?: string }>;
}

export const migrateGoogleAuthTokens = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Somente administradores podem rodar a migração.");
    }

    const dryRun = data?.dryRun !== false;
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
      const docData = doc.data() as any;
      const googleAuth = docData?.googleAuth;
      if (!googleAuth?.refreshToken) continue;

      let userRecord: any = null;
      try {
        userRecord = await auth.getUser(doc.id);
      } catch (_e) {
        userRecord = null;
      }

      if (!userRecord || !userRecord.email) {
        result.skipped += 1;
        result.details.push({ sourceId: doc.id, action: "skip", reason: "doc não é UID de auth ou sem email" });
        continue;
      }

      result.candidates += 1;
      const targetSnaps = await db.collection("employees").where("email", "==", userRecord.email).get();
      if (targetSnaps.empty) {
        result.skipped += 1;
        result.details.push({ sourceId: doc.id, action: "skip", reason: `sem doc por email ${userRecord.email}` });
        continue;
      }

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
                updatedAt: FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
          batch.update(doc.ref, { googleAuth: FieldValue.delete() });
          await batch.commit();
        }
        result.moved += 1;
        result.details.push({ sourceId: doc.id, targetId, action: "moved" });
      } catch (e: any) {
        result.errors += 1;
        result.details.push({ sourceId: doc.id, action: "error", reason: e?.message });
      }
    }
    return { dryRun, limit, ...result };
  });

export const migrateTokensToEncrypted = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem rodar migração de segurança.");
    }

    const dryRun = data?.dryRun !== false;
    try {
      const snapshot = await db.collection("employees").get();
      const results = { scanned: snapshot.size, migrated: 0, skipped: 0, errors: 0 };

      for (const doc of snapshot.docs) {
        const docData = doc.data();
        const refreshToken = docData?.googleAuth?.refreshToken;

        if (!refreshToken || isEncrypted(refreshToken)) {
          results.skipped++;
          continue;
        }

        try {
          if (!dryRun) {
            const encrypted = await encrypt(refreshToken);
            await doc.ref.update({
              "googleAuth.refreshToken": markAsEncrypted(encrypted),
              "googleAuth.isEncrypted": true,
              "googleAuth.migratedAt": FieldValue.serverTimestamp(),
            });
          }
          results.migrated++;
        } catch (e) {
          results.errors++;
        }
      }
      return { dryRun, ...results };
    } catch (error: any) {
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
