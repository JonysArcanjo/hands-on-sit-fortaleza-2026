import { describe, expect, it } from "vitest";
import { decideRegistration } from "./registration";

describe("registration decisions", () => {
  it("confirms only eligible participants with an available active workshop", () => {
    expect(decideRegistration({ participantExists: true, alreadyRegistered: false, workshopActive: true, capacity: 20, registrations: 19 })).toBe("confirmed");
    expect(decideRegistration({ participantExists: false, alreadyRegistered: false, workshopActive: true, capacity: 20, registrations: 0 })).toBe("not-found");
    expect(decideRegistration({ participantExists: true, alreadyRegistered: true, workshopActive: true, capacity: 20, registrations: 0 })).toBe("already-registered");
    expect(decideRegistration({ participantExists: true, alreadyRegistered: false, workshopActive: false, capacity: 20, registrations: 0 })).toBe("unavailable");
    expect(decideRegistration({ participantExists: true, alreadyRegistered: false, workshopActive: true, capacity: 20, registrations: 20 })).toBe("sold-out");
  });
});
