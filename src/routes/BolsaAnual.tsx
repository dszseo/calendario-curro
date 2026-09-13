import { useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from '../router'
import { getDaysInRange } from '../db/days'
import { saldoHasta } from '../db/bolsa'
import { construirLedgerAnio, type LedgerLine } from '../lib/calc/ledger'
import { shortDate } from '../lib/datetime'

const hh = (n: number) => {
  const a = Math.abs(n)
  const s = Number.isInteger(a) ? `${a}` : a.toFixed(1)
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${s} h`
}

function Fila({ l }: { l: LedgerLine }) {
  return (
    <div class="list-row">
      <div class="grow">
        {shortDate(l.date)}
        <div class="sub">{l.desc}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{hh(l.horas)}</strong>
        <div class="sub" style={{ fontVariantNumeric: 'tabular-nums' }}>saldo {hh(l.saldo)}</div>
      </div>
    </div>
  )
}

export function BolsaAnual() {
  const loc = useLocation()
  const [year, setYear] = useState(new Date().getFullYear())

  const lineas = useLiveQuery(
    async () => {
      const inicial = await saldoHasta(`${year - 1}-12-31`)
      const days = await getDaysInRange(`${year}-01-01`, `${year}-12-31`)
      return construirLedgerAnio(year, days, inicial)
    },
    [year],
    [] as LedgerLine[],
  )

  const total = lineas.length ? lineas[lineas.length - 1].saldo : 0

  return (
    <div>
      <div class="cal-head">
        <button class="icon-btn nav" aria-label="Atrás" onClick={() => loc.route('/')}>
          ←
        </button>
        <h2>Bolsa del año</h2>
        <span style={{ width: '46px' }} />
      </div>

      <div class="cal-head">
        <button class="icon-btn nav" aria-label="Año anterior" onClick={() => setYear((y) => y - 1)}>
          ←
        </button>
        <h2>{year}</h2>
        <button class="icon-btn nav" aria-label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
          →
        </button>
      </div>

      <p class="hint">
        Movimientos de la bolsa de horas del año, empezando por el ajuste traído del año anterior.
        Compáralo con el listado que te den en la oficina.
      </p>

      <div class="card">
        {lineas.map((l, i) => (
          <Fila key={`${l.date}-${i}`} l={l} />
        ))}
      </div>

      <div class="list-row" style={{ marginTop: '8px' }}>
        <div class="grow">
          <strong>Total {year}</strong>
        </div>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{hh(total)}</strong>
      </div>
    </div>
  )
}
