import { db, getMeta } from './db'
import type { DateKey } from '../lib/datetime'
import { bolsaTotal } from '../lib/calc/bolsa'

export const BOLSA_INICIAL_KEY = 'bolsaInicial'

export { bolsaDeltaEntry, bolsaDeltaDay, turnoBolsa, bolsaCtx, bolsaTotal } from '../lib/calc/bolsa'

/** Saldo total de la bolsa: saldo inicial + todos los movimientos derivados. */
export async function saldoBolsa(): Promise<number> {
  const inicial = await getMeta<number>(BOLSA_INICIAL_KEY, 0)
  const days = await db.days.toArray()
  return bolsaTotal(days, inicial)
}

/** Saldo acumulado hasta una fecha inclusive. */
export async function saldoHasta(dateKey: DateKey): Promise<number> {
  const inicial = await getMeta<number>(BOLSA_INICIAL_KEY, 0)
  const days = await db.days.where('date').belowOrEqual(dateKey).toArray()
  return bolsaTotal(days, inicial)
}
