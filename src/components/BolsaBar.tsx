import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { saldoBolsa } from '../db/bolsa'

const hh = (n: number) => {
  const a = Math.abs(n)
  const s = Number.isInteger(a) ? `${a}` : a.toFixed(1)
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${s} h`
}

export function BolsaBar() {
  // Recalcula cuando cambia cualquier día.
  const saldo = useLiveQuery(async () => {
    await db.days.count()
    return saldoBolsa()
  }, [], null)

  return (
    <div class="bolsa-bar">
      <div class="wrap">
        <span class="k">Bolsa de horas</span>
        <span class={`v ${saldo != null && saldo > 0 ? 'pos' : ''} ${saldo != null && saldo < 0 ? 'neg' : ''}`}>
          {saldo == null ? '…' : hh(saldo)}
        </span>
      </div>
    </div>
  )
}
