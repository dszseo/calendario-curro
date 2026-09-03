import { useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from '../router'
import { daysMapInRange, getDaysInRange } from '../db/days'
import { db, getMeta } from '../db/db'
import { monthKeyRange, monthTitle, todayKey, type DateKey } from '../lib/datetime'
import { Calendar } from '../components/Calendar'
import { MonthSummary } from '../components/MonthSummary'
import { BolsaBar } from '../components/BolsaBar'
import { DayEditor } from '../components/DayEditor'

function BackupReminder() {
  const last = useLiveQuery(() => getMeta<number | null>('lastBackupAt', null), [], undefined)
  const hasData = useLiveQuery(() => db.days.count(), [], 0)
  if (last === undefined) return null
  const days = last == null ? Infinity : Math.floor((Date.now() - last) / 86_400_000)
  if ((hasData ?? 0) === 0 || days < 10) return null
  return (
    <div class="note-banner warn">
      ⚠️ {last == null ? 'Todavía no has hecho ninguna copia de seguridad.' : `Última copia hace ${days} días.`}{' '}
      Ve a <strong>Ajustes → Copia de seguridad</strong>.
    </div>
  )
}

export function Home() {
  const loc = useLocation()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [picked, setPicked] = useState<DateKey | null>(null)

  const { fromKey, toKey } = monthKeyRange(ym.y, ym.m)
  const daysMap = useLiveQuery(() => daysMapInRange(fromKey, toKey), [fromKey, toKey], new Map())
  const monthDays = useLiveQuery(() => getDaysInRange(fromKey, toKey), [fromKey, toKey], [])

  const shift = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const goToday = () => {
    const d = new Date()
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div>
      <div class="cal-head">
        <button class="icon-btn" aria-label="Mes anterior" onClick={() => shift(-1)}>
          ←
        </button>
        <h2 onClick={goToday} style={{ cursor: 'pointer' }}>
          {monthTitle(ym.y, ym.m)}
        </h2>
        <button class="icon-btn" aria-label="Mes siguiente" onClick={() => shift(1)}>
          →
        </button>
      </div>

      <BackupReminder />

      <Calendar
        year={ym.y}
        month0={ym.m}
        daysMap={daysMap ?? new Map()}
        onPickDay={setPicked}
      />

      <div style={{ height: '16px' }} />
      <button class="btn ghost block" onClick={() => setPicked(todayKey())}>
        Abrir hoy
      </button>
      <div style={{ height: '10px' }} />

      <MonthSummary days={monthDays ?? []} />

      <div class="stack">
        <button class="btn ghost block" onClick={() => loc.route('/nomina')}>
          🧾 Ver nómina del mes
        </button>
        <button class="btn ghost block" onClick={() => loc.route('/ajustes')}>
          ⚙️ Ajustes y copia de seguridad
        </button>
      </div>

      {picked && <DayEditor date={picked} onClose={() => setPicked(null)} />}

      <BolsaBar />
    </div>
  )
}
