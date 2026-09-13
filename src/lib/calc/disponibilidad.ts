import { addDaysKey, diffDiasKeys, dowMon0, type DateKey } from '../datetime'

/**
 * Disponibilidad de fin de semana: se fija en sábado o domingo (se aplica a
 * los dos días de ese finde) y a partir de ahí alterna T/D cada semana sola.
 *
 * El pasado no se toca nunca: cada finde fijado a mano es un «ancla» que
 * gobierna la alternancia desde su fecha EN ADELANTE, hasta la siguiente
 * ancla (si la hay). Fijar un finde nuevo más adelante no recalcula los
 * findes anteriores — puede quedar una secuencia de dos T o dos D seguidas
 * justo en el cambio, y es correcto que así sea.
 */
export type Dispo = 'T' | 'D'

export interface DispoAncla {
  /** Sábado del finde que se fijó explícitamente (el domingo es sábado+1). */
  sabado: DateKey
  valor: Dispo
}

export const opuesto = (v: Dispo): Dispo => (v === 'T' ? 'D' : 'T')

/** Sábado del finde al que pertenece una fecha, o null si no es sábado ni domingo. */
export function sabadoDeFinde(date: DateKey): DateKey | null {
  const dow = dowMon0(date) // lun=0 … sáb=5 · dom=6
  if (dow === 5) return date
  if (dow === 6) return addDaysKey(date, -1)
  return null
}

/**
 * T/D que le corresponde a un finde (por su sábado), según la lista de anclas.
 * Usa la ancla más reciente que sea igual o anterior a ese finde — así una
 * ancla nueva nunca cambia lo que ya calculaba una ancla anterior a ella.
 * Si el finde es anterior a CUALQUIER ancla conocida, se extiende hacia atrás
 * la más antigua (ahí no hay nada previo que proteger).
 */
export function dispoDeFinde(sabado: DateKey, anclas: DispoAncla[] | null | undefined): Dispo | null {
  if (!anclas || anclas.length === 0) return null
  let aplicable: DispoAncla | null = null
  let masAntigua = anclas[0]
  for (const a of anclas) {
    if (a.sabado <= sabado && (!aplicable || a.sabado > aplicable.sabado)) aplicable = a
    if (a.sabado < masAntigua.sabado) masAntigua = a
  }
  const base = aplicable ?? masAntigua
  const semanas = Math.round(diffDiasKeys(sabado, base.sabado) / 7)
  return semanas % 2 === 0 ? base.valor : opuesto(base.valor)
}

/** Añade o actualiza (por fecha) una ancla en la lista, y la deja ordenada. */
export function conAncla(anclas: DispoAncla[], nueva: DispoAncla): DispoAncla[] {
  return [...anclas.filter((a) => a.sabado !== nueva.sabado), nueva].sort((a, b) =>
    a.sabado < b.sabado ? -1 : a.sabado > b.sabado ? 1 : 0,
  )
}
