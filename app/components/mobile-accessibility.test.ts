import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile touch targets", () => {
  it("keeps the brand link at least 44 px high", () => {
    const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.brand\{[^}]*min-height:44px/);
  });
});
