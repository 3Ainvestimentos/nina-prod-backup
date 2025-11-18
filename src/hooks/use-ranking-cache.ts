import { useState, useEffect } from 'react';
import type { Interaction, PDIAction } from '@/lib/types';

const CACHE_KEY = 'ranking-data-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface RankingCacheData {
  interactions: Map<string, Interaction[]>;
  pdiActions: Map<string, PDIAction[]>;
  timestamp: number;
  employeeIds: string[];
}

/**
 * Hook para gerenciar cache de dados do ranking
 * Guarda em localStorage para persistir entre sessões
 */
export function useRankingCache() {
  const [cachedData, setCachedData] = useState<RankingCacheData | null>(null);

  // Carregar cache do localStorage ao montar
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        
        // Verificar se cache ainda é válido (não expirou)
        if (parsed.timestamp && (now - parsed.timestamp < CACHE_DURATION)) {
          console.log('✅ [RANKING_CACHE] Cache válido encontrado', {
            age: Math.round((now - parsed.timestamp) / 1000) + 's',
            employees: parsed.employeeIds?.length || 0,
          });
          
          // Reconverter arrays para Maps
          const data: RankingCacheData = {
            interactions: new Map(Object.entries(parsed.interactions || {})),
            pdiActions: new Map(Object.entries(parsed.pdiActions || {})),
            timestamp: parsed.timestamp,
            employeeIds: parsed.employeeIds || [],
          };
          
          setCachedData(data);
        } else {
          console.log('⚠️ [RANKING_CACHE] Cache expirado, removendo');
          localStorage.removeItem(CACHE_KEY);
        }
      } else {
        console.log('ℹ️ [RANKING_CACHE] Nenhum cache encontrado');
      }
    } catch (error) {
      console.error('❌ [RANKING_CACHE] Erro ao carregar cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  const saveCache = (
    interactions: Map<string, Interaction[]>,
    pdiActions: Map<string, PDIAction[]>,
    employeeIds: string[]
  ) => {
    try {
      const data = {
        interactions: Object.fromEntries(interactions),
        pdiActions: Object.fromEntries(pdiActions),
        timestamp: Date.now(),
        employeeIds,
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      
      console.log('💾 [RANKING_CACHE] Cache salvo com sucesso', {
        employees: employeeIds.length,
        size: new Blob([JSON.stringify(data)]).size + ' bytes',
      });
      
      setCachedData({
        interactions,
        pdiActions,
        timestamp: data.timestamp,
        employeeIds,
      });
    } catch (error) {
      console.error('❌ [RANKING_CACHE] Erro ao salvar cache:', error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setCachedData(null);
    console.log('🗑️ [RANKING_CACHE] Cache limpo');
  };

  return {
    cachedData,
    saveCache,
    clearCache,
    hasFreshCache: cachedData !== null,
  };
}

