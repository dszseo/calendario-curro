import type { Day, Periodo, TurnoEntry } from '../../db/types'
import { addDaysKey, dowMon0, type DateKey } from '../datetime'
import { bolsaCtx, turnoBolsa } from './bolsa'

/**
 * Libranzas compensatorias por trabajar el fin de semana.
 *
 * Los turnos rotan **tarde → mañana → noche → tarde**. Si trabajas el finde con
 * el turno de esa semana, la semana siguiente libras uno o dos días. Los días
 * dependen del turno con el que hiciste el finde:
 *
 * | Finde de | 2 días trabajados      | 1 solo día        |
 * |----------|------------------------|-------------------|
 * | tarde    | sáb→viernes, dom→lunes | sáb→vie, dom→lun  |
 * | mañana   | sáb→jueves, dom→viernes| siempre viernes   |
 * | noche    | jue + viernes          | siempre viernes   |
 *
 * Si el turno de la semana siguiente NO es el que toca por rotación (hubo cambio
 * de turno), no se rellena nada y se avisa al usuario.
 */

export const ROTACION: Record<Periodo, Periodo> = {
  tarde: 'manana',
  manana: 'noche',
  noche: 'tarde',
}

export interface CompDia {
  dia: 'sabado' | 'domingo'
  off: number // offset desde el lunes (lunes = 0)
}

/** Offsets de los días a librar según el turno del finde y qué días se trabajaron. */
export function compOffsets(periodo: Periodo, workedSat: boolean, workedSun: boolean): CompDia[] {
  if (!workedSat && !workedSun) return []
  if (periodo === 'tarde') {
    const r: CompDia[] = []
    if (workedSat) r.push({ dia: 'sabado', off: 4 }) // viernes
    if (workedSun) r.push({ dia: 'domingo', off: 0 }) // lunes
    return r
  }
  // mañana / noche
  if (workedSat && workedSun) {
    return [
      { dia: 'sabado', off: 3 }, // jueves
      { dia: 'domingo', off: 4 }, // viernes
    ]
  }
  return [{ dia: workedSat ? 'sabado' : 'domingo', off: 4 }] // un solo día → viernes
}

function turnoDe(day: Day | undefined): TurnoEntry | undefined {
  const t = day?.entries.find((e) => e.type === 'turno')
  return t && t.type === 'turno' ? t : undefined
}

function mondayOfCalendarWeek(date: DateKey): DateKey {
  return addDaysKey(date, -dowMon0(date))
}

export interface CompSemana {
  /** días a librar en la semana (fecha + qué día compensa) */
  dias: { date: DateKey; dia: 'sabado' | 'domingo' }[]
  /** true si se trabajó el finde pero el turno de la semana no es el de la rotación */
  cambioDeTurno: boolean
  /** turno con el que se hizo el finde (para el aviso) */
  findePeriodo?: Periodo
}

/**
 * Analiza la semana que empieza en `mondayKey`: qué se trabajó el finde anterior
 * y qué libranzas compensatorias le tocan.
 */
export function compSemana(mondayKey: DateKey, dias: Map<DateKey, Day>): CompSemana {
  const M = mondayKey
  const sat = addDaysKey(M, -2)
  const sun = addDaysKey(M, -1)
  const fri = addDaysKey(M, -3)

  let findePeriodo: Periodo | undefined
  let workedSat = false
  let workedSun = false

  const tSat = turnoDe(dias.get(sat))
  const tSun = turnoDe(dias.get(sun))
  const dSat = tSat && tSat.periodo !== 'noche'
  const dSun = tSun && tSun.periodo !== 'noche'

  if (dSat || dSun) {
    findePeriodo = (tSat?.periodo ?? tSun?.periodo) as Periodo
    workedSat = !!dSat
    workedSun = !!dSun
  } else {
    // noche extra la semana pasada (viernes / sábado noche fuera del bloque)
    const ctx = bolsaCtx([...dias.values()])
    const friExtra = turnoDe(dias.get(fri))?.periodo === 'noche' && turnoBolsa(fri, 'noche', ctx) > 0
    const satExtra = turnoDe(dias.get(sat))?.periodo === 'noche' && turnoBolsa(sat, 'noche', ctx) > 0
    const n = (friExtra ? 1 : 0) + (satExtra ? 1 : 0)
    if (n > 0) {
      findePeriodo = 'noche'
      workedSat = n >= 1
      workedSun = n >= 2
    }
  }

  if (!findePeriodo) return { dias: [], cambioDeTurno: false }

  // ¿el turno de esta semana es el que toca por rotación?
  const esperado = ROTACION[findePeriodo]
  const turnoSemana = [0, 1, 2, 3, 4]
    .map((i) => turnoDe(dias.get(addDaysKey(M, i))))
    .find((t) => t)
  if (!turnoSemana || turnoSemana.periodo !== esperado) {
    return { dias: [], cambioDeTurno: true, findePeriodo }
  }

  const offs = compOffsets(findePeriodo, workedSat, workedSun)
  return {
    dias: offs.map((o) => ({ date: addDaysKey(M, o.off), dia: o.dia })),
    cambioDeTurno: false,
    findePeriodo,
  }
}

/** ¿Este día es una libranza compensatoria? Devuelve qué día del finde compensa. */
export function libranzaCompDia(
  date: DateKey,
  dias: Map<DateKey, Day>,
): { dia: 'sabado' | 'domingo' } | null {
  const M = mondayOfCalendarWeek(date)
  const comp = compSemana(M, dias)
  const match = comp.dias.find((d) => d.date === date)
  return match ? { dia: match.dia } : null
}
