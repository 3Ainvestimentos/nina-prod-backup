import { useState, useEffect } from 'react';
import type { Interaction, PDIAction } from '@/lib/types';

const CACHE_KEY = 'ranking-data-cache';
const CACHE_CONFIG_KEY = 'ranking-bonus-config'; // Guarda o estado da config quando o cache foi criado
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface RankingCacheData {
  interactions: Map<string, Interaction[]>;
  pdiActions: Map<string, PDIAction[]>;
  timestamp: number;
  employeeIds: string[];
  bonusEnabled?: boolean; // Estado do bônus quando o cache foi criado
}

/**
 * Hook para gerenciar cache de dados do ranking
 * Guarda em localStorage para persistir entre sessões
 * @param currentBonusEnabled - Estado atual da flag de bônus (para invalidar cache se mudar)
 */
export function useRankingCache(currentBonusEnabled?: boolean) {
  const [cachedData, setCachedData] = useState<RankingCacheData | null>(null);

  // Carregar cache do localStorage ao montar
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        
        // Verificar se cache ainda é válido (não expirou)
        const isExpired = parsed.timestamp && (now - parsed.timestamp >= CACHE_DURATION);
        
        // Verificar se a configuração de bônus mudou desde que o cache foi criado
        const bonusConfigChanged = currentBonusEnabled !== undefined && parsed.bonusEnabled !== currentBonusEnabled;
        
        if (isExpired) {
          console.log('⚠️ [RANKING_CACHE] Cache expirado, removendo');
          localStorage.removeItem(CACHE_KEY);
        } else if (bonusConfigChanged) {
          console.log('⚠️ [RANKING_CACHE] Configuração de bônus mudou, invalidando cache');
          localStorage.removeItem(CACHE_KEY);
        } else if (parsed.timestamp && (now - parsed.timestamp < CACHE_DURATION)) {
          console.log('✅ [RANKING_CACHE] Cache válido encontrado', {
            age: Math.round((now - parsed.timestamp) / 1000) + 's',
            employees: parsed.employeeIds?.length || 0,
            bonusEnabled: parsed.bonusEnabled,
          });
          
          // Reconverter arrays para Maps
          const data: RankingCacheData = {
            interactions: new Map(Object.entries(parsed.interactions || {})),
            pdiActions: new Map(Object.entries(parsed.pdiActions || {})),
            timestamp: parsed.timestamp,
            employeeIds: parsed.employeeIds || [],
            bonusEnabled: parsed.bonusEnabled,
          };
          
          setCachedData(data);
        }
      } else {
        console.log('ℹ️ [RANKING_CACHE] Nenhum cache encontrado');
      }
    } catch (error) {
      console.error('❌ [RANKING_CACHE] Erro ao carregar cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, [currentBonusEnabled]);

  const saveCache = (
    interactions: Map<string, Interaction[]>,
    pdiActions: Map<string, PDIAction[]>,
    employeeIds: string[],
    bonusEnabled?: boolean
  ) => {
    try {
      const data = {
        interactions: Object.fromEntries(interactions),
        pdiActions: Object.fromEntries(pdiActions),
        timestamp: Date.now(),
        employeeIds,
        bonusEnabled,
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      
      console.log('💾 [RANKING_CACHE] Cache salvo com sucesso', {
        employees: employeeIds.length,
        size: new Blob([JSON.stringify(data)]).size + ' bytes',
        bonusEnabled,
      });
      
      setCachedData({
        interactions,
        pdiActions,
        timestamp: data.timestamp,
        employeeIds,
        bonusEnabled,
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

