import { useState, useEffect } from "react";
import {
  CACHE_DURATION_MS,
  type RankingCacheData,
  isCacheExpired,
  isBonusConfigChanged,
  parseRankingCachePayload,
} from "@/lib/ranking-cache";

const CACHE_KEY = "ranking-data-cache";

/**
 * Hook para gerenciar cache de dados do ranking
 * Guarda em localStorage para persistir entre sessões
 * @param currentBonusEnabled - Estado atual da flag de bônus (para invalidar cache se mudar)
 */
export function useRankingCache(currentBonusEnabled?: boolean) {
  const [cachedData, setCachedData] = useState<RankingCacheData | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        const now = Date.now();

        if (isCacheExpired(parsed.timestamp as number, now, CACHE_DURATION_MS)) {
          console.log("⚠️ [RANKING_CACHE] Cache expirado, removendo");
          localStorage.removeItem(CACHE_KEY);
        } else if (
          isBonusConfigChanged(
            parsed.bonusEnabled as boolean | undefined,
            currentBonusEnabled
          )
        ) {
          console.log(
            "⚠️ [RANKING_CACHE] Configuração de bônus mudou, invalidando cache"
          );
          localStorage.removeItem(CACHE_KEY);
        } else if (
          parsed.timestamp &&
          (now - (parsed.timestamp as number) < CACHE_DURATION_MS)
        ) {
          const data = parseRankingCachePayload(parsed);
          if (data) {
            console.log("✅ [RANKING_CACHE] Cache válido encontrado", {
              age:
                Math.round((now - data.timestamp) / 1000) + "s",
              employees: data.employeeIds?.length || 0,
              bonusEnabled: data.bonusEnabled,
            });
            setCachedData(data);
          }
        }
      } else {
        console.log("ℹ️ [RANKING_CACHE] Nenhum cache encontrado");
      }
    } catch (error) {
      console.error("❌ [RANKING_CACHE] Erro ao carregar cache:", error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, [currentBonusEnabled]);

  const saveCache = (
    interactions: RankingCacheData["interactions"],
    pdiActions: RankingCacheData["pdiActions"],
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

      console.log("💾 [RANKING_CACHE] Cache salvo com sucesso", {
        employees: employeeIds.length,
        size: new Blob([JSON.stringify(data)]).size + " bytes",
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
      console.error("❌ [RANKING_CACHE] Erro ao salvar cache:", error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setCachedData(null);
    console.log("🗑️ [RANKING_CACHE] Cache limpo");
  };

  return {
    cachedData,
    saveCache,
    clearCache,
    hasFreshCache: cachedData !== null,
  };
}
