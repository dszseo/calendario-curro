import type { Day, Periodo } from '../db/types'
import type { Dispo } from '../lib/calc/disponibilidad'
import { addDaysKey, isoWeek, localDateKey, todayKey, type DateKey } from '../lib/datetime'

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const PERIODO_INICIAL: Record<Periodo, string> = { manana: 'M', tarde: 'T', noche: 'N' }

interface Badges {
  strip?: { cls: string; label: string }
  dispo?: Dispo
  count: number
}

function dayBadges(day: Day | undefined): Badges {
  if (!day) return { count: 0 }
  const libraComp = day.entries.some((e) => e.type === 'libranzaComp')
  // Días sin turno de verdad ese día (turno ausente, o presente pero
  // compensado por una libranza): el motivo (libre, baja, vacaciones,
  // festivo marcado...) es el estado del día y se pinta como tira grande,
  // igual que el turno — no tiene sentido dejarlo en un +N genérico.
  const sinTurnoEfectivo = libraComp || !day.entries.some((e) => e.type === 'turno')
  let strip: Badges['strip']
  let dispo: Dispo | undefined
  const labels = new Set<string>()
  for (const e of day.entries) {
    switch (e.type) {
      case 'turno':
        if (!libraComp) strip = { cls: e.periodo, label: PERIODO_INICIAL[e.periodo] }
        break
      case 'libranzaComp':
        strip = { cls: 'libra', label: 'LIBRE' }
        break
      case 'festivo':
        if (sinTurnoEfectivo) strip = { cls: 'festivo', label: 'FEST' }
        else labels.add('FEST')
        break
      case 'libranza':
        if (sinTurnoEfectivo) strip = { cls: 'libra', label: 'LIBRE' }
        else labels.add('LIBRE')
        break
      case 'vacaciones':
        if (sinTurnoEfectivo) strip = { cls: 'vac', label: 'VAC' }
        else labels.add('VAC')
        break
      case 'asuntoPropio':
        if (sinTurnoEfectivo) strip = { cls: 'libra', label: 'AP' }
        else labels.add('AP')
        break
      case 'regulacion':
        if (sinTurnoEfectivo) strip = { cls: 'libra', label: 'REG' }
        else labels.add('REG')
        break
      case 'permiso':
        if (sinTurnoEfectivo) strip = { cls: 'libra', label: 'PER' }
        else labels.add('PER')
        break
      case 'baja':
        if (sinTurnoEfectivo) strip = { cls: 'baja', label: 'BAJA' }
        else labels.add('BAJA')
        break
      case 'permisoML':
        if (sinTurnoEfectivo) strip = { cls: 'baja', label: 'M/P' }
        else labels.add('M/P')
        break
      case 'diaEspecial':
        if (sinTurnoEfectivo) strip = { cls: 'extra', label: 'ESP' }
        else labels.add('ESP')
        break
      case 'horaExtra':
        labels.add(e.destino === 'bolsa' ? '+B' : '+EX')
        break
      case 'ajusteBolsa':
        labels.add(e.horas >= 0 ? '+h' : '−h')
        break
      case 'disponibilidad':
        // T/D tiene su propio hueco junto al número del día, no cuenta en +N.
        dispo = e.valor
        break
      case 'complemento':
        labels.add(e.tipo === 'sabado' ? '+S' : '+F')
        break
      case 'nota':
        labels.add('✎')
        break
    }
  }
  return { strip, dispo, count: labels.size }
}

function buildGrid(year: number, month0: number): (DateKey | null)[] {
  const first = new Date(year, month0, 1)
  const startOffset = (first.getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const cells: (DateKey | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(localDateKey(new Date(year, month0, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Lunes con el que arranca la rejilla (puede caer en el mes anterior). */
function gridStartMonday(year: number, month0: number): DateKey {
  const first = new Date(year, month0, 1)
  const startOffset = (first.getDay() + 6) % 7
  return addDaysKey(localDateKey(first), -startOffset)
}

export function Calendar({
  year,
  month0,
  daysMap,
  onPickDay,
}: {
  year: number
  month0: number
  daysMap: Map<DateKey, Day>
  onPickDay: (date: DateKey) => void
}) {
  const cells = buildGrid(year, month0)
  const today = todayKey()
  const weekStart = gridStartMonday(year, month0)
  const rows: (DateKey | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <div>
      <div class="cal-week-row">
        <div class="wk-num head" aria-hidden="true" />
        <div class="cal-grid">
          {DOW.map((d, i) => (
            <div class={`cal-dow ${i >= 5 ? 'we' : ''}`} key={d}>
              {d}
            </div>
          ))}
        </div>
      </div>
      {rows.map((row, ri) => {
        const monday = addDaysKey(weekStart, ri * 7)
        return (
          <div class="cal-week-row" key={monday}>
            <div class="wk-num" title={`Semana ${isoWeek(monday)}`}>
              {isoWeek(monday)}
            </div>
            <div class="cal-grid">
              {row.map((key, dow) => {
                if (!key) return <div key={`x${ri}-${dow}`} />
                const badges = dayBadges(daysMap.get(key))
                return (
                  <button
                    key={key}
                    class={`cal-cell ${key === today ? 'today' : ''} ${dow >= 5 ? 'we' : ''}`}
                    onClick={() => onPickDay(key)}
                  >
                    <span class="d-top">
                      <span class="d-num">{Number(key.slice(-2))}</span>
                      {badges.dispo && <span class="d-dispo">{badges.dispo}</span>}
                    </span>
                    {badges.count > 0 && <span class="d-more">+{badges.count}</span>}
                    {badges.strip && <span class={`d-turno ${badges.strip.cls}`}>{badges.strip.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
