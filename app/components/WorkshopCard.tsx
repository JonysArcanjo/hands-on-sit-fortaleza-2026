type Workshop = { id: number; title: string; description: string; instructor: string; startsAt: string; room: string; capacity: number; registrations: number };

export function WorkshopCard({ workshop, selected, onSelect }: { workshop: Workshop; selected: boolean; onSelect: () => void }) {
  const registrations = Number(workshop.registrations);
  const remaining = Math.max(0, workshop.capacity - registrations);
  const soldOut = remaining === 0;
  return (
    <button type="button" className={`workshop-card ${selected ? "selected" : ""}`} onClick={onSelect} disabled={soldOut} aria-pressed={selected}>
      <div className="card-top"><span className={`availability ${soldOut ? "sold-out" : ""}`}>{soldOut ? "Esgotado" : `${remaining} vagas`}</span><span>31/10/2026</span></div>
      <h3>{workshop.title}</h3><p>{workshop.description}</p>
      <div className="workshop-meta"><span><b>Instrutor</b>{workshop.instructor}</span><span><b>Sala</b>{workshop.room}</span></div>
      <div className="capacity"><span style={{ width: `${Math.min(100, (registrations / workshop.capacity) * 100)}%` }} /></div>
      <small>{registrations} de {workshop.capacity} vagas ocupadas</small>
    </button>
  );
}
