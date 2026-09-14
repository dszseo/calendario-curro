import type { Day } from '../../db/types'
import type { DateKey } from '../datetime'

/**
 * Días de libre disposición usados en un conjunto de días. Cuenta tanto la
 * entrada dedicada (`vacaciones`/`asuntoPropio`/`regulacion`) como la libranza
 * de un solo día con ese motivo (sección 17 del enunciado) — son dos formas de
 * anotar lo mismo y no pueden coincidir el mismo día (la matriz de
 * incompatibilidades ya lo impide), así que no hay doble conteo.
 */
export interface UsoDias {
  vacaciones: DateKey[]
  asuntosPropios: DateKey[]
  regulacion: DateKey[]
}

export function usoDiasAnio(days: Day[]): UsoDias {
  const uso: UsoDias = { vacaciones: [], asuntosPropios: [], regulacion: [] }
  for (const d of days) {
    for (const e of d.entries) {
      if (e.type === 'vacaciones') uso.vacaciones.push(d.date)
      else if (e.type === 'asuntoPropio') uso.asuntosPropios.push(d.date)
      else if (e.type === 'regulacion') uso.regulacion.push(d.date)
      else if (e.type === 'libranza') {
        if (e.motivo === 'vacaciones') uso.vacaciones.push(d.date)
        else if (e.motivo === 'asuntos') uso.asuntosPropios.push(d.date)
        else if (e.motivo === 'regulacion') uso.regulacion.push(d.date)
      }
    }
  }
  return uso
}
