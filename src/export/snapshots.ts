import { buildBackup, backupToString } from './json'

/**
 * Copias automáticas locales en OPFS (Origin Private File System). Soportado en
 * Chrome de Android. Viven dentro del almacenamiento privado de la app: son
 * instantáneas y sin permisos, pero se pierden si se borran los datos del sitio
 * o se desinstala — no sustituyen a exportar el archivo de vez en cuando.
 */

const DIR = 'snapshots'
const KEEP = 10
const DEBOUNCE_MS = 4000

export function snapshotsSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory
}

async function dirHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!snapshotsSupported()) return null
  try {
    const root = await navigator.storage.getDirectory()
    return await root.getDirectoryHandle(DIR, { create: true })
  } catch {
    return null
  }
}

export interface SnapshotInfo {
  name: string
  savedAt: number
  sizeKB: number
}

function stampName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `snap-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`
}

function parseStamp(name: string): number {
  const m = name.match(/^snap-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/)
  if (!m) return 0
  const [, y, mo, da, h, mi, s] = m.map(Number)
  return new Date(y, mo - 1, da, h, mi, s).getTime()
}

export async function saveSnapshot(): Promise<boolean> {
  const dir = await dirHandle()
  if (!dir) return false
  try {
    const text = backupToString(await buildBackup())
    const fh = await dir.getFileHandle(stampName(), { create: true })
    const w = await fh.createWritable()
    await w.write(text)
    await w.close()
    await prune(dir)
    return true
  } catch {
    return false
  }
}

async function prune(dir: FileSystemDirectoryHandle): Promise<void> {
  const names: string[] = []
  // @ts-expect-error iterador async de OPFS aún no está en todos los lib.dom
  for await (const [name] of dir.entries()) names.push(name as string)
  const sorted = names.filter((n) => n.startsWith('snap-')).sort()
  for (const n of sorted.slice(0, Math.max(0, sorted.length - KEEP))) {
    try {
      await dir.removeEntry(n)
    } catch {
      /* ignora */
    }
  }
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const dir = await dirHandle()
  if (!dir) return []
  const out: SnapshotInfo[] = []
  try {
    // @ts-expect-error iterador async de OPFS
    for await (const [name, handle] of dir.entries()) {
      if (!name.startsWith('snap-')) continue
      const file = await (handle as FileSystemFileHandle).getFile()
      out.push({ name, savedAt: parseStamp(name) || file.lastModified, sizeKB: Math.round(file.size / 102.4) / 10 })
    }
  } catch {
    /* ignora */
  }
  return out.sort((a, b) => b.savedAt - a.savedAt)
}

export async function readSnapshot(name: string): Promise<string | null> {
  const dir = await dirHandle()
  if (!dir) return null
  try {
    const fh = await dir.getFileHandle(name)
    return await (await fh.getFile()).text()
  } catch {
    return null
  }
}

export async function deleteSnapshot(name: string): Promise<void> {
  const dir = await dirHandle()
  if (!dir) return
  try {
    await dir.removeEntry(name)
  } catch {
    /* ignora */
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Programa una copia automática tras un pequeño retardo (agrupa cambios). */
export function scheduleSnapshot(): void {
  if (!snapshotsSupported()) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void saveSnapshot()
  }, DEBOUNCE_MS)
}
