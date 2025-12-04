import { useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import type { Employee, Interaction, PDIAction } from '@/lib/types';

/**
 * Hook para pré-carregar dados de ranking em background
 * Executa uma única vez quando o usuário entra no dashboard
 */
export function usePreloadRanking(employees: Employee[] | null) {
  const firestore = useFirestore();
  const hasPreloadedRef = useRef(false);

  useEffect(() => {
    // Evitar múltiplas execuções
    if (hasPreloadedRef.current || !firestore || !employees) return;
    
    const preloadRankingData = async () => {
      // Marcar como executado
      hasPreloadedRef.current = true;
      
      // Verificar se já tem cache válido
      const CACHE_KEY = 'ranking-data-cache';
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
      
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          
          if (parsed.timestamp && (now - parsed.timestamp < CACHE_DURATION)) {
            console.log('⚡ [PRELOAD] Cache válido já existe, pulando pré-carregamento');
            return;
          }
        }
      } catch (e) {
        // Ignorar erro de parse
      }

      console.log('🔄 [PRELOAD] Iniciando pré-carregamento de dados de ranking em background...');
      console.time('⚡ [PRELOAD] Tempo total');

      const allManagedEmployeeIds = employees
        .filter(e => e.isUnderManagement)
        .map(e => e.id);

      if (allManagedEmployeeIds.length === 0) {
        console.log('ℹ️ [PRELOAD] Nenhum colaborador sob gestão');
        return;
      }

      try {
        // Fazer TODAS as requisições em PARALELO
        const allPromises = allManagedEmployeeIds.map(async (id) => {
          const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
          const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));
          
          const [interactionsSnapshot, pdiActionsSnapshot] = await Promise.all([
            getDocs(interactionsQuery),
            getDocs(pdiActionsQuery)
          ]);

          return {
            id,
            interactions: interactionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Interaction),
            pdiActions: pdiActionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as PDIAction),
          };
        });

        const results = await Promise.all(allPromises);

        // Construir mapas
        const interactionsMap = new Map<string, Interaction[]>();
        const pdiMap = new Map<string, PDIAction[]>();

        results.forEach(({ id, interactions, pdiActions }) => {
          interactionsMap.set(id, interactions);
          pdiMap.set(id, pdiActions);
        });

        // Salvar no localStorage
        const cacheData = {
          interactions: Object.fromEntries(interactionsMap),
          pdiActions: Object.fromEntries(pdiMap),
          timestamp: Date.now(),
          employeeIds: allManagedEmployeeIds,
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        console.timeEnd('⚡ [PRELOAD] Tempo total');
        console.log(`✅ [PRELOAD] Pré-carregamento concluído! ${results.length} colaboradores em cache`);
      } catch (error) {
        console.error('❌ [PRELOAD] Erro no pré-carregamento:', error);
      }
    };

    // Executar após um delay maior para não competir com fetches principais do dashboard
    const timeoutId = setTimeout(() => {
      preloadRankingData();
    }, 5000); // 5 segundos após login - dá tempo para dashboard carregar primeiro

    return () => clearTimeout(timeoutId);
  }, [firestore, employees]);
}

