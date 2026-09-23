import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import type {
  AjusteBolsaEntry,
  ComplementoEntry,
  DiaEspecialEntry,
  DisponibilidadEntry,
  Entry,
  EntryType,
  FestivoEntry,
  HoraExtraEntry,
  LibranzaCompEntry,
  LibranzaEntry,
  NotaEntry,
  PermisoEntry,
  Periodo,
  TurnoEntry,
} from '../db/types'
import {
  addEntry,
  applyTurnoBlock,
  daysMapInRange,
  fillBajaRange,
  fillPermisoMLRange,
  fillVacacionesRange,
  getDay,
  overrideEntrada,
  quitarDisponibilidadFinde,
  recalcularAutoDia,
  removeEntry,
  setAutoOff,
  setDisponibilidadFinde,
  setTurno,
  updateEntry,
} from '../db/days'
import { getMeta, setMeta } from '../db/db'
import { JORNADA_HORAS } from '../lib/config'
import {
  AUTO_CATEGORIA_LABEL,
  ENTRY_LABEL,
  FESTIVO_AMBITO_LABEL,
  LIBRANZA_LABEL,
  PERIODO_LABEL,
  PERMISO_LABEL,
  describeEntry,
} from '../lib/scales'
import { canAddEntry } from '../lib/compat'
import { autofillTurno, esInicioDeBloque } from '../lib/calc/turnos'
import { categoriaDe, esEntradaAuto } from '../lib/calc/auto'
import { compSemana } from '../lib/calc/libranzas'
import { addDaysKey, isWeekend, longDate, mondayOfWorkWeek, shortDate, type DateKey } from '../lib/datetime'
import { toast } from '../lib/toast'
import { SegmentedScale, YesNo } from './SegmentedScale'
import { CollapsibleSection } from './CollapsibleSection'

const BAJA_KEY = 'bajaAbiertaDesde'
const VAC_KEY = 'vacacionesAbiertaDesde'
const PERMISO_ML_KEY = 'permisoMLAbiertoDesde'

// Tipos que se añaden desde el editor (baja y vacaciones se gestionan con el flujo de rango).
const ADDABLE: EntryType[] = [
  'turno',
  'horaExtra',
  'libranza',
  'festivo',
  'asuntoPropio',
  'regulacion',
  'permiso',
  'diaEspecial',
  'ajusteBolsa',
  'complemento',
  'libranzaComp',
  'disponibilidad',
  'nota',
]

type Draft =
  | { mode: 'list' }
  | { mode: 'add'; type: EntryType }
  | { mode: 'edit'; entry: Entry }
  | { mode: 'override'; entry: Entry }

export function DayEditor({ date, onClose }: { date: DateKey; onClose: () => void }) {
  const day = useLiveQuery(() => getDay(date), [date])
  const bajaDesde = useLiveQuery(() => getMeta<DateKey | null>(BAJA_KEY, null), [], null)
  const vacDesde = useLiveQuery(() => getMeta<DateKey | null>(VAC_KEY, null), [], null)
  const permisoMLDesde = useLiveQuery(() => getMeta<DateKey | null>(PERMISO_ML_KEY, null), [], null)
  const [draft, setDraft] = useState<Draft>({ mode: 'list' })

  const entries = day?.entries ?? []
  const hayAjustesAuto =
    (day?.autoOff?.length ?? 0) > 0 ||
    entries.some((e) => (e.type === 'ajusteBolsa' || e.type === 'complemento') && e.override !== undefined)

  async function onSubmit(entry: Entry | Omit<Entry, 'id'>) {
    if (entry.type === 'turno') {
      const t = entry as TurnoEntry
      if (esInicioDeBloque(date, t.periodo)) {
        const block = autofillTurno(date, t.periodo, t.horas)
        await applyTurnoBlock(block)
        // aviso si trabajó el finde pero cambió de turno (rotación rota)
        const monday = mondayOfWorkWeek(date)
        const dias = await daysMapInRange(addDaysKey(monday, -12), addDaysKey(monday, 12))
        const comp = compSemana(monday, dias)
        if (comp.cambioDeTurno && comp.findePeriodo) {
          toast(
            `Trabajaste el finde de ${PERIODO_LABEL[comp.findePeriodo].toLowerCase()} pero has puesto otro turno: añade tú las libranzas por cambio de turno.`,
          )
        } else {
          toast(
            comp.dias.length
              ? `Semana rellenada + ${comp.dias.length} libranza(s) por finde trabajado`
              : `Semana rellenada: ${block.length} días`,
          )
        }
      } else if ('id' in entry) {
        await updateEntry(date, entry as Entry)
      } else {
        await setTurno(date, t)
      }
      onClose()
      return
    }
    if (entry.type === 'disponibilidad') {
      const d = entry as DisponibilidadEntry
      await setDisponibilidadFinde(date, d.valor)
      toast(`Finde marcado como ${d.valor} — alterna solo cada semana a partir de aquí`)
      onClose()
      return
    }
    if ('id' in entry) await updateEntry(date, entry as Entry)
    else await addEntry(date, entry)
    onClose()
  }

  async function startBaja() {
    await addEntry(date, { type: 'baja' } as Omit<Entry, 'id'>)
    await setMeta(BAJA_KEY, date)
    toast('Baja iniciada. Marca el último día para rellenar el rango.')
    onClose()
  }

  async function endBaja(desde: DateKey) {
    const n = await fillBajaRange(desde, date)
    await setMeta(BAJA_KEY, null)
    toast(`Baja de ${n} días rellenada`)
    onClose()
  }

  async function startVacacionesSolo() {
    await addEntry(date, { type: 'vacaciones' } as Omit<Entry, 'id'>)
    toast('Día de vacaciones añadido')
    onClose()
  }

  async function startVacacionesRango() {
    await addEntry(date, { type: 'vacaciones' } as Omit<Entry, 'id'>)
    await setMeta(VAC_KEY, date)
    toast('Vacaciones iniciadas. Marca el último día para rellenar el rango.')
    onClose()
  }

  async function endVacaciones(desde: DateKey) {
    const n = await fillVacacionesRange(desde, date)
    await setMeta(VAC_KEY, null)
    toast(`Vacaciones: ${n} día(s) rellenados (findes y festivos no cuentan)`)
    onClose()
  }

  async function startPermisoML() {
    await addEntry(date, { type: 'permisoML' } as Omit<Entry, 'id'>)
    await setMeta(PERMISO_ML_KEY, date)
    toast('Permiso de maternidad/paternidad iniciado. Marca el último día para rellenar el rango.')
    onClose()
  }

  async function endPermisoML(desde: DateKey) {
    const n = await fillPermisoMLRange(desde, date)
    await setMeta(PERMISO_ML_KEY, null)
    toast(`Permiso de maternidad/paternidad: ${n} días naturales rellenados`)
    onClose()
  }

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{longDate(date)}</h2>
          <button class="icon-btn" aria-label="Cerrar" onClick={onClose}>
            ✕
          </button>
        </div>

        {draft.mode === 'list' && (
          <>
            {entries.length === 0 ? (
              <p class="hint" style={{ marginBottom: '12px' }}>
                Sin nada anotado este día. Pulsa «Añadir».
              </p>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                {entries.map((e) => {
                  const v = describeEntry(e)
                  const auto = esEntradaAuto(e)
                  const cat = categoriaDe(e)
                  const esDispo = e.type === 'disponibilidad'
                  return (
                    <div class="entry-row" key={e.id}>
                      <span class={`swatch ${v.swatch}`} />
                      <div class="grow">
                        <div>
                          {v.title} {auto && <span class="tag-auto">auto</span>}
                        </div>
                        {v.sub && <div class="sub">{v.sub}</div>}
                        {e.notes && <div class="sub">📝 {e.notes}</div>}
                      </div>
                      {esDispo ? (
                        <>
                          <button
                            class="icon-btn"
                            aria-label="Cambiar"
                            onClick={() => setDraft({ mode: 'edit', entry: e })}
                          >
                            ✏️
                          </button>
                          <button
                            class="icon-btn"
                            aria-label="Quitar"
                            onClick={() => quitarDisponibilidadFinde(date)}
                          >
                            🗑️
                          </button>
                        </>
                      ) : auto && cat ? (
                        <>
                          <button
                            class="icon-btn"
                            aria-label="Ajustar a mano"
                            onClick={() => setDraft({ mode: 'override', entry: e })}
                          >
                            ✏️
                          </button>
                          <button
                            class="icon-btn"
                            aria-label="Quitar"
                            onClick={() => setAutoOff(date, cat, true)}
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            class="icon-btn"
                            aria-label="Editar"
                            onClick={() => setDraft({ mode: 'edit', entry: e })}
                          >
                            ✏️
                          </button>
                          <button
                            class="icon-btn"
                            aria-label="Eliminar"
                            onClick={() => removeEntry(date, e.id)}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {(day?.autoOff?.length ?? 0) > 0 && (
              <p class="hint" style={{ marginBottom: '8px' }}>
                ⚠️ Descartaste a mano lo automático de: {day!.autoOff!.map((c) => AUTO_CATEGORIA_LABEL[c]).join(', ')}.
                No se vuelve a calcular solo hasta que pulses «Recalcular».
              </p>
            )}

            {hayAjustesAuto && (
              <button
                class="btn ghost block"
                style={{ marginBottom: '8px' }}
                onClick={() => recalcularAutoDia(date)}
              >
                ↻ Recalcular automáticos de este día
              </button>
            )}

            <button class="btn primary block" onClick={() => setDraft({ mode: 'add', type: 'turno' })}>
              + Añadir al día
            </button>

            <BajaControls
              date={date}
              entries={entries}
              bajaDesde={bajaDesde ?? null}
              onStart={startBaja}
              onEnd={endBaja}
              mostrarInicio={false}
            />

            <PermisoMLControls
              date={date}
              entries={entries}
              permisoMLDesde={permisoMLDesde ?? null}
              onStart={startPermisoML}
              onEnd={endPermisoML}
              mostrarInicio={false}
            />

            <VacacionesControls
              date={date}
              entries={entries}
              vacDesde={vacDesde ?? null}
              onStartSolo={startVacacionesSolo}
              onStartRango={startVacacionesRango}
              onEnd={endVacaciones}
              mostrarInicio={false}
            />

            <AnadirPeriodoControls
              date={date}
              entries={entries}
              bajaDesde={bajaDesde ?? null}
              permisoMLDesde={permisoMLDesde ?? null}
              vacDesde={vacDesde ?? null}
              onBaja={startBaja}
              onPermiso={startPermisoML}
              onVacSolo={startVacacionesSolo}
              onVacRango={startVacacionesRango}
            />
          </>
        )}

        {draft.mode === 'add' && (
          <TypePicker
            date={date}
            existing={entries}
            selected={draft.type}
            onSelect={(type) => setDraft({ mode: 'add', type })}
            onCancel={() => setDraft({ mode: 'list' })}
          >
            <EntryForm
              date={date}
              type={draft.type}
              onSubmit={onSubmit}
              onCancel={() => setDraft({ mode: 'list' })}
            />
          </TypePicker>
        )}

        {draft.mode === 'edit' && (
          <EntryForm
            date={date}
            type={draft.entry.type}
            initial={draft.entry}
            onSubmit={onSubmit}
            onCancel={() => setDraft({ mode: 'list' })}
          />
        )}

        {draft.mode === 'override' && (
          <OverrideForm
            entry={draft.entry}
            onSave={async (valor) => {
              await overrideEntrada(date, draft.entry.id, valor)
              onClose()
            }}
            onCancel={() => setDraft({ mode: 'list' })}
          />
        )}
      </div>
    </div>
  )
}

function OverrideForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: Entry
  onSave: (valor: number | undefined) => void
  onCancel: () => void
}) {
  const esBolsa = entry.type === 'ajusteBolsa'
  const base = entry.type === 'ajusteBolsa' ? entry.horas : entry.type === 'complemento' ? entry.valor : 0
  const actual =
    entry.type === 'ajusteBolsa' || entry.type === 'complemento' ? entry.override ?? base : base
  const [val, setVal] = useState(String(actual))

  return (
    <div class="card" style={{ padding: '12px', marginBottom: '10px' }}>
      <h3 style={{ marginBottom: '10px' }}>Ajustar a mano</h3>
      <p class="hint" style={{ marginBottom: '10px' }}>
        {describeEntry(entry).title}. Valor calculado por la app: <strong>{base}</strong>. Cámbialo si
        has llegado a otro acuerdo; se queda fijo hasta que pulses «recalcular».
      </p>
      <div class="field">
        <label>{esBolsa ? 'Horas a la bolsa' : 'Valor del complemento (1 = entero, 0.5 = medio)'}</label>
        <input
          type="number"
          inputMode="decimal"
          step={esBolsa ? '0.5' : '0.25'}
          value={val}
          onInput={(e) => setVal((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="stack">
        <button class="btn primary block" onClick={() => onSave(Number(val.replace(',', '.')) || 0)}>
          Guardar
        </button>
        <button class="btn ghost block" onClick={() => onSave(undefined)}>
          Volver al valor automático
        </button>
        <button class="btn ghost block" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function BajaControls({
  date,
  entries,
  bajaDesde,
  onStart,
  onEnd,
  mostrarInicio = true,
}: {
  date: DateKey
  entries: Entry[]
  bajaDesde: DateKey | null
  onStart: () => void
  onEnd: (desde: DateKey) => void
  mostrarInicio?: boolean
}) {
  const yaBaja = entries.some((e) => e.type === 'baja')
  if (bajaDesde && date >= bajaDesde) {
    return (
      <div style={{ marginTop: '10px' }}>
        <button class="btn block" onClick={() => onEnd(bajaDesde)}>
          Marcar fin de baja aquí (rellena desde {shortDate(bajaDesde)})
        </button>
      </div>
    )
  }
  if (bajaDesde) {
    return <p class="hint" style={{ marginTop: '10px' }}>Baja abierta desde {shortDate(bajaDesde)}.</p>
  }
  if (yaBaja || !mostrarInicio) return null
  return (
    <div style={{ marginTop: '10px' }}>
      <button class="btn block" onClick={onStart}>
        Marcar inicio de baja médica aquí
      </button>
    </div>
  )
}

function PermisoMLControls({
  date,
  entries,
  permisoMLDesde,
  onStart,
  onEnd,
  mostrarInicio = true,
}: {
  date: DateKey
  entries: Entry[]
  permisoMLDesde: DateKey | null
  onStart: () => void
  onEnd: (desde: DateKey) => void
  mostrarInicio?: boolean
}) {
  const yaPermiso = entries.some((e) => e.type === 'permisoML')
  if (permisoMLDesde && date >= permisoMLDesde) {
    return (
      <div style={{ marginTop: '10px' }}>
        <button class="btn block" onClick={() => onEnd(permisoMLDesde)}>
          Marcar fin de permiso aquí (rellena desde {shortDate(permisoMLDesde)})
        </button>
      </div>
    )
  }
  if (permisoMLDesde) {
    return (
      <p class="hint" style={{ marginTop: '10px' }}>
        Permiso de maternidad/paternidad abierto desde {shortDate(permisoMLDesde)}.
      </p>
    )
  }
  if (yaPermiso || !mostrarInicio) return null
  return (
    <div style={{ marginTop: '10px' }}>
      <button class="btn block" onClick={onStart}>
        Marcar inicio de permiso de maternidad/paternidad aquí
      </button>
    </div>
  )
}

function VacacionesControls({
  date,
  entries,
  vacDesde,
  onStartSolo,
  onStartRango,
  onEnd,
  mostrarInicio = true,
}: {
  date: DateKey
  entries: Entry[]
  vacDesde: DateKey | null
  onStartSolo: () => void
  onStartRango: () => void
  onEnd: (desde: DateKey) => void
  mostrarInicio?: boolean
}) {
  const [asking, setAsking] = useState(false)
  const yaVac = entries.some((e) => e.type === 'vacaciones')

  if (vacDesde && date >= vacDesde) {
    return (
      <div style={{ marginTop: '10px' }}>
        <button class="btn block" onClick={() => onEnd(vacDesde)}>
          Marcar fin de vacaciones aquí (rellena desde {shortDate(vacDesde)})
        </button>
      </div>
    )
  }
  if (vacDesde) {
    return <p class="hint" style={{ marginTop: '10px' }}>Vacaciones abiertas desde {shortDate(vacDesde)}.</p>
  }
  if (yaVac || isWeekend(date) || !mostrarInicio) return null

  if (asking) {
    return (
      <div class="card" style={{ padding: '12px', marginTop: '10px' }}>
        <p class="hint" style={{ marginBottom: '10px' }}>
          ¿Vas a estar de vacaciones solo este día o vas a marcar varios días seguidos?
        </p>
        <div class="stack">
          <button
            class="btn block"
            onClick={() => {
              setAsking(false)
              onStartSolo()
            }}
          >
            Solo este día
          </button>
          <button
            class="btn block"
            onClick={() => {
              setAsking(false)
              onStartRango()
            }}
          >
            Varios días (elegiré el último)
          </button>
          <button class="btn ghost block" onClick={() => setAsking(false)}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: '10px' }}>
      <button class="btn block" onClick={() => setAsking(true)}>
        🏖️ Marcar vacaciones aquí
      </button>
    </div>
  )
}

/**
 * Botón único "+ Añadir periodo" que sustituye a los tres botones sueltos de
 * baja/vacaciones/permiso cuando ninguno está ya abierto ni anotado ese día.
 * Elige tipo (y, si es vacaciones, si es solo hoy o varios días) y dispara el
 * mismo `onStart*` que usaban los controles individuales.
 */
function AnadirPeriodoControls({
  date,
  entries,
  bajaDesde,
  permisoMLDesde,
  vacDesde,
  onBaja,
  onPermiso,
  onVacSolo,
  onVacRango,
}: {
  date: DateKey
  entries: Entry[]
  bajaDesde: DateKey | null
  permisoMLDesde: DateKey | null
  vacDesde: DateKey | null
  onBaja: () => void
  onPermiso: () => void
  onVacSolo: () => void
  onVacRango: () => void
}) {
  const [modo, setModo] = useState<'idle' | 'tipo' | 'vac-alcance'>('idle')

  const algoAbierto = !!bajaDesde || !!permisoMLDesde || !!vacDesde
  const yaAlgunPeriodo = entries.some((e) => e.type === 'baja' || e.type === 'vacaciones' || e.type === 'permisoML')
  if (algoAbierto || yaAlgunPeriodo) return null

  if (modo === 'tipo') {
    return (
      <div class="card" style={{ padding: '12px', marginTop: '10px' }}>
        <p class="hint" style={{ marginBottom: '10px' }}>¿Qué periodo quieres añadir?</p>
        <div class="stack">
          {!isWeekend(date) && (
            <button class="btn block" onClick={() => setModo('vac-alcance')}>
              🏖️ Vacaciones
            </button>
          )}
          <button
            class="btn block"
            onClick={() => {
              setModo('idle')
              onBaja()
            }}
          >
            🩺 Baja médica
          </button>
          <button
            class="btn block"
            onClick={() => {
              setModo('idle')
              onPermiso()
            }}
          >
            👶 Permiso de maternidad/paternidad
          </button>
          <button class="btn ghost block" onClick={() => setModo('idle')}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (modo === 'vac-alcance') {
    return (
      <div class="card" style={{ padding: '12px', marginTop: '10px' }}>
        <p class="hint" style={{ marginBottom: '10px' }}>
          ¿Vas a estar de vacaciones solo este día o vas a marcar varios días seguidos?
        </p>
        <div class="stack">
          <button
            class="btn block"
            onClick={() => {
              setModo('idle')
              onVacSolo()
            }}
          >
            Solo este día
          </button>
          <button
            class="btn block"
            onClick={() => {
              setModo('idle')
              onVacRango()
            }}
          >
            Varios días (elegiré el último)
          </button>
          <button class="btn ghost block" onClick={() => setModo('tipo')}>
            Atrás
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <button class="btn block" onClick={() => setModo('tipo')}>
        + Añadir periodo (vacaciones, baja, permiso...)
      </button>
    </div>
  )
}

function TypePicker({
  date,
  existing,
  selected,
  onSelect,
  onCancel,
  children,
}: {
  date: DateKey
  existing: Entry[]
  selected: EntryType
  onSelect: (t: EntryType) => void
  onCancel: () => void
  children: ComponentChildren
}) {
  return (
    <div>
      <div class="type-grid" style={{ marginBottom: '12px' }}>
        {ADDABLE.map((t) => {
          const c = canAddEntry(existing, t)
          const soloFinde = t === 'disponibilidad' && !isWeekend(date)
          const ok = c.ok && !soloFinde
          return (
            <button
              key={t}
              disabled={!ok && t !== selected}
              aria-pressed={t === selected}
              class={t === selected ? 'primary' : ''}
              style={t === selected ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
              onClick={() => onSelect(t)}
              title={soloFinde ? 'Solo se puede fijar en sábado o domingo' : c.reason}
            >
              {ENTRY_LABEL[t]}
            </button>
          )
        })}
      </div>
      {children}
      <button class="btn ghost block" style={{ marginTop: '8px' }} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  )
}

// ---------- Formularios por tipo ----------

function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div class="field">
      <label>Nota (opcional)</label>
      <textarea
        value={value}
        placeholder="Ej. baja por la rodilla, salí antes por médico…"
        onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    </div>
  )
}

function num(v: string, fallback = 0): number {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function EntryForm({
  date,
  type,
  initial,
  onSubmit,
  onCancel,
}: {
  date: DateKey
  type: EntryType
  initial?: Entry
  onSubmit: (e: Entry | Omit<Entry, 'id'>) => void
  onCancel: () => void
}) {
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function emit(data: Record<string, unknown>) {
    const out: Record<string, unknown> = { ...data }
    if (initial) out.id = initial.id
    if (data.type !== 'nota') out.notes = notes.trim() || undefined
    onSubmit(out as unknown as Entry | Omit<Entry, 'id'>)
  }

  // turno
  const t0 = initial?.type === 'turno' ? (initial as TurnoEntry) : undefined
  const [periodo, setPeriodo] = useState<Periodo>(t0?.periodo ?? 'manana')
  const [tHoras, setTHoras] = useState(String(t0?.horas ?? JORNADA_HORAS))
  const [hEntrada, setHEntrada] = useState(t0?.horaEntrada ?? '')
  const [hSalida, setHSalida] = useState(t0?.horaSalida ?? '')

  // horaExtra
  const x0 = initial?.type === 'horaExtra' ? (initial as HoraExtraEntry) : undefined
  const [xHoras, setXHoras] = useState(String(x0?.horas ?? JORNADA_HORAS))
  const [xCobrar, setXCobrar] = useState(x0 ? x0.destino === 'cobrar' || x0.destino === 'ambos' : false)
  const [xBolsa, setXBolsa] = useState(x0 ? x0.destino === 'bolsa' || x0.destino === 'ambos' : true)

  // libranza
  const l0 = initial?.type === 'libranza' ? (initial as LibranzaEntry) : undefined
  const [lMotivo, setLMotivo] = useState<LibranzaEntry['motivo']>(l0?.motivo ?? 'asuntos')

  // festivo
  const f0 = initial?.type === 'festivo' ? (initial as FestivoEntry) : undefined
  const [fAmbito, setFAmbito] = useState<FestivoEntry['ambito']>(f0?.ambito ?? 'local')
  const [fNombre, setFNombre] = useState(f0?.nombre ?? '')

  // permiso
  const p0 = initial?.type === 'permiso' ? (initial as PermisoEntry) : undefined
  const [pTipo, setPTipo] = useState<PermisoEntry['tipo']>(p0?.tipo ?? 'fallecimiento')

  // diaEspecial
  const de0 = initial?.type === 'diaEspecial' ? (initial as DiaEspecialEntry) : undefined
  const [deExtra, setDeExtra] = useState(de0?.pagaHorasExtra ? String(de0.pagaHorasExtra) : '')
  const [deLibre, setDeLibre] = useState<boolean | undefined>(de0?.diaLibre)

  // ajusteBolsa
  const a0 = initial?.type === 'ajusteBolsa' ? (initial as AjusteBolsaEntry) : undefined
  const [aHoras, setAHoras] = useState(a0 ? String(a0.horas) : '-2')
  const [aMotivo, setAMotivo] = useState(a0?.motivo ?? '')

  // complemento (alta manual)
  const c0 = initial?.type === 'complemento' ? (initial as ComplementoEntry) : undefined
  const [cTipo, setCTipo] = useState<'sabado' | 'festivo'>(c0?.tipo ?? 'sabado')
  const [cValor, setCValor] = useState(c0 ? String(c0.valor) : '1')

  // libranzaComp (alta manual)
  const lc0 = initial?.type === 'libranzaComp' ? (initial as LibranzaCompEntry) : undefined
  const [lcDia, setLcDia] = useState<'sabado' | 'domingo'>(lc0?.dia ?? 'sabado')

  // disponibilidad
  const d0 = initial?.type === 'disponibilidad' ? (initial as DisponibilidadEntry) : undefined
  const [dVal, setDVal] = useState<'T' | 'D'>(d0?.valor ?? 'T')

  // nota
  const n0 = initial?.type === 'nota' ? (initial as NotaEntry) : undefined
  const [nTexto, setNTexto] = useState(n0?.texto ?? '')

  function submit() {
    switch (type) {
      case 'turno':
        return emit({
          type: 'turno',
          periodo,
          horas: num(tHoras, JORNADA_HORAS),
          horaEntrada: hEntrada || undefined,
          horaSalida: hSalida || undefined,
        })
      case 'horaExtra':
        return emit({
          type: 'horaExtra',
          horas: num(xHoras, JORNADA_HORAS),
          destino: xCobrar && xBolsa ? 'ambos' : xCobrar ? 'cobrar' : 'bolsa',
        })
      case 'libranza':
        return emit({ type: 'libranza', motivo: lMotivo })
      case 'festivo':
        return emit({ type: 'festivo', ambito: fAmbito, nombre: fNombre.trim() || undefined })
      case 'vacaciones':
      case 'asuntoPropio':
      case 'regulacion':
        return emit({ type })
      case 'permiso':
        return emit({ type: 'permiso', tipo: pTipo })
      case 'diaEspecial':
        return emit({
          type: 'diaEspecial',
          pagaHorasExtra: deExtra ? num(deExtra) : undefined,
          diaLibre: deLibre || undefined,
        })
      case 'ajusteBolsa':
        return emit({ type: 'ajusteBolsa', horas: num(aHoras), motivo: aMotivo.trim() || undefined })
      case 'complemento':
        return emit({ type: 'complemento', tipo: cTipo, valor: num(cValor, 1) })
      case 'libranzaComp':
        return emit({ type: 'libranzaComp', dia: lcDia })
      case 'disponibilidad':
        return emit({ type: 'disponibilidad', valor: dVal })
      case 'nota':
        return emit({ type: 'nota', texto: nTexto.trim() })
      case 'baja':
        return emit({ type: 'baja' })
      case 'permisoML':
        return emit({ type: 'permisoML' })
    }
  }

  const canSave = type !== 'nota' || nTexto.trim().length > 0

  return (
    <div class="card" style={{ padding: '12px', marginBottom: '10px' }}>
      <h3 style={{ marginBottom: '10px' }}>{initial ? 'Editar' : 'Nuevo'}: {ENTRY_LABEL[type]}</h3>

      {type === 'turno' && (
        <>
          <div class="field">
            <label>Periodo</label>
            <SegmentedScale
              options={[
                { value: 'manana', label: 'Mañana' },
                { value: 'tarde', label: 'Tarde' },
                { value: 'noche', label: 'Noche' },
              ]}
              value={periodo}
              onChange={(v) => v && setPeriodo(v)}
            />
          </div>
          <p class="hint">
            {esInicioDeBloque(date, periodo)
              ? periodo === 'noche'
                ? 'Se rellenan automáticamente 5 noches seguidas.'
                : 'Se rellena automáticamente de lunes a viernes.'
              : 'Solo cambia este día. La semana se rellena poniendo el turno en el lunes (o domingo/lunes para noche).'}{' '}
            La app añadirá sola los ajustes de bolsa y complementos que correspondan (los verás
            en la lista y podrás editarlos). Si sales antes o te quedas más, añade un «Ajuste de
            bolsa de horas».
          </p>
          <CollapsibleSection title="Horas y hora de entrada / salida">
            <div class="field">
              <label>Horas del turno</label>
              <input type="number" inputMode="decimal" step="0.5" value={tHoras} onInput={(e) => setTHoras((e.target as HTMLInputElement).value)} />
            </div>
            <div class="row">
              <div>
                <label class="hint">Entrada</label>
                <input type="time" value={hEntrada} onInput={(e) => setHEntrada((e.target as HTMLInputElement).value)} />
              </div>
              <div>
                <label class="hint">Salida</label>
                <input type="time" value={hSalida} onInput={(e) => setHSalida((e.target as HTMLInputElement).value)} />
              </div>
            </div>
          </CollapsibleSection>
        </>
      )}

      {type === 'horaExtra' && (
        <>
          <div class="field">
            <label>Horas</label>
            <input type="number" inputMode="decimal" step="0.5" value={xHoras} onInput={(e) => setXHoras((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>¿Qué se hace con ellas? (puedes marcar las dos, p.ej. festivo que se cobra y además da día libre)</label>
            <div class="seg">
              <button
                type="button"
                aria-pressed={xBolsa}
                onClick={() => setXBolsa((v) => (v && !xCobrar ? v : !v))}
              >
                A la bolsa de horas
              </button>
              <button
                type="button"
                aria-pressed={xCobrar}
                onClick={() => setXCobrar((v) => (v && !xBolsa ? v : !v))}
              >
                Cobrar (mes siguiente)
              </button>
            </div>
          </div>
        </>
      )}

      {type === 'libranza' && (
        <div class="field">
          <label>¿Qué día se usa? (sección 17)</label>
          {/* «Vacaciones» se quita de aquí a propósito: es la misma anotación
              que ya cubre «+ Añadir periodo», y tenerla en los dos sitios
              duplicaba la forma de marcar un día de vacaciones. */}
          <div class="stack">
            {(Object.keys(LIBRANZA_LABEL) as LibranzaEntry['motivo'][])
              .filter((m) => m !== 'vacaciones')
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  class={`btn ${lMotivo === m ? 'primary' : ''}`}
                  onClick={() => setLMotivo(m)}
                >
                  {LIBRANZA_LABEL[m]}
                </button>
              ))}
          </div>
        </div>
      )}

      {type === 'festivo' && (
        <>
          <div class="field">
            <label>Ámbito</label>
            <SegmentedScale
              options={(Object.keys(FESTIVO_AMBITO_LABEL) as FestivoEntry['ambito'][]).map((a) => ({
                value: a,
                label: FESTIVO_AMBITO_LABEL[a],
              }))}
              value={fAmbito}
              onChange={(v) => v && setFAmbito(v)}
            />
          </div>
          <div class="field">
            <label>Nombre (opcional)</label>
            <input type="text" value={fNombre} placeholder="Ej. San Isidro" onInput={(e) => setFNombre((e.target as HTMLInputElement).value)} />
          </div>
          {isWeekend(date) && (
            <p class="hint">
              Cae en fin de semana: cuando llegue el motor de cálculo se pagará el festivo y no el
              sábado/domingo.
            </p>
          )}
        </>
      )}

      {type === 'permiso' && (
        <div class="field">
          <label>Motivo</label>
          <div class="stack">
            {(Object.keys(PERMISO_LABEL) as PermisoEntry['tipo'][]).map((tp) => (
              <button key={tp} type="button" class={`btn ${pTipo === tp ? 'primary' : ''}`} onClick={() => setPTipo(tp)}>
                {PERMISO_LABEL[tp]}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === 'diaEspecial' && (
        <>
          <div class="field">
            <label>Horas extra que paga (opcional)</label>
            <input type="number" inputMode="decimal" step="0.5" value={deExtra} placeholder="Ej. 8" onInput={(e) => setDeExtra((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>¿Da un día libre?</label>
            <YesNo value={deLibre} onChange={setDeLibre} />
          </div>
        </>
      )}

      {type === 'ajusteBolsa' && (
        <>
          <div class="field">
            <label>Horas (usa − para restar)</label>
            <input type="number" inputMode="decimal" step="0.5" value={aHoras} onInput={(e) => setAHoras((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>Motivo (opcional)</label>
            <input type="text" value={aMotivo} placeholder="Ej. salí 2 h antes el viernes" onInput={(e) => setAMotivo((e.target as HTMLInputElement).value)} />
          </div>
        </>
      )}

      {type === 'complemento' && (
        <>
          <p class="hint" style={{ marginBottom: '10px' }}>
            Normalmente la app los pone sola al rellenar turnos. Añade uno a mano solo si falta.
          </p>
          <div class="field">
            <label>Tipo</label>
            <SegmentedScale
              options={[
                { value: 'sabado', label: 'Sábado' },
                { value: 'festivo', label: 'Festivo' },
              ]}
              value={cTipo}
              onChange={(v) => v && setCTipo(v)}
            />
          </div>
          <div class="field">
            <label>Valor (1 = entero · 0.5 = medio)</label>
            <input type="number" inputMode="decimal" step="0.25" value={cValor} onInput={(e) => setCValor((e.target as HTMLInputElement).value)} />
          </div>
        </>
      )}

      {type === 'libranzaComp' && (
        <>
          <p class="hint" style={{ marginBottom: '10px' }}>
            Normalmente la app la pone sola al poner el turno de la semana. Añádela a mano si
            hubo cambio de turno. Resta 8 h a la bolsa (compensa el finde).
          </p>
          <div class="field">
            <label>Compensa el…</label>
            <SegmentedScale
              options={[
                { value: 'sabado', label: 'Sábado trabajado' },
                { value: 'domingo', label: 'Domingo trabajado' },
              ]}
              value={lcDia}
              onChange={(v) => v && setLcDia(v)}
            />
          </div>
        </>
      )}

      {type === 'disponibilidad' && (
        <>
          <p class="hint" style={{ marginBottom: '10px' }}>
            Se aplica a todo el finde (sábado y domingo) y a partir de aquí alterna T/D sola cada
            semana, hasta que fijes otro finde distinto.
          </p>
          <div class="field">
            <label>Este fin de semana</label>
            <SegmentedScale
              options={[
                { value: 'T', label: 'T — disponible' },
                { value: 'D', label: 'D — descanso' },
              ]}
              value={dVal}
              onChange={(v) => v && setDVal(v)}
            />
          </div>
        </>
      )}

      {type === 'nota' && (
        <div class="field">
          <label>Texto</label>
          <textarea value={nTexto} onInput={(e) => setNTexto((e.target as HTMLTextAreaElement).value)} />
        </div>
      )}

      {type !== 'nota' && type !== 'disponibilidad' && <NotesField value={notes} onChange={setNotes} />}

      <div class="row">
        <button class="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button class="btn primary" disabled={!canSave} onClick={submit}>
          {initial ? 'Guardar' : 'Añadir'}
        </button>
      </div>
    </div>
  )
}
