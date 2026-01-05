// functions/src/admin-app.ts
import * as admin from "firebase-admin";

// Inicialização tradicional e segura
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;

export { admin, db, auth, FieldValue };
