import { describe, it, expect } from "vitest";
import { diagnosisSchema } from "./diagnosis";

describe("diagnosisSchema", () => {
  it("aceita dados válidos", () => {
    const result = diagnosisSchema.safeParse({
      status: "Pendente",
      details: "Algum detalhe",
    });
    expect(result.success).toBe(true);
  });

  it("aceita details opcional", () => {
    const result = diagnosisSchema.safeParse({ status: "Concluído" });
    expect(result.success).toBe(true);
  });

  it("rejeita status inválido", () => {
    const result = diagnosisSchema.safeParse({
      status: "Invalido",
      details: "",
    });
    expect(result.success).toBe(false);
  });

  it("aceita todos os status válidos", () => {
    const statuses = ["Pendente", "Em Andamento", "Concluído"] as const;
    for (const status of statuses) {
      const result = diagnosisSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});
