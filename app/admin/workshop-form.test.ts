import { describe, expect, it, vi } from "vitest";
import { finishWorkshopCreation } from "./workshop-form";

describe("workshop form submission", () => {
  it("resets the submitted form after the asynchronous request finishes", async () => {
    const reset = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);

    await finishWorkshopCreation({ reset }, reload);

    expect(reset).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});
