import { useEffect, useRef, useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from '../router'
import { daysMapInRange, getDaysInRange, regenerarRangoVisible } from '../db/days'
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
  const [dir, setDir] = useState<1 | -1>(1)

  const { fromKey, toKey } = monthKeyRange(ym.y, ym.m)
  const daysMap = useLiveQuery(() => daysMapInRange(fromKey, toKey), [fromKey, toKey], new Map())
  const monthDays = useLiveQuery(() => getDaysInRange(fromKey, toKey), [fromKey, toKey], [])

  // Asegura que los findes T/D del mes visible existen (aunque no tengan turno).
  useEffect(() => {
    regenerarRangoVisible(fromKey, toKey).catch(() => {})
  }, [fromKey, toKey])

  const shift = (delta: number) => {
    setDir(delta >= 0 ? 1 : -1)
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const goToday = () => {
    const d = new Date()
    setDir(d.getFullYear() !== ym.y ? (d.getFullYear() > ym.y ? 1 : -1) : d.getMonth() >= ym.m ? 1 : -1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }

  // Deslizar con el dedo para cambiar de mes (cabecera + rejilla de días).
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_MIN_PX = 50

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shift(dx < 0 ? 1 : -1)
    }
  }

  return (
    <div>
      <div
        key={`${ym.y}-${ym.m}`}
        class={`cal-swipe ${dir === 1 ? 'cal-slide-next' : 'cal-slide-prev'}`}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div class="cal-head">
          <button class="icon-btn nav" aria-label="Mes anterior" onClick={() => shift(-1)}>
            ←
          </button>
          <h2 onClick={goToday} style={{ cursor: 'pointer' }}>
            {monthTitle(ym.y, ym.m)}
          </h2>
          <button class="icon-btn nav" aria-label="Mes siguiente" onClick={() => shift(1)}>
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
      </div>

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
        <button class="btn ghost block" onClick={() => loc.route('/bolsa-anio')}>
          📋 Ver bolsa del año
        </button>
        <button class="btn ghost block" onClick={() => loc.route('/dias-anio')}>
          🏖️ Vacaciones y días del año
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
