import type { Periodo } from '../../db/types'
import type { TurnoBlockDay } from '../../db/days'
import { addDaysKey, dowMon0, isSunday, mondayOfWorkWeek, type DateKey } from '../datetime'

/**
 * ¿Fijar un turno en este día debe rellenar automáticamente el bloque de 5 días?
 *
 * - Mañana / tarde: sí cuando el día es lunes.
 * - Noche: sí cuando el día es domingo o lunes (la semana de noche arranca en
 *   uno de esos dos días).
 *
 * En cualquier otro día se entiende que es una edición puntual y solo cambia ese
 * día.
 */
export function esInicioDeBloque(startKey: DateKey, periodo: Periodo): boolean {
  const esLunes = dowMon0(startKey) === 0
  if (periodo === 'noche') return esLunes || isSunday(startKey)
  return esLunes
}

/**
 * Genera el bloque de 5 turnos.
 * - Mañana / tarde: lunes → viernes de la semana laboral del día.
 * - Noche: 5 noches consecutivas desde el día (domingo→jueves o lunes→viernes).
 *
 * La matemática fina del turno de noche por semana (medios festivos, etc.) llega
 * en la Fase 2; aquí solo se rellena el calendario.
 */
export function autofillTurno(
  startKey: DateKey,
  periodo: Periodo,
  horas: number,
): TurnoBlockDay[] {
  if (periodo === 'noche') {
    return [0, 1, 2, 3, 4].map((i) => ({ date: addDaysKey(startKey, i), periodo, horas }))
  }
  const monday = mondayOfWorkWeek(startKey)
  return [0, 1, 2, 3, 4].map((i) => ({ date: addDaysKey(monday, i), periodo, horas }))
}
