'use client';

import { Auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';

type LoginStatus =
  | 'ok'
  | 'cancelled'
  | 'redirect'
  | 'in_progress';

interface LoginOptions {
  domain?: string;
}

let signInInProgress = false;

/**
 * Executa login com Google garantindo chamada única e com fallback para redirect
 * quando popup é bloqueado. Retorna um status descritivo para o chamador decidir UI.
 */
export async function loginWithGoogle(auth: Auth, options?: LoginOptions): Promise<{ status: LoginStatus }> {
  if (signInInProgress) {
    return { status: 'in_progress' };
  }
  signInInProgress = true;

  const provider = new GoogleAuthProvider();
  const params: Record<string, string> = { prompt: 'select_account' };
  if (options?.domain) params['hd'] = options.domain;
  provider.setCustomParameters(params);

  try {
    await signInWithPopup(auth, provider);
    return { status: 'ok' };
  } catch (error: any) {
    const code = String(error?.code || '');

    if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
      return { status: 'cancelled' };
    }

    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return { status: 'redirect' };
    }

    // Propaga outros erros para que o chamador possa exibir mensagem adequada
    throw error;
  } finally {
    signInInProgress = false;
  }
}


