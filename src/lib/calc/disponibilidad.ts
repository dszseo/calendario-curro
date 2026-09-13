import { addDaysKey, diffDiasKeys, dowMon0, type DateKey } from '../datetime'

/**
 * Disponibilidad de fin de semana: se fija en sábado o domingo (se aplica a
 * los dos días de ese finde) y a partir de ahí alterna T/D cada semana sola,
 * hasta que se vuelva a fijar otro finde (que pasa a ser el nuevo punto de
 * partida de la alternancia, hacia delante y hacia atrás).
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

/** T/D que le corresponde a un finde (por su sábado) según el ancla activa. */
export function dispoDeFinde(sabado: DateKey, ancla: DispoAncla | null): Dispo | null {
  if (!ancla) return null
  const semanas = Math.round(diffDiasKeys(sabado, ancla.sabado) / 7)
  return semanas % 2 === 0 ? ancla.valor : opuesto(ancla.valor)
}
