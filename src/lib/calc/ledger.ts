import type { Day, Entry } from '../../db/types'
import { bolsaDeltaEntry, round1 } from './bolsa'
import type { DateKey } from '../datetime'

export interface LedgerLine {
  date: DateKey
  desc: string
  horas: number
  saldo: number
}

/** Texto legible del movimiento de bolsa de una entrada, o `null` si no mueve la bolsa. */
export function descripcionMovimiento(e: Entry): string | null {
  switch (e.type) {
    case 'ajusteBolsa':
      return e.motivo ?? (e.auto ? 'Ajuste automático de bolsa' : 'Ajuste manual de bolsa')
    case 'libranzaComp':
      return `Libranza compensatoria (${e.dia === 'sabado' ? 'sábado' : 'domingo'})`
    case 'libranza':
      return e.motivo === 'horas' ? 'Libranza a cuenta de la bolsa' : null
    case 'horaExtra':
      return e.destino === 'bolsa' ? 'Hora extra a la bolsa' : null
    default:
      return null
  }
}

/**
 * Construye el listado anual de movimientos de bolsa, estilo "folio de la
 * oficina": primera línea con el ajuste (saldo) traído del año anterior,
 * seguida de cada movimiento del año en orden cronológico con saldo
 * acumulado.
 */
export function construirLedgerAnio(year: number, days: Day[], saldoInicial: number): LedgerLine[] {
  const lineas: LedgerLine[] = []
  let saldo = round1(saldoInicial)
  lineas.push({ date: `${year}-01-01`, desc: `Ajuste ${year - 1}`, horas: saldo, saldo })

  const ordenados = [...days].sort((a, b) => a.date.localeCompare(b.date))
  for (const d of ordenados) {
    for (const e of d.entries) {
      const desc = descripcionMovimiento(e)
      if (desc === null) continue
      const horas = bolsaDeltaEntry(e)
      if (horas === 0) continue
      saldo = round1(saldo + horas)
      lineas.push({ date: d.date, desc, horas, saldo })
    }
  }
  return lineas
}
