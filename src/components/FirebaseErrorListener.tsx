'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      // Set error in state to trigger a re-render.
      setError(error);
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // Em vez de lançar globalmente (gera ruído em condições de corrida),
  // apenas registra de forma discreta e não interrompe o app.
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      // Em dev, log detalhado ajuda rastrear a origem
      // eslint-disable-next-line no-console
      console.warn('FirestorePermissionError (suprimido):', error);
    }
    // Suprimir o erro e não lançar
    return null;
  }

  // This component renders nothing.
  return null;
}
