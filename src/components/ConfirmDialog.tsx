export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Eliminar',
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div class="dialog-backdrop" onClick={onCancel}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div class="actions">
          <button class="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button class={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
