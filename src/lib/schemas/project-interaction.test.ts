import { describe, it, expect } from "vitest";
import { projectInteractionFormSchema } from "./project-interaction";

describe("projectInteractionFormSchema", () => {
  it("aceita dados válidos", () => {
    const result = projectInteractionFormSchema.safeParse({
      type: "1:1",
      targetMemberId: "member-1",
      content: "Anotações com pelo menos cinco caracteres.",
      indicator: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita targetMemberId vazio", () => {
    const result = projectInteractionFormSchema.safeParse({
      type: "1:1",
      targetMemberId: "",
      content: "Anotações com pelo menos cinco caracteres.",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita content com menos de 5 caracteres", () => {
    const result = projectInteractionFormSchema.safeParse({
      type: "1:1",
      targetMemberId: "m1",
      content: "1234",
    });
    expect(result.success).toBe(false);
  });

  it("aceita indicator opcional", () => {
    const result = projectInteractionFormSchema.safeParse({
      type: "1:1",
      targetMemberId: "m1",
      content: "Cinco chars.",
    });
    expect(result.success).toBe(true);
  });
});
