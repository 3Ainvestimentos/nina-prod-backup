import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirestorePermissionError } from "./errors";

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
}));

describe("FirestorePermissionError", () => {
  beforeEach(async () => {
    const { getAuth } = await import("firebase/auth");
    vi.mocked(getAuth).mockReturnValue({ currentUser: null } as any);
  });

  it("instância tem .request com auth, method e path", () => {
    const err = new FirestorePermissionError({
      path: "projects/abc",
      operation: "get",
    });
    expect(err.request).toBeDefined();
    expect(err.request.auth).toBeNull();
    expect(err.request.method).toBe("get");
    expect(err.request.path).toBe(
      "/databases/(default)/documents/projects/abc"
    );
  });

  it("mensagem contém o JSON do request", () => {
    const err = new FirestorePermissionError({
      path: "employees/1",
      operation: "update",
    });
    expect(err.message).toContain("Missing or insufficient permissions");
    expect(err.message).toContain("/databases/(default)/documents/employees/1");
    expect(err.message).toContain("update");
  });

  it("name é FirebaseError", () => {
    const err = new FirestorePermissionError({
      path: "x",
      operation: "create",
    });
    expect(err.name).toBe("FirebaseError");
  });

  it("inclui requestResourceData no request quando informado", () => {
    const err = new FirestorePermissionError({
      path: "projects/1",
      operation: "create",
      requestResourceData: { name: "Projeto X" },
    });
    expect(err.request.resource).toEqual({ data: { name: "Projeto X" } });
  });
});
