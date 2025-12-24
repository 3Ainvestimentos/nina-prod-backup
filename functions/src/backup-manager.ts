// functions/src/backup-manager.ts
import * as functions from "firebase-functions";
import { Storage } from "@google-cloud/storage";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";
const PROJECT_ID = process.env.GCLOUD_PROJECT || "studio-9152494730-25d31";
const BUCKET_NAME = `${PROJECT_ID}-backups`;

// Lazy initialization do Storage para evitar timeout no deploy
function getStorage() {
  return new Storage();
}


interface BackupInfo {
  name: string;
  type: "auto" | "manual";
  createTime: string;
  size: string;
  expireTime: string | null;
  outputUri?: string;
}

/**
 * Cria um backup manual do Firestore
 */
export const triggerManualBackup = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (context.auth?.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem criar backups");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
    const backupName = `manual-${timestamp}`;
    const outputUri = `gs://${BUCKET_NAME}/${backupName}`;

    try {
      functions.logger.log(`[BackupManager] Iniciando backup manual: ${backupName}`);

      // Obter access token do metadata server (disponível automaticamente nas Cloud Functions)
      const tokenResponse = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https://www.googleapis.com/auth/cloud-platform",
        {
          headers: {
            "Metadata-Flavor": "Google",
          },
        }
      );

      if (!tokenResponse.ok) {
        throw new Error(`Erro ao obter token: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Criar backup via API REST do Firestore
      const exportUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments`;
      
      functions.logger.log(`[BackupManager] Chamando API REST do Firestore`);
      functions.logger.log(`[BackupManager] Output URI: ${outputUri}`);

      const response = await fetch(exportUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outputUriPrefix: outputUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        functions.logger.error(`[BackupManager] Erro na API REST: ${response.status} - ${errorText}`);
        throw new Error(`Erro ao criar backup: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      functions.logger.log(`[BackupManager] Backup iniciado com sucesso:`, result);

      return {
        success: true,
        backupName,
        outputUri,
        timestamp: new Date().toISOString(),
        message: "Backup manual criado com sucesso! O backup está sendo processado em segundo plano.",
        operationName: result.name, // Nome da operação para acompanhar status
        note: "O backup pode levar alguns minutos. Use 'Atualizar Lista' para verificar quando estiver pronto.",
      };
    } catch (error: any) {
      functions.logger.error("[BackupManager] Erro ao criar backup manual:", error);
      throw new functions.https.HttpsError("internal", `Erro ao criar backup: ${error.message}`);
    }
  });

/**
 * Lista todos os backups disponíveis (automáticos e manuais)
 */
export const listAllBackups = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (context.auth?.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem listar backups");
    }

    try {
      functions.logger.log("[BackupManager] Listando backups disponíveis...");

      const backups: BackupInfo[] = [];

      // Listar backups agendados (automáticos) via Firestore Admin API
      // Nota: Firestore Admin SDK não tem método direto para listar backups
      // Vamos usar a API REST ou retornar instruções
      
      // Por enquanto, vamos listar arquivos no bucket do Cloud Storage
      const storage = getStorage();
      const bucket = storage.bucket(BUCKET_NAME);
      
      try {
        const [files] = await bucket.getFiles({ prefix: "" });
        
        for (const file of files) {
          const fileName = file.name;
          const metadata = file.metadata;
          
          // Determinar tipo pelo nome
          const type: "auto" | "manual" = fileName.startsWith("auto-") ? "auto" : "manual";
          
          // Extrair data do nome ou usar metadata
          const createTime = metadata.timeCreated || new Date().toISOString();
          const sizeBytes = typeof metadata.size === "string" ? parseInt(metadata.size) : (metadata.size || 0);
          const size = formatBytes(sizeBytes);
          
          // Calcular expiração (45 dias para automáticos, null para manuais)
          let expireTime: string | null = null;
          if (type === "auto") {
            const createDate = new Date(createTime);
            createDate.setDate(createDate.getDate() + 45);
            expireTime = createDate.toISOString();
          }

          backups.push({
            name: fileName,
            type,
            createTime,
            size,
            expireTime,
            outputUri: `gs://${BUCKET_NAME}/${fileName}`,
          });
        }

        // Ordenar por data de criação (mais recente primeiro)
        backups.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());

        functions.logger.log(`[BackupManager] Encontrados ${backups.length} backups`);

        return {
          success: true,
          backups,
          total: backups.length,
          autoCount: backups.filter(b => b.type === "auto").length,
          manualCount: backups.filter(b => b.type === "manual").length,
        };
      } catch (storageError: any) {
        functions.logger.warn("[BackupManager] Erro ao listar do Storage, retornando instruções:", storageError);
        
        // Fallback: retornar instruções para listar via gcloud
        return {
          success: true,
          backups: [],
          total: 0,
          message: "Use o comando gcloud para listar backups:",
          instructions: [
            "gcloud firestore backups list --database='(default)'",
          ],
        };
      }
    } catch (error: any) {
      functions.logger.error("[BackupManager] Erro ao listar backups:", error);
      throw new functions.https.HttpsError("internal", `Erro ao listar backups: ${error.message}`);
    }
  });

/**
 * Testa/valida um backup sem restaurar
 */
export const testRestore = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (context.auth?.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem testar restauração");
    }

    const { backupName } = data || {};

    try {
      functions.logger.log(`[BackupManager] Validando backup: ${backupName || "mais recente"}`);

      const storage = getStorage();
      const bucket = storage.bucket(BUCKET_NAME);
      
      // Se não especificou backup, pegar o mais recente
      let targetBackup = backupName;
      if (!targetBackup) {
        const [files] = await bucket.getFiles({ prefix: "" });
        if (files.length === 0) {
          throw new functions.https.HttpsError("not-found", "Nenhum backup encontrado");
        }
        // Ordenar por data e pegar o mais recente
        files.sort((a, b) => {
          const timeA = new Date(a.metadata.timeCreated || 0).getTime();
          const timeB = new Date(b.metadata.timeCreated || 0).getTime();
          return timeB - timeA;
        });
        targetBackup = files[0].name;
      }

      // Verificar se backup existe
      const file = bucket.file(targetBackup);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new functions.https.HttpsError("not-found", `Backup ${targetBackup} não encontrado`);
      }

      // Obter metadata do backup
      const [metadata] = await file.getMetadata();
      const sizeBytes = typeof metadata.size === "string" ? parseInt(metadata.size) : (metadata.size || 0);
      const createTime = metadata.timeCreated || new Date().toISOString();

      // Validações básicas
      const validations = {
        exists: true,
        hasSize: sizeBytes > 0,
        hasMetadata: !!metadata,
        sizeBytes: sizeBytes,
        sizeFormatted: formatBytes(sizeBytes),
      };

      const isValid = validations.exists && validations.hasSize && validations.hasMetadata;

      functions.logger.log(`[BackupManager] Backup ${targetBackup} validado: ${isValid ? "VÁLIDO" : "INVÁLIDO"}`);

      return {
        success: true,
        valid: isValid,
        backupName: targetBackup,
        createTime,
        size: formatBytes(sizeBytes),
        sizeBytes: sizeBytes,
        validations,
        message: isValid 
          ? "Backup válido e pronto para restauração" 
          : "Backup inválido - verifique os detalhes",
        restoreInstructions: [
          "Para restaurar em um banco de teste, execute:",
          `gcloud firestore import gs://${BUCKET_NAME}/${targetBackup} --database=test-restore`,
          "",
          "Para restaurar no banco principal (CUIDADO!), execute:",
          `gcloud firestore import gs://${BUCKET_NAME}/${targetBackup} --database="(default)"`,
        ],
      };
    } catch (error: any) {
      functions.logger.error("[BackupManager] Erro ao validar backup:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", `Erro ao validar backup: ${error.message}`);
    }
  });

/**
 * Deleta um backup manual
 */
export const deleteBackup = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (context.auth?.token.isAdmin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Apenas admins podem deletar backups");
    }

    const { backupName } = data;
    
    if (!backupName) {
      throw new functions.https.HttpsError("invalid-argument", "backupName é obrigatório");
    }

    // Não permitir deletar backups automáticos
    if (backupName.startsWith("auto-")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Não é possível deletar backups automáticos. Eles são gerenciados pelo schedule."
      );
    }

    try {
      functions.logger.log(`[BackupManager] Deletando backup: ${backupName}`);

      const storage = getStorage();
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(backupName);

      // Verificar se existe
      const [exists] = await file.exists();
      if (!exists) {
        throw new functions.https.HttpsError("not-found", `Backup ${backupName} não encontrado`);
      }

      // Deletar
      await file.delete();

      functions.logger.log(`[BackupManager] Backup ${backupName} deletado com sucesso`);

      return {
        success: true,
        deleted: backupName,
        message: `Backup ${backupName} deletado com sucesso`,
      };
    } catch (error: any) {
      functions.logger.error("[BackupManager] Erro ao deletar backup:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", `Erro ao deletar backup: ${error.message}`);
    }
  });

/**
 * Formata bytes para formato legível
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

