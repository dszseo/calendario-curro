/** Descarga un texto como archivo. En Android/Chrome dispara el diálogo de guardado. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('No se pudo leer el archivo.'))
    r.readAsText(file, 'utf-8')
  })

/**
 * Intenta compartir el archivo por el menú del sistema (Android: Drive, correo…).
 * Devuelve true si se pudo compartir; si no, el llamador debería usar downloadText.
 */
export async function shareTextFile(
  filename: string,
  text: string,
  mime: string,
): Promise<boolean> {
  try {
    const file = new File([text], filename, { type: mime })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return true
    }
  } catch {
    /* el usuario canceló o no se pudo: se cae a la descarga */
  }
  return false
}
