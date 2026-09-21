import type { RegistrationSummary as Registration } from "../lib/participant-status";

function eventDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function RegistrationSummary({
  registrations,
  maximum,
  remaining,
}: {
  registrations: Registration[];
  maximum: number;
  remaining: number;
}) {
  return <section className="registration-summary" aria-live="polite">
    <div className="registration-balance">
      <span>{registrations.length} de {maximum} inscrições utilizadas</span>
      <strong>{remaining > 0
        ? `Você pode escolher mais ${remaining} Hands-on`
        : "Você atingiu o limite de inscrições"}</strong>
    </div>
    {registrations.length > 0 && <div className="registration-summary-list">
      {registrations.map((registration) => <article key={registration.id}>
        <span className="confirmation-mark" aria-hidden="true">✓</span>
        <div><h3>{registration.title}</h3><p>{registration.instructor}</p><p>{eventDate(registration.startsAt)}</p><b>{registration.room}</b></div>
      </article>)}
    </div>}
  </section>;
}
