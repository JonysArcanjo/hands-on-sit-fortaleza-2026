import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./auth";

describe("admin sessions", () => {
  it("accepts an untampered, unexpired token", async () => {
    const token = await createSessionToken("admin@evento.test", "segredo", 1_000);
    await expect(verifySessionToken(token, "segredo", 2_000)).resolves.toEqual({ email: "admin@evento.test" });
  });

  it("rejects tampered and expired tokens", async () => {
    const token = await createSessionToken("admin@evento.test", "segredo", 1_000);
    await expect(verifySessionToken(`${token}x`, "segredo", 2_000)).resolves.toBeNull();
    await expect(verifySessionToken(token, "segredo", 1_000 + 8 * 60 * 60 * 1_000 + 1)).resolves.toBeNull();
  });
});
