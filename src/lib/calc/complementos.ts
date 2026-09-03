import type { Day, TurnoEntry } from '../../db/types'
import { addDaysKey, dowMon0, type DateKey } from '../datetime'
import { UMBRAL_COMPLEMENTO_HORAS } from '../config'

export type TipoComplemento = 'sabado' | 'festivo'

export function esFestivoDia(day: Day | undefined): boolean {
  return !!day?.entries.some((e) => e.type === 'festivo')
}

/**
 * Tipo de complemento que "vale" un día. El festivo manda sobre el sábado
 * (un festivo que cae en sábado se paga como festivo, no como sábado).
 */
export function tipoDelDia(date: DateKey, esFestivo: boolean): TipoComplemento | null {
  if (esFestivo) return 'festivo'
  const dow = dowMon0(date) // lun=0 … sáb=5 · dom=6
  if (dow === 6) return 'festivo' // domingo cuenta como festivo
  if (dow === 5) return 'sabado'
  return null
}

function turnoDe(day: Day | undefined): TurnoEntry | undefined {
  const t = day?.entries.find((e) => e.type === 'turno')
  return t && t.type === 'turno' ? t : undefined
}

/** Horas efectivas trabajadas ese día = turno + ajustes puestos a mano. */
export function horasEfectivas(day: Day | undefined): number {
  if (!day) return 0
  let h = 0
  for (const e of day.entries) {
    if (e.type === 'turno') h += e.horas
    else if (e.type === 'ajusteBolsa' && !e.auto) h += e.override ?? e.horas
  }
  return h
}

export interface ComplementoCalc {
  tipo: TipoComplemento
  valor: number
}

/**
 * Complementos que le corresponden a un día, sumando:
 * - turno de mañana/tarde ese día, en día de complemento (≥ umbral) → 1 entero.
 * - turno de noche que EMPIEZA ese día (arranca la tarde-noche):
 *     · festivo marcado entre semana → 1 entero (todo el día es festivo).
 *     · sábado → ½ (necesita el viernes para sumar el sábado entero).
 *     · domingo → ½ (la noche del domingo siempre es inicio de semana).
 * - turno de noche del día ANTERIOR, que termina esa madrugada → ½.
 *
 * Ejemplos que salen solos: viernes+sábado noche → 1 sábado + ½ festivo;
 * festivo el jueves con miércoles noche (½) + jueves noche (1) → 1,5 festivos.
 */
export function complementosDia(
  date: DateKey,
  dias: Map<DateKey, Day>,
  umbral = UMBRAL_COMPLEMENTO_HORAS,
): ComplementoCalc[] {
  const hoy = dias.get(date)
  const ayer = dias.get(addDaysKey(date, -1))
  const esFestivo = esFestivoDia(hoy)
  const tipo = tipoDelDia(date, esFestivo)
  if (!tipo) return []

  let valor = 0

  const tHoy = turnoDe(hoy)
  if (tHoy && horasEfectivas(hoy) >= umbral) {
    if (tHoy.periodo !== 'noche') {
      valor += 1 // jornada de día completa en día de complemento
    } else {
      // Noche que empieza ese día. PENDIENTE de confirmar con el usuario el
      // valor del sábado noche ("mi domingo" en semana de noche): la §8 del
      // enunciado sugiere que podría contar como festivo, no como sábado, y/o
      // valer 1 en vez de ½. Si cambia, es solo ajustar estos números.
      const esFestivoEntero = esFestivo && dowMon0(date) !== 6
      valor += esFestivoEntero ? 1 : 0.5
    }
  }

  const tAyer = turnoDe(ayer)
  if (tAyer && tAyer.periodo === 'noche' && horasEfectivas(ayer) >= umbral) {
    valor += 0.5 // madrugada entrante
  }

  return valor > 0 ? [{ tipo, valor }] : []
}
