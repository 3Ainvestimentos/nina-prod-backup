import { describe, it, expect } from "vitest";
import { employeeFormSchema } from "./employee";

describe("employeeFormSchema", () => {
  it("aceita dados válidos", () => {
    const result = employeeFormSchema.safeParse({
      id3a: "123",
      name: "João",
      email: "joao@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita id3a vazio", () => {
    const result = employeeFormSchema.safeParse({
      id3a: "",
      name: "João",
      email: "joao@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name vazio", () => {
    const result = employeeFormSchema.safeParse({
      id3a: "1",
      name: "",
      email: "joao@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita email inválido", () => {
    const result = employeeFormSchema.safeParse({
      id3a: "1",
      name: "João",
      email: "nao-e-email",
    });
    expect(result.success).toBe(false);
  });

  it("aceita photoURL vazia", () => {
    const result = employeeFormSchema.safeParse({
      id3a: "1",
      name: "João",
      email: "joao@example.com",
      photoURL: "",
    });
    expect(result.success).toBe(true);
  });

  it("aceita photoURL como URL válida", () => {
    const result = employeeFormSchema.safeParse({
      id3a: "1",
      name: "João",
      email: "joao@example.com",
      photoURL: "https://example.com/photo.jpg",
    });
    expect(result.success).toBe(true);
  });
});
