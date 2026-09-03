import { signal } from '@preact/signals'
import type { ComponentType } from 'preact'

/**
 * Router basado en hash (#/ruta). Funciona en cualquier subcarpeta (GitHub Pages
 * de proyecto) y sin configuración de servidor, ideal para una PWA offline.
 */

function currentHashPath(): string {
  const h = location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/' + h
}

const path = signal<string>(currentHashPath())

if (typeof window !== 'undefined') {
  addEventListener('hashchange', () => {
    path.value = currentHashPath()
  })
  if (!location.hash) location.replace('#/')
}

export function navigate(to: string, replace = false): void {
  const target = '#' + (to.startsWith('/') ? to : '/' + to)
  if (replace) location.replace(target)
  else location.hash = target
}

export function useLocation() {
  const full = path.value
  const qIndex = full.indexOf('?')
  const pathname = qIndex === -1 ? full : full.slice(0, qIndex)
  const query = new URLSearchParams(qIndex === -1 ? '' : full.slice(qIndex + 1))
  return {
    path: pathname.replace(/\/+$/, '') || '/',
    query,
    route: navigate,
  }
}

export interface RouteDef {
  pattern: string // p.ej. "/dia/:date"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
}

function match(pattern: string, pathname: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean)
  const cp = pathname.split('/').filter(Boolean)
  if (pp.length !== cp.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(cp[i])
    else if (pp[i] !== cp[i]) return null
  }
  return params
}

export function Router({
  routes,
  fallback,
}: {
  routes: RouteDef[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback: ComponentType<any>
}) {
  const { path: pathname } = useLocation()
  for (const r of routes) {
    const params = match(r.pattern, pathname)
    if (params) {
      const C = r.component
      return <C {...params} />
    }
  }
  const F = fallback
  return <F />
}
