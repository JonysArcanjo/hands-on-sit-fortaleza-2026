import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParticipantDeletionControls } from "./ParticipantDeletionControls";

describe("participant deletion controls", () => {
  it("starts with a single destructive action", () => {
    const html = renderToStaticMarkup(<ParticipantDeletionControls
      armed={false}
      disabled={false}
      onArm={() => undefined}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />);

    expect(html).toContain("Excluir participantes importados");
    expect(html).not.toContain("Confirmar exclusão");
  });

  it("requires an explicit second confirmation and offers cancellation", () => {
    const html = renderToStaticMarkup(<ParticipantDeletionControls
      armed
      disabled={false}
      onArm={() => undefined}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />);

    expect(html).toContain("participantes e suas inscrições");
    expect(html).toContain("Confirmar exclusão");
    expect(html).toContain("Cancelar");
  });
});
