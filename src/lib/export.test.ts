import { describe, it, expect } from "vitest";
import { convertToCSV } from "./export";

describe("convertToCSV", () => {
  it("retorna string vazia para array vazio", () => {
    expect(convertToCSV([])).toBe("");
  });

  it("gera header e uma linha para um objeto", () => {
    const data = [{ a: 1, b: "x" }];
    const result = convertToCSV(data);
    expect(result).toContain("a,b");
    expect(result).toContain('"1","x"');
    expect(result.split("\n").length).toBe(2);
  });

  it("gera múltiplas linhas", () => {
    const data = [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ];
    const result = convertToCSV(data);
    const lines = result.split("\n");
    expect(lines[0]).toBe("id,name");
    expect(lines[1]).toBe('"1","A"');
    expect(lines[2]).toBe('"2","B"');
  });

  it("escapa aspas duplas nos valores", () => {
    const data = [{ msg: 'hello "world"' }];
    const result = convertToCSV(data);
    expect(result).toContain('"hello ""world"""');
  });

  it("converte valores não-string para string", () => {
    const data = [{ n: 42, ok: true }];
    const result = convertToCSV(data);
    expect(result).toContain("42");
    expect(result).toContain("true");
  });
});
