import { describe, it, expect } from "vitest";
import { pdiActionSchema } from "./pdi-action";

describe("pdiActionSchema", () => {
  it("aceita dados válidos", () => {
    const result = pdiActionSchema.safeParse({
      description: "Ação de desenvolvimento",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-06-01"),
      status: "In Progress",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita description vazia", () => {
    const result = pdiActionSchema.safeParse({
      description: "",
      startDate: new Date(),
      endDate: new Date(),
      status: "To Do",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita status inválido", () => {
    const result = pdiActionSchema.safeParse({
      description: "Ok",
      startDate: new Date(),
      endDate: new Date(),
      status: "Invalid",
    });
    expect(result.success).toBe(false);
  });

  it("aceita todos os status válidos", () => {
    const statuses = ["To Do", "In Progress", "Completed"] as const;
    for (const status of statuses) {
      const result = pdiActionSchema.safeParse({
        description: "Ação",
        startDate: new Date(),
        endDate: new Date(),
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});
