"use client";

import { useMemoFirebase } from "@/firebase";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { useDoc } from "@/firebase";
import type { PremissasConfig } from "@/lib/types";

/**
 * Hook para ler as configurações de Premissas
 * Lê o documento /configs/premissas
 */
export function usePremissasConfig() {
  const firestore = useFirestore();
  
  const configDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'configs', 'premissas') : null),
    [firestore]
  );
  
  const { data, isLoading, error } = useDoc(configDocRef);
  
  // Valores padrão caso o documento não exista
  const config: PremissasConfig = {
    cdiAnual: data?.cdiAnual ?? 15,
    impostoRepasse: data?.impostoRepasse ?? 19.33,
    multiplicadorB2B: data?.multiplicadorB2B ?? 0.50,
    multiplicadorMINST: data?.multiplicadorMINST ?? 0.25,
  };
  
  return {
    config,
    isLoading,
    error,
  };
}

