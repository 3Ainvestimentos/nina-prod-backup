import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ProjectErrors,
  mapFirestoreError,
  logProjectSuccess,
  logValidationError,
} from "./project-errors";

describe("ProjectErrors", () => {
  it("expõe estrutura code, title, message, action para erros de permissão", () => {
    expect(ProjectErrors.PERMISSION_NOT_LEADER).toMatchObject({
      code: "PERMISSION_NOT_LEADER",
      title: expect.any(String),
      message: expect.any(String),
      action: expect.any(String),
    });
  });

  it("expõe FIRESTORE_PERMISSION_DENIED", () => {
    expect(ProjectErrors.FIRESTORE_PERMISSION_DENIED.code).toBe(
      "FIRESTORE_PERMISSION_DENIED"
    );
  });

  it("expõe UNKNOWN_ERROR como fallback", () => {
    expect(ProjectErrors.UNKNOWN_ERROR.code).toBe("UNKNOWN_ERROR");
  });
});

describe("mapFirestoreError", () => {
  const consoleSpy = {
    group: vi.fn(),
    groupEnd: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(console, "group").mockImplementation(consoleSpy.group);
    vi.spyOn(console, "groupEnd").mockImplementation(consoleSpy.groupEnd);
    vi.spyOn(console, "error").mockImplementation(consoleSpy.error);
    vi.spyOn(console, "warn").mockImplementation(consoleSpy.warn);
    vi.spyOn(console, "log").mockImplementation(consoleSpy.log);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna FIRESTORE_PERMISSION_DENIED para permission-denied", () => {
    const result = mapFirestoreError(
      { code: "permission-denied", message: "Missing or insufficient permissions" },
      "test"
    );
    expect(result).toBe(ProjectErrors.FIRESTORE_PERMISSION_DENIED);
  });

  it("retorna FIRESTORE_PERMISSION_DENIED quando message inclui insufficient permissions", () => {
    const result = mapFirestoreError(
      { code: "other", message: "Missing or insufficient permissions" },
      "test"
    );
    expect(result).toBe(ProjectErrors.FIRESTORE_PERMISSION_DENIED);
  });

  it("retorna FIRESTORE_NOT_FOUND para not-found", () => {
    const result = mapFirestoreError({ code: "not-found", message: "" }, "test");
    expect(result).toBe(ProjectErrors.FIRESTORE_NOT_FOUND);
  });

  it("retorna FIRESTORE_NETWORK_ERROR para unavailable", () => {
    const result = mapFirestoreError(
      { code: "unavailable", message: "" },
      "test"
    );
    expect(result).toBe(ProjectErrors.FIRESTORE_NETWORK_ERROR);
  });

  it("retorna FIRESTORE_NETWORK_ERROR quando message inclui network", () => {
    const result = mapFirestoreError(
      { code: "other", message: "network error" },
      "test"
    );
    expect(result).toBe(ProjectErrors.FIRESTORE_NETWORK_ERROR);
  });

  it("retorna FIRESTORE_SAVE_ERROR para failed-precondition", () => {
    const result = mapFirestoreError(
      { code: "failed-precondition", message: "" },
      "test"
    );
    expect(result).toBe(ProjectErrors.FIRESTORE_SAVE_ERROR);
  });

  it("retorna FIRESTORE_SAVE_ERROR para aborted", () => {
    const result = mapFirestoreError(
      { code: "aborted", message: "" },
      "test"
    );
    expect(result).toBe(ProjectErrors.FIRESTORE_SAVE_ERROR);
  });

  it("retorna UNKNOWN_ERROR para erro não mapeado", () => {
    const result = mapFirestoreError(
      { code: "unknown-code", message: "anything" },
      "test"
    );
    expect(result).toBe(ProjectErrors.UNKNOWN_ERROR);
  });

  it("não quebra quando error é null/undefined", () => {
    const result = mapFirestoreError(null as any, "test");
    expect(result).toBe(ProjectErrors.UNKNOWN_ERROR);
  });
});

describe("logProjectSuccess", () => {
  it("chama console.group e groupEnd sem lançar", () => {
    const group = vi.spyOn(console, "group").mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    logProjectSuccess("create", { id: "1" });
    expect(group).toHaveBeenCalled();
    expect(groupEnd).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

describe("logValidationError", () => {
  it("chama console.group e groupEnd sem lançar", () => {
    const group = vi.spyOn(console, "group").mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logValidationError("name", "", "string");
    expect(group).toHaveBeenCalled();
    expect(groupEnd).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
