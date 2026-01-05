// scripts/validate-backup.ts
/**
 * Script de validação de backup do Firestore
 * 
 * Este script valida um backup sem restaurá-lo, verificando:
 * - Existência do backup
 * - Tamanho do backup
 * - Integridade dos arquivos
 * 
 * Uso:
 *   npx ts-node scripts/validate-backup.ts [backup-name]
 * 
 * Se não especificar backup-name, valida o mais recente
 */

import { Storage } from "@google-cloud/storage";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "studio-9152494730-25d31";
const BUCKET_NAME = `${PROJECT_ID}-backups`;

const storage = new Storage();

interface ValidationResult {
  valid: boolean;
  backupName: string;
  exists: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  createTime: string;
  errors: string[];
  warnings: string[];
}

async function validateBackup(backupName?: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: false,
    backupName: backupName || "",
    exists: false,
    sizeBytes: 0,
    sizeFormatted: "0 Bytes",
    createTime: "",
    errors: [],
    warnings: [],
  };

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    // Se não especificou backup, pegar o mais recente
    let targetBackup = backupName;
    if (!targetBackup) {
      console.log("📋 Buscando backup mais recente...");
      const [files] = await bucket.getFiles({ prefix: "" });
      
      if (files.length === 0) {
        result.errors.push("Nenhum backup encontrado no bucket");
        return result;
      }

      // Ordenar por data e pegar o mais recente
      files.sort((a, b) => {
        const timeA = new Date(a.metadata.timeCreated || 0).getTime();
        const timeB = new Date(b.metadata.timeCreated || 0).getTime();
        return timeB - timeA;
      });
      
      targetBackup = files[0].name;
      console.log(`✅ Backup mais recente encontrado: ${targetBackup}`);
    }

    result.backupName = targetBackup;

    // Verificar se backup existe
    const file = bucket.file(targetBackup);
    const [exists] = await file.exists();
    result.exists = exists;

    if (!exists) {
      result.errors.push(`Backup ${targetBackup} não encontrado no bucket ${BUCKET_NAME}`);
      return result;
    }

    console.log(`✅ Backup existe: ${targetBackup}`);

    // Obter metadata
    const [metadata] = await file.getMetadata();
    const sizeBytes = typeof metadata.size === "string" ? parseInt(metadata.size) : (metadata.size || 0);
    const createTime = metadata.timeCreated || new Date().toISOString();

    result.sizeBytes = sizeBytes;
    result.sizeFormatted = formatBytes(sizeBytes);
    result.createTime = createTime;

    console.log(`✅ Tamanho: ${result.sizeFormatted} (${sizeBytes} bytes)`);
    console.log(`✅ Criado em: ${new Date(createTime).toLocaleString('pt-BR')}`);

    // Validações
    if (sizeBytes === 0) {
      result.errors.push("Backup tem tamanho zero - pode estar corrompido");
    }

    if (!metadata) {
      result.errors.push("Metadata do backup não encontrada");
    }

    // Verificar se é um diretório de backup válido
    // Backups do Firestore geralmente contêm arquivos específicos
    const [files] = await bucket.getFiles({ prefix: `${targetBackup}/` });
    
    if (files.length === 0) {
      result.warnings.push("Nenhum arquivo encontrado dentro do backup - pode ser um backup vazio");
    } else {
      console.log(`✅ Backup contém ${files.length} arquivos`);
    }

    // Determinar se é válido
    result.valid = result.errors.length === 0;

    return result;
  } catch (error: any) {
    result.errors.push(`Erro ao validar backup: ${error.message}`);
    return result;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

// Executar se chamado diretamente
if (require.main === module) {
  const backupName = process.argv[2];
  
  console.log("🔍 Iniciando validação de backup...");
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  if (backupName) {
    console.log(`📋 Backup especificado: ${backupName}`);
  }
  console.log("");

  validateBackup(backupName)
    .then((result) => {
      console.log("\n" + "=".repeat(60));
      console.log("📊 RESULTADO DA VALIDAÇÃO");
      console.log("=".repeat(60));
      console.log(`Backup: ${result.backupName}`);
      console.log(`Status: ${result.valid ? "✅ VÁLIDO" : "❌ INVÁLIDO"}`);
      console.log(`Tamanho: ${result.sizeFormatted}`);
      console.log(`Criado em: ${new Date(result.createTime).toLocaleString('pt-BR')}`);
      
      if (result.errors.length > 0) {
        console.log("\n❌ ERROS:");
        result.errors.forEach((error) => console.log(`  - ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log("\n⚠️  AVISOS:");
        result.warnings.forEach((warning) => console.log(`  - ${warning}`));
      }

      if (result.valid) {
        console.log("\n✅ Backup válido e pronto para restauração!");
        console.log("\nPara restaurar, use:");
        console.log(`  gcloud firestore import gs://${BUCKET_NAME}/${result.backupName} --database=test-restore`);
      } else {
        console.log("\n❌ Backup inválido - não recomendado restaurar");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ Erro fatal:", error);
      process.exit(1);
    });
}

export { validateBackup };

