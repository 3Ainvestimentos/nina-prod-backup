import { describe, it, expect } from "vitest";
import {
  CACHE_DURATION_MS,
  isCacheExpired,
  isBonusConfigChanged,
  parseRankingCachePayload,
} from "./ranking-cache";

describe("ranking-cache", () => {
  describe("CACHE_DURATION_MS", () => {
    it("é 5 minutos em ms", () => {
      expect(CACHE_DURATION_MS).toBe(5 * 60 * 1000);
    });
  });

  describe("isCacheExpired", () => {
    it("retorna true quando passou da duração", () => {
      const now = 10000;
      const timestamp = now - CACHE_DURATION_MS - 1000;
      expect(isCacheExpired(timestamp, now)).toBe(true);
    });

    it("retorna false quando ainda dentro da duração", () => {
      const now = 10000;
      const timestamp = now - 1000;
      expect(isCacheExpired(timestamp, now)).toBe(false);
    });

    it("retorna false quando timestamp é 0", () => {
      expect(isCacheExpired(0, Date.now())).toBe(false);
    });

    it("respeita cacheDurationMs customizado", () => {
      const now = 1000;
      const timestamp = 400; // 600ms atrás
      expect(isCacheExpired(timestamp, now, 500)).toBe(true);
      expect(isCacheExpired(timestamp, now, 2000)).toBe(false);
    });
  });

  describe("isBonusConfigChanged", () => {
    it("retorna true quando currentBonusEnabled difere de parsed", () => {
      expect(isBonusConfigChanged(false, true)).toBe(true);
      expect(isBonusConfigChanged(true, false)).toBe(true);
    });

    it("retorna false quando são iguais", () => {
      expect(isBonusConfigChanged(true, true)).toBe(false);
      expect(isBonusConfigChanged(false, false)).toBe(false);
    });

    it("retorna false quando currentBonusEnabled é undefined", () => {
      expect(isBonusConfigChanged(true, undefined)).toBe(false);
    });

    it("retorna true quando parsed é undefined e current é definido", () => {
      expect(isBonusConfigChanged(undefined, true)).toBe(true);
    });
  });

  describe("parseRankingCachePayload", () => {
    it("converte interactions e pdiActions para Map", () => {
      const parsed = {
        timestamp: 1000,
        employeeIds: ["e1"],
        interactions: { e1: [{ id: "i1", notes: "x", date: "2025-01-01", type: "1:1" }] },
        pdiActions: { e1: [{ id: "p1", description: "d", startDate: "2025-01-01", endDate: "2025-06-01", status: "To Do" }] },
      };
      const result = parseRankingCachePayload(parsed);
      expect(result).not.toBeNull();
      expect(result!.interactions.get("e1")).toHaveLength(1);
      expect(result!.pdiActions.get("e1")).toHaveLength(1);
      expect(result!.timestamp).toBe(1000);
      expect(result!.employeeIds).toEqual(["e1"]);
    });

    it("retorna bonusEnabled quando boolean", () => {
      const result = parseRankingCachePayload({
        timestamp: 0,
        employeeIds: [],
        bonusEnabled: true,
      });
      expect(result!.bonusEnabled).toBe(true);
    });

    it("retorna Maps vazios quando interactions/pdiActions ausentes", () => {
      const result = parseRankingCachePayload({
        timestamp: 0,
        employeeIds: [],
      });
      expect(result).not.toBeNull();
      expect(result!.interactions.size).toBe(0);
      expect(result!.pdiActions.size).toBe(0);
      expect(result!.employeeIds).toEqual([]);
    });

    it("trata employeeIds não-array como array vazio", () => {
      const result = parseRankingCachePayload({
        timestamp: 0,
        employeeIds: "not-array",
      } as any);
      expect(result!.employeeIds).toEqual([]);
    });
  });
});
