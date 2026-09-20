import { describe, expect, it } from "vitest";
import { defaultWorkshops } from "./default-workshops";

describe("default workshops for a new deployment", () => {
  it("starts with the two Hands-on approved for the event", () => {
    expect(defaultWorkshops.map((workshop) => workshop.title)).toEqual([
      "Clean Core na prática",
      "SAC ANALYTICS CLOUD",
    ]);
    expect(defaultWorkshops.map((workshop) => workshop.capacity)).toEqual([20, 30]);
  });
});
