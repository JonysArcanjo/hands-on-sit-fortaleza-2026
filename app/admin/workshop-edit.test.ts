import { describe, expect, it } from "vitest";
import { workshopChangesFromForm } from "./workshop-edit";

describe("workshop inline editing", () => {
  it("builds the editable workshop fields from the submitted form", () => {
    const form = new FormData();
    form.set("title", "Clean Core atualizado");
    form.set("instructor", "Camila Nogueira");
    form.set("room", "Sala Mobile");
    form.set("capacity", "25");

    expect(workshopChangesFromForm(form)).toEqual({
      title: "Clean Core atualizado",
      instructor: "Camila Nogueira",
      room: "Sala Mobile",
      capacity: 25,
    });
  });
});
