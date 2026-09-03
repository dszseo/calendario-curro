import { signal } from '@preact/signals'

export const toastMessage = signal<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string): void {
  toastMessage.value = message
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (toastMessage.value = null), 2600)
}
