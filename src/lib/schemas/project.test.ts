import { describe, it, expect } from "vitest";
import { projectFormSchema } from "./project";

describe("projectFormSchema", () => {
  it("aceita dados válidos", () => {
    const result = projectFormSchema.safeParse({
      name: "Projeto X",
      description: "Descrição com mais de dez caracteres.",
      memberIds: ["id1"],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita nome com menos de 3 caracteres", () => {
    const result = projectFormSchema.safeParse({
      name: "ab",
      description: "Descrição longa aqui.",
      memberIds: ["id1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita descrição com menos de 10 caracteres", () => {
    const result = projectFormSchema.safeParse({
      name: "Projeto",
      description: "curta",
      memberIds: ["id1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita memberIds vazio", () => {
    const result = projectFormSchema.safeParse({
      name: "Projeto",
      description: "Descrição com mais de dez caracteres.",
      memberIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("aceita leaderId opcional", () => {
    const result = projectFormSchema.safeParse({
      name: "Projeto",
      description: "Descrição com mais de dez caracteres.",
      leaderId: "leader-1",
      memberIds: ["id1"],
    });
    expect(result.success).toBe(true);
  });
});
