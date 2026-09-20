import { describe, expect, it } from "vitest";
import { isRegistrationOpen } from "./registration-deadline";

describe("registration deadline", () => {
  it("keeps registration open through 23:59 in Fortaleza on the deadline", () => {
    expect(isRegistrationOpen("2026-10-20", new Date("2026-10-21T02:59:59.999Z"))).toBe(true);
  });

  it("closes registration at midnight in Fortaleza after the deadline", () => {
    expect(isRegistrationOpen("2026-10-20", new Date("2026-10-21T03:00:00.000Z"))).toBe(false);
  });

  it("keeps registration open when no deadline is configured", () => {
    expect(isRegistrationOpen(null, new Date("2030-01-01T00:00:00.000Z"))).toBe(true);
  });
});
