import { useEffect, useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from '../router'
import { getDaysInRange } from '../db/days'
import { getConfigDiasAnio, setConfigDiasAnio, type ConfigDiasAnio } from '../db/diasAnio'
import { usoDiasAnio, type UsoDias } from '../lib/calc/diasAnio'
import { shortDate } from '../lib/datetime'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { toast } from '../lib/toast'

const CATS: { key: keyof UsoDias & keyof ConfigDiasAnio; label: string }[] = [
  { key: 'vacaciones', label: 'Vacaciones' },
  { key: 'asuntosPropios', label: 'Asuntos propios' },
  { key: 'regulacion', label: 'Días de regulación' },
]

function Tarjeta({
  label,
  fechas,
  disponibles,
  onGuardar,
}: {
  label: string
  fechas: string[]
  disponibles: number
  onGuardar: (n: number) => void
}) {
  const [val, setVal] = useState(String(disponibles))
  useEffect(() => setVal(String(disponibles)), [disponibles])
  const usados = fechas.length
  const quedan = disponibles - usados

  return (
    <div class="section">
      <h2>{label}</h2>
      <div class="grid2">
        <div class="stat">
          <div class="k">Usados</div>
          <div class="v">{usados}</div>
        </div>
        <div class="stat">
          <div class="k">Quedan</div>
          <div class="v" style={quedan < 0 ? { color: 'var(--danger)' } : undefined}>
            {quedan}
          </div>
        </div>
      </div>
      <div class="field" style={{ marginTop: '8px' }}>
        <label>Disponibles este año</label>
        <div class="row">
          <input
            type="number"
            inputMode="numeric"
            step="1"
            value={val}
            onInput={(e) => setVal((e.target as HTMLInputElement).value)}
          />
          <button
            class="btn primary"
            style={{ flex: '0 0 auto' }}
            onClick={() => {
              const n = Math.max(0, Math.round(Number(val.replace(',', '.')) || 0))
              setVal(String(n))
              onGuardar(n)
            }}
          >
            Guardar
          </button>
        </div>
      </div>
      {usados > 0 && (
        <CollapsibleSection title={`Ver los ${usados} días`}>
          <div class="card">
            {[...fechas].sort().map((f) => (
              <div class="list-row" key={f}>
                <div class="grow">{shortDate(f)}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

export function DiasAnio() {
  const loc = useLocation()
  const [year, setYear] = useState(new Date().getFullYear())

  const uso = useLiveQuery(
    async () => usoDiasAnio(await getDaysInRange(`${year}-01-01`, `${year}-12-31`)),
    [year],
    { vacaciones: [], asuntosPropios: [], regulacion: [] } as UsoDias,
  )
  const config = useLiveQuery(() => getConfigDiasAnio(year), [year], null)

  return (
    <div>
      <div class="cal-head">
        <button class="icon-btn nav" aria-label="Atrás" onClick={() => loc.route('/')}>
          ←
        </button>
        <h2>Vacaciones y días</h2>
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
        Cuenta tanto el día marcado directamente (vacaciones, asunto propio, regulación) como la
        libranza de un solo día con ese motivo. Cada año es independiente: cambiar los días
        disponibles de {year} no afecta a otros años.
      </p>

      {config &&
        CATS.map((c) => (
          <Tarjeta
            key={c.key}
            label={c.label}
            fechas={uso[c.key]}
            disponibles={config[c.key]}
            onGuardar={(n) => {
              const next = { ...config, [c.key]: n }
              setConfigDiasAnio(year, next)
              toast('Guardado')
            }}
          />
        ))}

      <p class="hint">
        Recuerda: los asuntos propios sin gastar caducan el <strong>1 de enero</strong> (hay que
        pedirlos dentro del mismo año); las vacaciones, el <strong>31 de enero del año
        siguiente</strong>. El aviso automático antes de esas fechas llega en una fase posterior.
      </p>
    </div>
  )
}
