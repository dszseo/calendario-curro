import { useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from '../router'
import { getDaysInRange } from '../db/days'
import { resumenMes } from '../lib/calc/resumen'
import { monthKeyRange, monthTitle } from '../lib/datetime'

const nf = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
const hh = (n: number) => (Number.isInteger(n) ? `${n} h` : `${n.toFixed(1)} h`)

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div class="list-row">
      <div class="grow">
        {k}
        {hint && <div class="sub">{hint}</div>}
      </div>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</strong>
    </div>
  )
}

export function Nomina() {
  const loc = useLocation()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const rango = monthKeyRange(ym.y, ym.m)
  const ant = new Date(ym.y, ym.m - 1, 1)
  const rangoAnt = monthKeyRange(ant.getFullYear(), ant.getMonth())

  const daysMes = useLiveQuery(() => getDaysInRange(rango.fromKey, rango.toKey), [rango.fromKey], [])
  const daysAnt = useLiveQuery(
    () => getDaysInRange(rangoAnt.fromKey, rangoAnt.toKey),
    [rangoAnt.fromKey],
    [],
  )

  const r = resumenMes(daysMes ?? [])
  const rAnt = resumenMes(daysAnt ?? [])

  const shift = (d: number) => {
    const x = new Date(ym.y, ym.m + d, 1)
    setYm({ y: x.getFullYear(), m: x.getMonth() })
  }
  const mesSig = new Date(ym.y, ym.m + 1, 1)

  return (
    <div>
      <div class="cal-head">
        <button class="icon-btn" aria-label="Atrás" onClick={() => loc.route('/')}>
          ←
        </button>
        <h2>Nómina</h2>
        <span style={{ width: '46px' }} />
      </div>

      <div class="cal-head">
        <button class="icon-btn" aria-label="Mes anterior" onClick={() => shift(-1)}>
          ←
        </button>
        <h2>{monthTitle(ym.y, ym.m)}</h2>
        <button class="icon-btn" aria-label="Mes siguiente" onClick={() => shift(1)}>
          →
        </button>
      </div>

      <section class="section">
        <h2>Debería venir en esta nómina</h2>
        <div class="card">
          <Row k="Complementos de sábado" v={nf(r.complementoSabado)} hint="generados este mes" />
          <Row k="Complementos de festivo" v={nf(r.complementoFestivo)} hint="incluye domingos y festivos" />
          <Row k="Festivos marcados trabajados" v={String(r.festivos)} />
          <Row
            k="Horas extra a cobrar"
            v={hh(rAnt.horasExtraCobrar)}
            hint={`las de ${monthTitle(ant.getFullYear(), ant.getMonth()).toLowerCase()} (se cobran a mes vencido)`}
          />
        </div>
      </section>

      <section class="section">
        <h2>Generado este mes (se cobra después)</h2>
        <div class="card">
          <Row
            k="Horas extra a cobrar"
            v={hh(r.horasExtraCobrar)}
            hint={`se pagarán en la nómina de ${monthTitle(mesSig.getFullYear(), mesSig.getMonth()).toLowerCase()}`}
          />
          <Row k="Horas extra a la bolsa" v={hh(r.horasExtraBolsa)} hint="no se cobran, van a la bolsa" />
        </div>
      </section>

      <p class="hint">
        Los complementos y las horas extra salen de las entradas de cada día. Si algo no cuadra,
        abre el día y edítalas.
      </p>
    </div>
  )
}
