"use client";

import { useMemoFirebase } from "@/firebase";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { useDoc } from "@/firebase";

/**
 * Hook para ler as configurações gerais do aplicativo
 * Lê o documento /configs/general
 */
export function useAppConfig() {
  const firestore = useFirestore();
  
  const configDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'configs', 'general') : null),
    [firestore]
  );
  
  const { data, isLoading, error } = useDoc(configDocRef);
  
  return {
    rankingBonusEnabled: data?.rankingBonusEnabled ?? false,
    maintenanceMode: data?.maintenanceMode ?? false,
    isLoading,
    error,
  };
}

