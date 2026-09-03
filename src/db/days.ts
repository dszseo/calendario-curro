import { db, uuid } from './db'
import type { AutoCategoria, Day, Entry, Periodo, TurnoEntry } from './types'
import { addDaysKey, keysBetween, type DateKey } from '../lib/datetime'
import { entradasAutoDia, esEntradaAuto, fusionarEntradas } from '../lib/calc/auto'
import { scheduleSnapshot } from '../export/snapshots'

export { uuid }

export function getDay(date: DateKey): Promise<Day | undefined> {
  return db.days.get(date)
}

export async function getDaysInRange(from: DateKey, to: DateKey): Promise<Day[]> {
  const rows = await db.days.where('date').between(from, to, true, true).toArray()
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export async function daysMapInRange(from: DateKey, to: DateKey): Promise<Map<DateKey, Day>> {
  const rows = await getDaysInRange(from, to)
  return new Map(rows.map((d) => [d.date, d]))
}

export function getAllDays(): Promise<Day[]> {
  return db.days.orderBy('date').toArray()
}

// ---------- Regeneración de entradas automáticas ----------

function claveEntradas(entries: Entry[]): string {
  return entries
    .map((e) => JSON.stringify(e, Object.keys(e).sort()))
    .sort()
    .join('|')
}

function mismasEntradas(a: Entry[], b: Entry[]): boolean {
  return a.length === b.length && claveEntradas(a) === claveEntradas(b)
}

function recalcularDia(date: DateKey, prev: Day | undefined, mapa: Map<DateKey, Day>): Day | null {
  const autos = entradasAutoDia(date, mapa, prev?.autoOff)
  const entries = fusionarEntradas(prev?.entries ?? [], autos)
  if (entries.length === 0) {
    // conserva la fila si el usuario ha descartado alguna categoría auto
    if (prev?.autoOff?.length) {
      return prev.entries.length === 0 ? prev : { date, entries: [], autoOff: prev.autoOff, updatedAt: Date.now() }
    }
    return null
  }
  if (prev && mismasEntradas(prev.entries, entries)) return prev
  return { date, entries, autoOff: prev?.autoOff, updatedAt: Date.now() }
}

/** Regenera las entradas auto en una ventana alrededor de `centro`. */
async function regenerarAuto(centro: DateKey): Promise<void> {
  const nucleoDesde = addDaysKey(centro, -3)
  const nucleoHasta = addDaysKey(centro, 7)
  // Contexto amplio: un viernes del núcleo necesita su domingo (−5) y margen.
  const ctxRows = await db.days
    .where('date')
    .between(addDaysKey(centro, -12), addDaysKey(centro, 12), true, true)
    .toArray()
  const mapa = new Map(ctxRows.map((d) => [d.date, d]))

  const puts: Day[] = []
  const dels: DateKey[] = []
  for (const date of keysBetween(nucleoDesde, nucleoHasta)) {
    const prev = mapa.get(date)
    const next = recalcularDia(date, prev, mapa)
    if (next === prev) continue
    if (next === null) {
      if (prev) dels.push(date)
    } else {
      puts.push(next)
    }
  }
  if (puts.length === 0 && dels.length === 0) return
  await db.transaction('rw', db.days, async () => {
    for (const d of puts) await db.days.put(d)
    for (const k of dels) await db.days.delete(k)
  })
}

/** Recalcula TODAS las entradas auto (migración / arranque). */
export async function regenerarTodo(): Promise<void> {
  const rows = await db.days.toArray()
  const mapa = new Map(rows.map((d) => [d.date, d]))
  const puts: Day[] = []
  const dels: DateKey[] = []
  for (const d of rows) {
    const next = recalcularDia(d.date, d, mapa)
    if (next === d) continue
    if (next === null) dels.push(d.date)
    else puts.push(next)
  }
  if (puts.length === 0 && dels.length === 0) return
  await db.transaction('rw', db.days, async () => {
    for (const d of puts) await db.days.put(d)
    for (const k of dels) await db.days.delete(k)
  })
}

// ---------- Escritura ----------

/** Guarda las entradas de un día y regenera las automáticas alrededor. */
export async function saveDay(
  date: DateKey,
  entries: Entry[],
  opts: { regen?: boolean } = {},
): Promise<void> {
  const prev = await db.days.get(date)
  if (entries.length === 0 && !prev?.autoOff?.length) {
    await db.days.delete(date)
  } else {
    await db.days.put({ date, entries, autoOff: prev?.autoOff, updatedAt: Date.now() })
  }
  if (opts.regen !== false) await regenerarAuto(date)
  scheduleSnapshot()
}

async function mutate(date: DateKey, fn: (entries: Entry[]) => Entry[]): Promise<void> {
  const current = (await db.days.get(date))?.entries ?? []
  await saveDay(date, fn(current))
}

export function addEntry(date: DateKey, entry: Omit<Entry, 'id'>): Promise<void> {
  return mutate(date, (es) => [...es, { ...entry, id: uuid() } as Entry])
}

export function updateEntry(date: DateKey, entry: Entry): Promise<void> {
  return mutate(date, (es) => es.map((e) => (e.id === entry.id ? entry : e)))
}

export function removeEntry(date: DateKey, entryId: string): Promise<void> {
  return mutate(date, (es) => es.filter((e) => e.id !== entryId))
}

/**
 * Aplica el override de una entrada auto (valor puesto a mano por el usuario).
 * `valor === undefined` vuelve al valor calculado.
 */
export async function overrideEntrada(
  date: DateKey,
  entryId: string,
  valor: number | undefined,
): Promise<void> {
  await mutate(date, (es) =>
    es.map((e) =>
      e.id === entryId && (e.type === 'ajusteBolsa' || e.type === 'complemento')
        ? { ...e, override: valor }
        : e,
    ),
  )
}

function catOf(e: Entry): AutoCategoria | null {
  if (e.type === 'ajusteBolsa') return 'bolsa'
  if (e.type === 'complemento') return 'complemento'
  return null
}

/** Descarta (o vuelve a activar) las entradas auto de una categoría en un día. */
export async function setAutoOff(
  date: DateKey,
  categoria: AutoCategoria,
  off: boolean,
): Promise<void> {
  const day = await db.days.get(date)
  const set = new Set<AutoCategoria>(day?.autoOff ?? [])
  if (off) set.add(categoria)
  else set.delete(categoria)
  const autoOff = [...set]
  const entries = (day?.entries ?? []).filter(
    (e) => !(esEntradaAuto(e) && catOf(e) === categoria),
  )
  await db.days.put({ date, entries, autoOff: autoOff.length ? autoOff : undefined, updatedAt: Date.now() })
  await regenerarAuto(date)
  scheduleSnapshot()
}

/** Limpia los descartes y overrides de un día y recalcula las entradas auto. */
export async function recalcularAutoDia(date: DateKey): Promise<void> {
  const day = await db.days.get(date)
  if (!day) return
  const manuales = day.entries.filter((e) => !esEntradaAuto(e))
  await db.days.put({ date, entries: manuales, autoOff: undefined, updatedAt: Date.now() })
  await regenerarAuto(date)
  scheduleSnapshot()
}

export interface TurnoBlockDay {
  date: DateKey
  periodo: Periodo
  horas: number
}

const withoutTurno = (entries: Entry[]): Entry[] => entries.filter((e) => e.type !== 'turno')

/**
 * Aplica un bloque de turnos (autorelleno de 5 días). En cada día sustituye el
 * turno existente y conserva el resto de entradas. Regenera las auto al final.
 */
export async function applyTurnoBlock(block: TurnoBlockDay[]): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    for (const b of block) {
      const current = (await db.days.get(b.date))?.entries ?? []
      const turno: Entry = { id: uuid(), type: 'turno', periodo: b.periodo, horas: b.horas }
      const prev = await db.days.get(b.date)
      await db.days.put({
        date: b.date,
        entries: [turno, ...withoutTurno(current).filter((e) => !esEntradaAuto(e))],
        autoOff: prev?.autoOff,
        updatedAt: Date.now(),
      })
    }
  })
  if (block.length) {
    for (const b of block) await regenerarAuto(b.date)
  }
  scheduleSnapshot()
}

/** Fija el turno de un solo día (sustituye el que hubiera, conserva el resto). */
export async function setTurno(
  date: DateKey,
  turno: TurnoEntry | Omit<TurnoEntry, 'id'>,
): Promise<void> {
  const current = (await db.days.get(date))?.entries ?? []
  const t: Entry = { ...turno, id: 'id' in turno ? turno.id : uuid(), type: 'turno' }
  await saveDay(date, [t, ...withoutTurno(current).filter((e) => !esEntradaAuto(e))])
}

/**
 * Rellena un rango como baja médica. En cada día deja solo la baja, más las
 * notas y festivos que ya hubiera.
 */
export async function fillBajaRange(
  fromKey: DateKey,
  toKey: DateKey,
  motivo?: string,
): Promise<number> {
  const keys = keysBetween(fromKey, toKey)
  await db.transaction('rw', db.days, async () => {
    for (const date of keys) {
      const current = (await db.days.get(date))?.entries ?? []
      if (current.some((e) => e.type === 'baja')) continue
      const keep = current.filter((e) => e.type === 'nota' || e.type === 'festivo')
      const baja: Entry = { id: uuid(), type: 'baja', motivo: motivo?.trim() || undefined }
      await db.days.put({ date, entries: [baja, ...keep], updatedAt: Date.now() })
    }
  })
  for (const date of keys) await regenerarAuto(date)
  scheduleSnapshot()
  return keys.length
}
