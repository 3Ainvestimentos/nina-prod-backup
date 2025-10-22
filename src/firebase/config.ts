import { config } from 'dotenv';
config();
export const firebaseConfig = {
  "projectId": "studio-9152494730-25d31",
  "appId": "1:148437696289:web:c65f336161a04b937c4860",
  "apiKey": process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  "authDomain": "studio-9152494730-25d31.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "148437696289"
};