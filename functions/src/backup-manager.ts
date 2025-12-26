// functions/src/backup-manager.ts
import * as functions from "firebase-functions/v1";
import { Storage } from "@google-cloud/storage";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";
const PROJECT_ID = process.env.GCLOUD_PROJECT || "studio-9152494730-25d31";
const BUCKET_NAME = `${PROJECT_ID}-backups`;

let storage: Storage;
const getStorageClient = () => {
  if (!storage) storage = new Storage();
  return storage;
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const triggerManualBackup = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem criar backups.");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
    const backupName = `manual-${timestamp}`;
    const outputUri = `gs://${BUCKET_NAME}/${backupName}`;

    return {
      success: true,
      message: "Para criar um backup manual, execute o comando gcloud CLI no seu terminal local.",
      backupName: backupName,
      outputUri: outputUri,
      timestamp: new Date().toISOString(),
      instructions: [
        "Para executar o backup, use:",
        `gcloud firestore export ${outputUri} --database='(default)' --project=${PROJECT_ID}`,
        "Certifique-se de estar autenticado com `gcloud auth login`.",
      ],
    };
  });

export const listAllBackups = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem listar backups.");
    }

    try {
      const storageClient = getStorageClient();
      const [files] = await storageClient.bucket(BUCKET_NAME).getFiles({ prefix: 'manual-', delimiter: '/' });
      const backups: any[] = [];

      for (const file of files) {
        if (file.name.endsWith('/')) {
          const backupName = file.name.slice(0, -1);
          let size = "N/A";
          try {
            const [metadata] = await storageClient.bucket(BUCKET_NAME).file(`${backupName}/.overall_export_metadata`).getMetadata();
            size = formatBytes(parseInt(metadata.size as string));
          } catch (e) {}

          backups.push({
            name: backupName,
            type: "manual",
            createTime: new Date().toISOString(),
            size,
          });
        }
      }

      return { success: true, backups: backups.sort((a, b) => b.name.localeCompare(a.name)), total: backups.length };
    } catch (error: any) {
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

export const testRestore = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem testar restauração.");
    }

    const { backupName } = data || {};
    if (!backupName) throw new functions.https.HttpsError("invalid-argument", "Nome do backup é obrigatório.");

    try {
      const storageClient = getStorageClient();
      const [exists] = await storageClient.bucket(BUCKET_NAME).file(`${backupName}/.overall_export_metadata`).exists();

      return {
        success: true,
        valid: exists,
        message: exists ? "Backup válido." : "Backup incompleto ou não encontrado.",
      };
    } catch (error: any) {
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

export const deleteBackup = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem deletar backups.");
    }

    const { backupName } = data;
    if (!backupName || backupName.startsWith("auto-")) {
      throw new functions.https.HttpsError("invalid-argument", "Nome inválido.");
    }

    try {
      const storageClient = getStorageClient();
      await storageClient.bucket(BUCKET_NAME).deleteFiles({ prefix: `${backupName}/` });
      return { success: true, deleted: backupName };
    } catch (error: any) {
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
