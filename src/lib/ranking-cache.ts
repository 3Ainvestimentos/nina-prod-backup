import type { Interaction, PDIAction } from "./types";

export const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

export interface RankingCacheData {
  interactions: Map<string, Interaction[]>;
  pdiActions: Map<string, PDIAction[]>;
  timestamp: number;
  employeeIds: string[];
  bonusEnabled?: boolean;
}

/**
 * Indica se o cache está expirado com base no timestamp e na duração.
 */
export function isCacheExpired(
  parsedTimestamp: number,
  now: number,
  cacheDurationMs: number = CACHE_DURATION_MS
): boolean {
  return Boolean(parsedTimestamp && now - parsedTimestamp >= cacheDurationMs);
}

/**
 * Indica se a configuração de bônus mudou desde que o cache foi criado.
 */
export function isBonusConfigChanged(
  parsedBonusEnabled: boolean | undefined,
  currentBonusEnabled: boolean | undefined
): boolean {
  return (
    currentBonusEnabled !== undefined &&
    parsedBonusEnabled !== currentBonusEnabled
  );
}

/**
 * Converte o payload parseado do localStorage em RankingCacheData.
 * Retorna null se o payload for inválido.
 */
export function parseRankingCachePayload(
  parsed: Record<string, unknown>
): RankingCacheData | null {
  const timestamp =
    typeof parsed.timestamp === "number" ? parsed.timestamp : 0;
  const employeeIds = Array.isArray(parsed.employeeIds)
    ? (parsed.employeeIds as string[])
    : [];
  const bonusEnabled =
    typeof parsed.bonusEnabled === "boolean" ? parsed.bonusEnabled : undefined;

  const interactions =
    parsed.interactions && typeof parsed.interactions === "object"
      ? new Map(
          Object.entries(parsed.interactions as Record<string, Interaction[]>)
        )
      : new Map<string, Interaction[]>();

  const pdiActions =
    parsed.pdiActions && typeof parsed.pdiActions === "object"
      ? new Map(
          Object.entries(parsed.pdiActions as Record<string, PDIAction[]>)
        )
      : new Map<string, PDIAction[]>();

  return {
    interactions,
    pdiActions,
    timestamp,
    employeeIds,
    bonusEnabled,
  };
}
