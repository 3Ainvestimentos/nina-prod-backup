'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

function hasValidFirebaseConfig(config: Record<string, unknown>): boolean {
  return Boolean(config?.apiKey && config?.projectId);
}

export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp: FirebaseApp;
    try {
      // Firebase App Hosting injects options automatically; when not on App Hosting (e.g. Vercel), this throws.
      firebaseApp = initializeApp();
    } catch (e) {
      // Fallback: use explicit config. Required when deploying to Vercel etc.
      if (!hasValidFirebaseConfig(firebaseConfig as Record<string, unknown>)) {
        const msg =
          "Firebase config incompleto. No Vercel (e em produção), defina as variáveis de ambiente: NEXT_PUBLIC_FIREBASE_API_KEY e, se necessário, authDomain, projectId, appId.";
        if (process.env.NODE_ENV === "production") {
          console.error(msg);
        }
        throw new Error(msg);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
