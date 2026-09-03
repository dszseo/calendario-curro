import type { Day, Periodo } from '../db/types'
import { localDateKey, todayKey, type DateKey } from '../lib/datetime'

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const PERIODO_INICIAL: Record<Periodo, string> = { manana: 'M', tarde: 'T', noche: 'N' }

interface Badges {
  strip?: { cls: string; label: string }
  tags: { cls: string; label: string }[]
}

function dayBadges(day: Day | undefined): Badges {
  const b: Badges = { tags: [] }
  if (!day) return b
  const libraComp = day.entries.some((e) => e.type === 'libranzaComp')
  for (const e of day.entries) {
    switch (e.type) {
      case 'turno':
        if (!libraComp) b.strip = { cls: e.periodo, label: PERIODO_INICIAL[e.periodo] }
        break
      case 'libranzaComp':
        b.tags.push({ cls: 'libra', label: 'LIBRE' })
        break
      case 'festivo':
        b.tags.push({ cls: 'festivo', label: 'FEST' })
        break
      case 'libranza':
        b.tags.push({ cls: 'libra', label: 'LIBRE' })
        break
      case 'vacaciones':
        b.tags.push({ cls: 'vac', label: 'VAC' })
        break
      case 'asuntoPropio':
        b.tags.push({ cls: 'libra', label: 'AP' })
        break
      case 'regulacion':
        b.tags.push({ cls: 'libra', label: 'REG' })
        break
      case 'permiso':
        b.tags.push({ cls: 'libra', label: 'PER' })
        break
      case 'baja':
        b.tags.push({ cls: 'baja', label: 'BAJA' })
        break
      case 'diaEspecial':
        b.tags.push({ cls: 'extra', label: 'ESP' })
        break
      case 'horaExtra':
        b.tags.push({ cls: 'extra', label: e.destino === 'bolsa' ? '+B' : '+EX' })
        break
      case 'ajusteBolsa':
        b.tags.push({ cls: 'extra', label: e.horas >= 0 ? '+h' : '−h' })
        break
      case 'disponibilidad':
        b.tags.push({ cls: 'dispo', label: e.valor })
        break
      case 'nota':
        b.tags.push({ cls: 'nota', label: '✎' })
        break
    }
  }
  // dedup por etiqueta y máximo 3
  const seen = new Set<string>()
  b.tags = b.tags.filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true))).slice(0, 3)
  return b
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

  return (
    <div>
      <div class="cal-grid" style={{ marginBottom: '4px' }}>
        {DOW.map((d, i) => (
          <div class={`cal-dow ${i >= 5 ? 'we' : ''}`} key={d}>
            {d}
          </div>
        ))}
      </div>
      <div class="cal-grid">
        {cells.map((key, i) => {
          if (!key) return <div key={`x${i}`} />
          const dow = i % 7
          const badges = dayBadges(daysMap.get(key))
          return (
            <button
              key={key}
              class={`cal-cell ${key === today ? 'today' : ''} ${dow >= 5 ? 'we' : ''}`}
              onClick={() => onPickDay(key)}
            >
              <span class="d-num">{Number(key.slice(-2))}</span>
              {badges.tags.length > 0 && (
                <span class="d-tags">
                  {badges.tags.map((t, j) => (
                    <span class={`d-tag ${t.cls}`} key={j}>
                      {t.label}
                    </span>
                  ))}
                </span>
              )}
              {badges.strip && <span class={`d-turno ${badges.strip.cls}`}>{badges.strip.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
