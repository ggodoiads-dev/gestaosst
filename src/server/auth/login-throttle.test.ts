import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/db", () => ({ db: {} }));

import { isThrottled, MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP } from "./login-throttle";

describe("isThrottled", () => {
  it("libera enquanto está abaixo dos limites", () => {
    expect(isThrottled(MAX_FAILURES_PER_EMAIL - 1, MAX_FAILURES_PER_IP - 1)).toBe(false);
  });
  it("bloqueia ao estourar o limite por e-mail", () => {
    expect(isThrottled(MAX_FAILURES_PER_EMAIL, 0)).toBe(true);
  });
  it("bloqueia ao estourar o limite por endereço", () => {
    expect(isThrottled(0, MAX_FAILURES_PER_IP)).toBe(true);
  });
});
