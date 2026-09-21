type Props = {
  armed: boolean;
  disabled: boolean;
  onArm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ParticipantDeletionControls({ armed, disabled, onArm, onCancel, onConfirm }: Props) {
  if (!armed) {
    return <button type="button" className="danger-button participant-delete-button" disabled={disabled} onClick={onArm}>
      Excluir participantes importados
    </button>;
  }

  return <div className="participant-delete-confirmation" role="alert">
    <p>Esta ação excluirá todos os participantes e suas inscrições. Os Hands-on serão preservados.</p>
    <div>
      <button type="button" className="danger-button" disabled={disabled} onClick={onConfirm}>
        {disabled ? "Excluindo…" : "Confirmar exclusão"}
      </button>
      <button type="button" className="text-button" disabled={disabled} onClick={onCancel}>Cancelar</button>
    </div>
  </div>;
}
