// functions/src/admin-app.ts
import * as admin from "firebase-admin";
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
export { admin, db, FieldValue };
