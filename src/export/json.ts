import { db, SCHEMA_VERSION } from '../db/db'
import type { BackupFile, Day } from '../db/types'
import { validateDay } from '../lib/compat'

export async function buildBackup(): Promise<BackupFile> {
  const [days, meta] = await Promise.all([
    db.days.orderBy('date').toArray(),
    db.meta.toArray(),
  ])
  return {
    app: 'calendario-curro',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    days,
    meta,
  }
}

export function backupToString(b: BackupFile): string {
  return JSON.stringify(b, null, 2)
}

export interface ParsedBackup {
  file: BackupFile
  counts: { days: number; entries: number; meta: number }
  warnings: string[]
}

/** Valida y normaliza un archivo de copia. Lanza Error con mensaje claro. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const b = raw as Partial<BackupFile>
  if (!b || b.app !== 'calendario-curro') {
    throw new Error('Este archivo no es una copia de Calendario Curro.')
  }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Versión de copia (${b.schemaVersion}) no compatible con esta app (${SCHEMA_VERSION}).`,
    )
  }
  const days: Day[] = Array.isArray(b.days) ? b.days : []
  const meta = Array.isArray(b.meta) ? b.meta : []
  const warnings: string[] = []
  let entries = 0

  for (const d of days) {
    if (!d.date || !Array.isArray(d.entries)) continue
    entries += d.entries.length
    if (!d.updatedAt) d.updatedAt = Date.now()
    const v = validateDay(d.entries)
    if (!v.ok) warnings.push(`${d.date}: ${v.reason}`)
  }

  return {
    file: {
      app: 'calendario-curro',
      schemaVersion: b.schemaVersion,
      exportedAt: b.exportedAt ?? '',
      days: days.filter((d) => d.date && Array.isArray(d.entries)),
      meta,
    },
    counts: { days: days.length, entries, meta: meta.length },
    warnings,
  }
}

export type RestoreMode = 'replace' | 'merge'

export async function restoreBackup(file: BackupFile, mode: RestoreMode): Promise<void> {
  await db.transaction('rw', db.days, db.meta, async () => {
    if (mode === 'replace') {
      await Promise.all([db.days.clear(), db.meta.clear()])
    }
    await db.days.bulkPut(file.days)
    if (file.meta.length) await db.meta.bulkPut(file.meta)
  })
}

export function backupFilename(prefix = 'calendario-curro'): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}
