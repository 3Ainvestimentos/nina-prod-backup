import { describe, it, expect } from "vitest";
import { cn, formatDate } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("combina classes corretamente", () => {
      expect(cn("a", "b")).toBe("a b");
    });

    it("aplica tailwind-merge para conflitos", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
    });

    it("aceita condicionais", () => {
      expect(cn("base", false && "hidden", true && "block")).toBe("base block");
    });
  });

  describe("formatDate", () => {
    it("formata Date para pt-BR", () => {
      const d = new Date("2025-03-04T12:00:00Z");
      const result = formatDate(d);
      expect(result).toMatch(/março|março de 2025/);
      expect(result).toContain("2025");
      expect(result).toMatch(/\d{1,2}/);
    });

    it("formata string ISO para pt-BR", () => {
      const result = formatDate("2025-01-15");
      expect(result).toMatch(/janeiro|15|2025/);
    });

    it("formata number (timestamp) para pt-BR", () => {
      const result = formatDate(new Date("2025-06-10").getTime());
      expect(result).toMatch(/junho|10|2025/);
    });

    it("lança em data inválida", () => {
      expect(() => formatDate("invalid")).toThrow(RangeError);
    });
  });
});
