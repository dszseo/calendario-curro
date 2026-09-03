import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { registerSW } from 'virtual:pwa-register'
import { toastMessage } from './lib/toast'

function useUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null)
  useEffect(() => {
    const fn = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
    })
    setUpdateSW(() => fn)
  }, [])
  return { needRefresh, apply: () => updateSW?.() }
}

export function Shell({ children }: { children: ComponentChildren }) {
  const { needRefresh, apply } = useUpdatePrompt()

  return (
    <div class="app-shell">
      <header class="topbar">
        <h1>Calendario Curro</h1>
      </header>

      <main class="content">{children}</main>

      {toastMessage.value && <div class="toast">{toastMessage.value}</div>}

      {needRefresh && (
        <div class="update-bar">
          <span>Hay una versión nueva de la app.</span>
          <button onClick={apply}>Actualizar</button>
        </div>
      )}
    </div>
  )
}
