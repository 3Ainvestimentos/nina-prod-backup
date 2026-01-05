// functions/src/index.ts
// Exportações diretas - sem Lazy Loading

// Administrativo
export { setAdminClaim } from "./admin-functions";
export { setupFirstAdmin } from "./setup-admin";
export { listAdminClaims } from "./list-admin-claims";

// Autenticação Google
export { googleAuthInit, googleAuthCallback } from "./google-auth";

// Migrações
export { migrateGoogleAuthTokens, migrateTokensToEncrypted } from "./migrations";

// Backups
export { triggerManualBackup, listAllBackups, testRestore, deleteBackup } from "./backup-manager";

// Triggers Firestore
export { onInteractionCreate, onPdiWrite } from "./triggers";
