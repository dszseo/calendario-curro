import { db, getMeta, setMeta, uuid } from './db'
import type { AutoCategoria, Day, Entry, Periodo, TurnoEntry } from './types'
import { addDaysKey, dowMon0, isWeekend, keysBetween, type DateKey } from '../lib/datetime'
import { entradasAutoDia, esEntradaAuto, fusionarEntradas } from '../lib/calc/auto'
import { bolsaCtx, type BolsaCtx } from '../lib/calc/bolsa'
import { conAncla, sabadoDeFinde, type Dispo, type DispoAncla } from '../lib/calc/disponibilidad'
import { scheduleSnapshot } from '../export/snapshots'

export const DISPO_ANCLA_KEY = 'dispoAncla'

/** Lista de anclas T/D. Admite el formato antiguo (una sola ancla, sin lista). */
async function getDispoAnclas(): Promise<DispoAncla[]> {
  const raw = await getMeta<DispoAncla[] | DispoAncla | null>(DISPO_ANCLA_KEY, null)
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

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

function recalcularDia(
  date: DateKey,
  prev: Day | undefined,
  mapa: Map<DateKey, Day>,
  ctx?: BolsaCtx,
  anclas?: DispoAncla[] | null,
): Day | null {
  const autos = entradasAutoDia(date, mapa, prev?.autoOff, ctx, anclas)
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

/**
 * Recalcula un rango de fechas completo (crea filas nuevas si hace falta, p.
 * ej. para que aparezca la disponibilidad T/D de un finde sin turno).
 */
async function regenerarEnRango(
  nucleoDesde: DateKey,
  nucleoHasta: DateKey,
  ctxDesde: DateKey,
  ctxHasta: DateKey,
): Promise<void> {
  const ctxRows = await db.days.where('date').between(ctxDesde, ctxHasta, true, true).toArray()
  const mapa = new Map(ctxRows.map((d) => [d.date, d]))
  const ctx = bolsaCtx(ctxRows)
  const anclas = await getDispoAnclas()

  const puts: Day[] = []
  const dels: DateKey[] = []
  for (const date of keysBetween(nucleoDesde, nucleoHasta)) {
    const prev = mapa.get(date)
    const next = recalcularDia(date, prev, mapa, ctx, anclas)
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

/** Regenera las entradas auto en una ventana alrededor de `centro`. */
async function regenerarAuto(centro: DateKey): Promise<void> {
  // Contexto amplio: un viernes del núcleo necesita su domingo (−5) y margen.
  await regenerarEnRango(
    addDaysKey(centro, -3),
    addDaysKey(centro, 7),
    addDaysKey(centro, -12),
    addDaysKey(centro, 12),
  )
}

/**
 * Regenera un rango de fechas arbitrario (p. ej. el mes que se está viendo en
 * el calendario), creando filas nuevas si hace falta. A diferencia de
 * `regenerarAuto`, no está limitado a los días que ya existen: así aparecen
 * los findes T/D aunque no tengan turno ni ninguna otra anotación.
 */
export async function regenerarRangoVisible(fromKey: DateKey, toKey: DateKey): Promise<void> {
  await regenerarEnRango(fromKey, toKey, addDaysKey(fromKey, -12), addDaysKey(toKey, 12))
  scheduleSnapshot()
}

/** Recalcula TODAS las entradas auto de los días existentes (migración / arranque). */
export async function regenerarTodo(): Promise<void> {
  const rows = await db.days.toArray()
  const mapa = new Map(rows.map((d) => [d.date, d]))
  const ctx = bolsaCtx(rows)
  const anclas = await getDispoAnclas()
  const puts: Day[] = []
  const dels: DateKey[] = []
  for (const d of rows) {
    const next = recalcularDia(d.date, d, mapa, ctx, anclas)
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
  if (e.type === 'libranzaComp') return 'libranza'
  if (e.type === 'disponibilidad') return 'disponibilidad'
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

/**
 * Fija la disponibilidad T/D de un finde completo (sábado + domingo, da igual
 * en cuál de los dos se pulse). A partir de aquí alterna sola cada semana,
 * SOLO HACIA DELANTE: los findes anteriores a este no se tocan (lo pasado no
 * cambia). Puede quedar una secuencia de dos T o dos D seguidas justo en el
 * cambio de ancla, y es correcto que así sea.
 */
export async function setDisponibilidadFinde(date: DateKey, valor: Dispo): Promise<void> {
  const sabado = sabadoDeFinde(date)
  if (!sabado) return
  const domingo = addDaysKey(sabado, 1)
  const anclas = await getDispoAnclas()
  await setMeta(DISPO_ANCLA_KEY, conAncla(anclas, { sabado, valor } satisfies DispoAncla))
  // por si ese finde estaba descartado antes, se reactiva
  for (const d of [sabado, domingo]) {
    const day = await db.days.get(d)
    if (day?.autoOff?.includes('disponibilidad')) {
      const autoOff = day.autoOff.filter((c) => c !== 'disponibilidad')
      await db.days.put({ ...day, autoOff: autoOff.length ? autoOff : undefined })
    }
  }
  // refresca hacia delante (nunca hacia atrás) para que el cambio se note ya
  await regenerarRangoVisible(sabado, addDaysKey(sabado, 180))
}

/** Quita la disponibilidad de un finde concreto (sábado + domingo). */
export async function quitarDisponibilidadFinde(date: DateKey): Promise<void> {
  const sabado = sabadoDeFinde(date)
  if (!sabado) return
  const domingo = addDaysKey(sabado, 1)
  await setAutoOff(sabado, 'disponibilidad', true)
  await setAutoOff(domingo, 'disponibilidad', true)
}

/** Horizonte al "apagar" disponibilidad desde una fecha: no hay forma de
 *  decir "para siempre" con el modelo de anclas, así que se cubre un rango
 *  largo de sobra (10 años) en vez de dejarlo sin límite. */
const HORIZONTE_BORRAR_DISPO_DIAS = 3650

/**
 * Borra la disponibilidad T/D.
 * - `desde === null`: borra TODO — las anclas y cualquier entrada/descarte de
 *   disponibilidad en toda la base, pasado incluido.
 * - `desde = fecha`: conserva tal cual todo lo anterior a esa fecha (lo
 *   pasado no se toca) y apaga la disponibilidad desde el sábado de esa
 *   semana en adelante, durante `HORIZONTE_BORRAR_DISPO_DIAS` días.
 */
export async function borrarDisponibilidad(desde: DateKey | null): Promise<void> {
  if (desde === null) {
    await setMeta(DISPO_ANCLA_KEY, [])
    const rows = await db.days.toArray()
    const puts: Day[] = []
    const dels: DateKey[] = []
    for (const d of rows) {
      const teniaDispo = d.entries.some((e) => e.type === 'disponibilidad') || d.autoOff?.includes('disponibilidad')
      if (!teniaDispo) continue
      const entries = d.entries.filter((e) => e.type !== 'disponibilidad')
      const autoOff = (d.autoOff ?? []).filter((c) => c !== 'disponibilidad')
      if (entries.length === 0 && autoOff.length === 0) dels.push(d.date)
      else puts.push({ ...d, entries, autoOff: autoOff.length ? autoOff : undefined, updatedAt: Date.now() })
    }
    await db.transaction('rw', db.days, async () => {
      for (const p of puts) await db.days.put(p)
      for (const k of dels) await db.days.delete(k)
    })
    scheduleSnapshot()
    return
  }

  let sabado = desde
  while (dowMon0(sabado) !== 5) sabado = addDaysKey(sabado, 1)

  const anclas = await getDispoAnclas()
  await setMeta(DISPO_ANCLA_KEY, anclas.filter((a) => a.sabado < sabado))

  const hasta = addDaysKey(sabado, HORIZONTE_BORRAR_DISPO_DIAS)
  const finde: DateKey[] = []
  for (let s = sabado; s <= hasta; s = addDaysKey(s, 7)) finde.push(s, addDaysKey(s, 1))

  const existentes = await db.days.where('date').anyOf(finde).toArray()
  const mapa = new Map(existentes.map((d) => [d.date, d]))
  const puts: Day[] = finde.map((date) => {
    const prev = mapa.get(date)
    const entries = (prev?.entries ?? []).filter((e) => e.type !== 'disponibilidad')
    const autoOff = [...new Set([...(prev?.autoOff ?? []), 'disponibilidad' as AutoCategoria])]
    return { date, entries, autoOff, updatedAt: Date.now() }
  })
  await db.transaction('rw', db.days, async () => {
    for (const p of puts) await db.days.put(p)
  })
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

/**
 * Rellena un rango como vacaciones. Salta los fines de semana y los días que
 * ya tengan un festivo anotado (ni cuentan ni se tocan). En cada día laborable
 * restante deja solo la vacación, más las notas que ya hubiera.
 */
export async function fillVacacionesRange(fromKey: DateKey, toKey: DateKey): Promise<number> {
  const dias = keysBetween(fromKey, toKey).filter((d) => !isWeekend(d))
  const rellenados: DateKey[] = []
  await db.transaction('rw', db.days, async () => {
    for (const date of dias) {
      const current = (await db.days.get(date))?.entries ?? []
      if (current.some((e) => e.type === 'vacaciones')) continue
      if (current.some((e) => e.type === 'festivo')) continue
      const keep = current.filter((e) => e.type === 'nota')
      const vac: Entry = { id: uuid(), type: 'vacaciones' }
      await db.days.put({ date, entries: [vac, ...keep], updatedAt: Date.now() })
      rellenados.push(date)
    }
  })
  for (const date of rellenados) await regenerarAuto(date)
  scheduleSnapshot()
  return rellenados.length
}
