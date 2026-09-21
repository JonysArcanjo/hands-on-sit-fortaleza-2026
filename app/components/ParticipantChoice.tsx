export type ParticipantCandidate = { id: number; name: string };

export function ParticipantChoice({
  participants,
  onSelect,
  disabled,
}: {
  participants: ParticipantCandidate[];
  onSelect: (participantId: number) => void;
  disabled: boolean;
}) {
  return <fieldset className="participant-choice" disabled={disabled}>
    <legend>Selecione seu nome</legend>
    <p>Encontramos mais de uma pessoa com este e-mail. Escolha quem está fazendo a inscrição.</p>
    <div className="participant-choice-list">
      {participants.map((participant) => <button
        type="button"
        key={participant.id}
        onClick={() => onSelect(participant.id)}
      >{participant.name}</button>)}
    </div>
  </fieldset>;
}
