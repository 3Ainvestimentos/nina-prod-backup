import { describe, it, expect, vi } from "vitest";
import type { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "./error-emitter";

function mockPermissionError(): FirestorePermissionError {
  return {
    name: "FirebaseError",
    message: "test",
    request: {
      auth: null,
      method: "get",
      path: "/databases/(default)/documents/foo",
    },
  } as unknown as FirestorePermissionError;
}

describe("errorEmitter", () => {
  it("chama callback ao emitir permission-error", () => {
    const payload = mockPermissionError();
    const fn = vi.fn();
    errorEmitter.on("permission-error", fn);
    errorEmitter.emit("permission-error", payload);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(payload);
    errorEmitter.off("permission-error", fn);
  });

  it("não chama callback após off", () => {
    const payload = mockPermissionError();
    const fn = vi.fn();
    errorEmitter.on("permission-error", fn);
    errorEmitter.off("permission-error", fn);
    errorEmitter.emit("permission-error", payload);
    expect(fn).not.toHaveBeenCalled();
  });

  it("chama múltiplos listeners no emit", () => {
    const payload = mockPermissionError();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    errorEmitter.on("permission-error", fn1);
    errorEmitter.on("permission-error", fn2);
    errorEmitter.emit("permission-error", payload);
    expect(fn1).toHaveBeenCalledWith(payload);
    expect(fn2).toHaveBeenCalledWith(payload);
    errorEmitter.off("permission-error", fn1);
    errorEmitter.off("permission-error", fn2);
  });

  it("emit sem listeners não quebra", () => {
    const payload = mockPermissionError();
    expect(() =>
      errorEmitter.emit("permission-error", payload)
    ).not.toThrow();
  });
});
