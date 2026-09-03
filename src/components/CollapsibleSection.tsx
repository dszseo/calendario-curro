import type { ComponentChildren } from 'preact'

export function CollapsibleSection({
  title,
  children,
  open = false,
}: {
  title: string
  children: ComponentChildren
  open?: boolean
}) {
  return (
    <details class="collapse" open={open}>
      <summary>{title}</summary>
      <div style={{ paddingTop: '4px' }}>{children}</div>
    </details>
  )
}
