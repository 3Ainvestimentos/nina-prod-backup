// functions/src/kms-utils.ts
import { KeyManagementServiceClient } from "@google-cloud/kms";

const client = new KeyManagementServiceClient();

const PROJECT_ID = process.env.GCLOUD_PROJECT || "studio-9152494730-25d31";
const LOCATION = "us-central1";
const KEY_RING = "nina-keyring";
const KEY_NAME = "token-encryption-key";

const keyPath = client.cryptoKeyPath(PROJECT_ID, LOCATION, KEY_RING, KEY_NAME);

// ============================================
// CACHE EM MEMÓRIA (reduz chamadas ao KMS)
// ============================================
const decryptionCache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Criptografa um texto usando Cloud KMS
 * Não usa cache (criptografia é rara)
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error("Plaintext cannot be empty");
  }

  const plaintextBuffer = Buffer.from(plaintext);
  
  const [result] = await client.encrypt({
    name: keyPath,
    plaintext: plaintextBuffer,
  });
  
  // Retorna como base64 para armazenar no Firestore
  return Buffer.from(result.ciphertext as Uint8Array).toString("base64");
}

/**
 * Descriptografa um texto - COM CACHE
 * Evita chamadas repetidas ao KMS para o mesmo token
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    throw new Error("Ciphertext cannot be empty");
  }

  // Verificar cache primeiro
  const cached = decryptionCache.get(ciphertext);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  // Chamar KMS apenas se não estiver em cache
  const ciphertextBuffer = Buffer.from(ciphertext, "base64");
  
  const [result] = await client.decrypt({
    name: keyPath,
    ciphertext: ciphertextBuffer,
  });
  
  const decrypted = Buffer.from(result.plaintext as Uint8Array).toString("utf8");
  
  // Armazenar em cache
  decryptionCache.set(ciphertext, {
    value: decrypted,
    expiry: Date.now() + CACHE_TTL_MS,
  });
  
  return decrypted;
}

/**
 * Verifica se um token está criptografado (prefixo ENC:)
 */
export function isEncrypted(value: string | undefined | null): boolean {
  return !!value && value.startsWith("ENC:");
}

/**
 * Adiciona prefixo para identificar tokens criptografados
 */
export function markAsEncrypted(ciphertext: string): string {
  return `ENC:${ciphertext}`;
}

/**
 * Remove prefixo de tokens criptografados
 */
export function removeEncryptionMark(value: string): string {
  return value.replace(/^ENC:/, "");
}

// Limpar cache expirado periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of decryptionCache.entries()) {
    if (entry.expiry < now) {
      decryptionCache.delete(key);
    }
  }
}, 60 * 1000); // A cada 1 minuto

