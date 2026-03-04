import { describe, it, expect } from "vitest";
import { projectInteractionEditSchema } from "./project-interaction-edit";

describe("projectInteractionEditSchema", () => {
  it("aceita dados válidos", () => {
    const result = projectInteractionEditSchema.safeParse({
      content: "Anotações com pelo menos cinco caracteres.",
      indicator: "opcional",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita content com menos de 5 caracteres", () => {
    const result = projectInteractionEditSchema.safeParse({
      content: "1234",
    });
    expect(result.success).toBe(false);
  });

  it("aceita só content", () => {
    const result = projectInteractionEditSchema.safeParse({
      content: "Cinco caracteres aqui.",
    });
    expect(result.success).toBe(true);
  });
});
