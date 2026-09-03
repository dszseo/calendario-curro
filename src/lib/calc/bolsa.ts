import type { Day, Entry, Periodo } from '../../db/types'
import { JORNADA_HORAS } from '../config'
import { addDaysKey, dowMon0, type DateKey } from '../datetime'

// dowMon0: lunes=0 · martes=1 · miércoles=2 · jueves=3 · viernes=4 · sábado=5 · domingo=6

export interface BolsaCtx {
  /** ¿Hay un turno de noche ese día? Sirve para saber si la semana de noche
   *  arrancó el domingo (y por tanto el viernes ya es noche extra). */
  hayNocheEn: (d: DateKey) => boolean
}

const CTX_VACIO: BolsaCtx = { hayNocheEn: () => false }

/** Aportación a la bolsa de una entrada que no es turno (no depende de la fecha). */
export function bolsaDeltaEntry(e: Entry, jornada = JORNADA_HORAS): number {
  switch (e.type) {
    case 'horaExtra':
      return e.destino === 'bolsa' ? e.horas : 0
    case 'ajusteBolsa':
      return e.override ?? e.horas
    case 'libranza':
      return e.motivo === 'horas' ? -jornada : 0
    case 'libranzaComp':
      return -jornada // compensa el +jornada de trabajar el finde → neto 0
    default:
      return 0
  }
}

/**
 * Horas que aporta a la bolsa trabajar un turno ese día.
 *
 * Mañana / tarde (regla de calendario):
 * - sábado o domingo → +jornada. Resto → 0.
 *
 * Noche (regla de bloque): la semana son 5 noches desde el arranque, que es
 * siempre **domingo o lunes**.
 * - domingo → 0 SIEMPRE (el domingo de noche siempre es el inicio de semana).
 * - lunes, martes, miércoles, jueves → 0 (dentro del bloque de 5).
 * - viernes → +jornada solo si la semana arrancó el domingo (hay noche el
 *   domingo anterior, viernes−5); si se arrancó el lunes, el viernes es normal.
 * - sábado → +jornada SIEMPRE (siempre cae fuera del bloque de 5).
 */
export function turnoBolsa(
  date: DateKey,
  periodo: Periodo,
  ctx: BolsaCtx = CTX_VACIO,
  jornada = JORNADA_HORAS,
): number {
  const dow = dowMon0(date)
  if (periodo !== 'noche') {
    return dow >= 5 ? jornada : 0 // sábado (5) o domingo (6)
  }
  if (dow === 5) return jornada // sábado noche → siempre extra
  if (dow === 4) return ctx.hayNocheEn(addDaysKey(date, -5)) ? jornada : 0 // viernes
  return 0 // domingo, lunes, martes, miércoles, jueves → bloque normal
}

/**
 * Movimiento neto de la bolsa en un día = suma de sus entradas.
 * El +jornada por trabajar sábado/domingo o noche extra NO se suma aquí: la app
 * lo añade como una entrada `ajusteBolsa` automática (ver `lib/calc/auto.ts`), y
 * así el usuario puede verla y editarla.
 */
export function bolsaDeltaDay(day: Day, jornada = JORNADA_HORAS): number {
  return day.entries.reduce((s, e) => s + bolsaDeltaEntry(e, jornada), 0)
}

/** Construye el contexto (qué días tienen turno de noche) a partir de una lista de días. */
export function bolsaCtx(days: Day[]): BolsaCtx {
  const noches = new Set<DateKey>()
  for (const d of days) {
    if (d.entries.some((e) => e.type === 'turno' && e.periodo === 'noche')) noches.add(d.date)
  }
  return { hayNocheEn: (x) => noches.has(x) }
}

/** Saldo a partir de una lista de días (asume que las entradas auto están al día). */
export function bolsaTotal(days: Day[], inicial = 0, jornada = JORNADA_HORAS): number {
  return round1(days.reduce((s, d) => s + bolsaDeltaDay(d, jornada), inicial))
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
