import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParticipantChoice } from "./ParticipantChoice";
import { RegistrationSummary } from "./RegistrationSummary";

describe("shared email registration components", () => {
  it("renders every registered name as an accessible choice", () => {
    const html = renderToStaticMarkup(<ParticipantChoice
      participants={[{ id: 1, name: "João Victor" }, { id: 2, name: "Jonys Arcanjo" }]}
      disabled={false}
      onSelect={() => undefined}
    />);

    expect(html).toContain("<legend>Selecione seu nome</legend>");
    expect(html).toContain(">João Victor<");
    expect(html).toContain(">Jonys Arcanjo<");
    expect((html.match(/<button/g) ?? [])).toHaveLength(2);
  });

  it("summarizes registrations and the remaining personal limit without a session time", () => {
    const html = renderToStaticMarkup(<RegistrationSummary
      registrations={[{
        id: 9,
        workshopId: 3,
        title: "Clean Core na prática",
        instructor: "Equipe SIT",
        startsAt: "2026-10-31",
        room: "Sala 1",
        createdAt: "2026-09-20 20:00:00",
      }]}
      maximum={2}
      remaining={1}
    />);

    expect(html).toContain("Clean Core na prática");
    expect(html).toContain("31 de outubro de 2026");
    expect(html).toContain("Você pode escolher mais 1 Hands-on");
    expect(html).not.toMatch(/20:00|10:30|14:00/);
  });
});
