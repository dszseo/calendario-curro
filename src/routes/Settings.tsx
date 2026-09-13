import { useEffect, useRef, useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from '../router'
import { db, getMeta, setMeta, SCHEMA_VERSION } from '../db/db'
import { BOLSA_INICIAL_KEY, saldoBolsa } from '../db/bolsa'
import {
  backupFilename,
  backupToString,
  buildBackup,
  parseBackup,
  restoreBackup,
  type ParsedBackup,
  type RestoreMode,
} from '../export/json'
import {
  deleteSnapshot,
  listSnapshots,
  readSnapshot,
  saveSnapshot,
  snapshotsSupported,
  type SnapshotInfo,
} from '../export/snapshots'
import { downloadText, readFileAsText, shareTextFile } from '../lib/download'
import { requestPersistentStorage, storageStatus } from '../lib/persist'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { toast } from '../lib/toast'

export function Settings() {
  const loc = useLocation()
  return (
    <div>
      <div class="cal-head">
        <button class="icon-btn nav" aria-label="Atrás" onClick={() => loc.route('/')}>
          ←
        </button>
        <h2>Ajustes</h2>
        <span style={{ width: '46px' }} />
      </div>
      <BolsaInicialSection />
      <BackupSection />
      <SnapshotsSection />
      <StorageSection />
      <AboutSection />
    </div>
  )
}

function BolsaInicialSection() {
  const stored = useLiveQuery(() => getMeta<number>(BOLSA_INICIAL_KEY, 0), [], 0)
  const saldo = useLiveQuery(() => saldoBolsa(), [], null)
  const [val, setVal] = useState('')
  useEffect(() => {
    if (stored != null) setVal(String(stored))
  }, [stored])

  return (
    <section class="section">
      <h2>Bolsa de horas</h2>
      <p class="hint">
        Saldo con el que arranca la app (lo que ya te debían o debías antes de empezar a usarla).
        El saldo total se calcula sumando horas extra a bolsa, libranzas a cuenta de horas y
        ajustes. No se reinicia nunca.
      </p>
      <div class="field" style={{ marginTop: '10px' }}>
        <label>Saldo inicial (horas, admite negativo)</label>
        <div class="row">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={val}
            onInput={(e) => setVal((e.target as HTMLInputElement).value)}
          />
          <button
            class="btn primary"
            style={{ flex: '0 0 auto' }}
            onClick={async () => {
              await setMeta(BOLSA_INICIAL_KEY, Number(val.replace(',', '.')) || 0)
              toast('Saldo inicial guardado')
            }}
          >
            Guardar
          </button>
        </div>
      </div>
      <p class="hint">Saldo total actual: <strong>{saldo == null ? '…' : `${saldo} h`}</strong></p>
    </section>
  )
}

function daysSince(ts: number | null): number | null {
  if (!ts) return null
  return Math.floor((Date.now() - ts) / 86_400_000)
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [lastBackup, setLastBackup] = useState<number | null>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMeta<number | null>('lastBackupAt', null).then(setLastBackup)
  }, [])

  async function markDone() {
    const now = Date.now()
    await setMeta('lastBackupAt', now)
    setLastBackup(now)
  }

  async function doDownload() {
    setBusy(true)
    try {
      const text = backupToString(await buildBackup())
      downloadText(backupFilename(), text, 'application/json')
      await markDone()
      toast('Copia descargada')
    } finally {
      setBusy(false)
    }
  }

  async function doShare() {
    setBusy(true)
    try {
      const text = backupToString(await buildBackup())
      const ok = await shareTextFile(backupFilename(), text, 'application/json')
      if (ok) {
        await markDone()
        toast('Copia compartida')
      } else {
        downloadText(backupFilename(), text, 'application/json')
        await markDone()
        toast('Compartir no disponible: copia descargada')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      setPending(parseBackup(await readFileAsText(file)))
    } catch (err) {
      toast((err as Error).message)
    }
  }

  const d = daysSince(lastBackup)

  return (
    <section class="section">
      <h2>Copia de seguridad</h2>
      <p class="hint">
        Archivo <code>.json</code> con todo. En Android puedes mandarlo a Drive con «Compartir».
        Guárdalo de vez en cuando fuera del móvil.
      </p>
      {d !== null && d >= 10 && (
        <div class="note-banner warn">⚠️ Última copia hace {d} días.</div>
      )}
      <div class="stack">
        <button class="btn primary block" disabled={busy} onClick={doShare}>
          📤 Compartir copia (Drive, correo…)
        </button>
        <button class="btn block" disabled={busy} onClick={doDownload}>
          ⬇️ Descargar copia
        </button>
        <button class="btn block" onClick={() => fileRef.current?.click()}>
          ⬆️ Restaurar desde archivo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={onFile}
        />
      </div>
      {lastBackup && (
        <p class="hint">Última copia: {new Date(lastBackup).toLocaleString('es-ES')}</p>
      )}

      {pending && (
        <RestoreDialog
          parsed={pending}
          onCancel={() => setPending(null)}
          onConfirm={async (mode) => {
            await restoreBackup(pending.file, mode)
            setPending(null)
            toast('Datos restaurados')
          }}
        />
      )}
    </section>
  )
}

function RestoreDialog({
  parsed,
  onConfirm,
  onCancel,
}: {
  parsed: ParsedBackup
  onConfirm: (mode: RestoreMode) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<RestoreMode>('replace')
  return (
    <div class="dialog-backdrop" onClick={onCancel}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Restaurar copia</h2>
        <p class="hint">
          {parsed.counts.days} días · {parsed.counts.entries} anotaciones · {parsed.counts.meta} ajustes
        </p>
        {parsed.warnings.length > 0 && (
          <p class="hint" style={{ color: 'var(--warn)' }}>
            {parsed.warnings.length} día(s) con combinaciones raras; se restauran igualmente.
          </p>
        )}
        <div class="field" style={{ marginTop: '10px' }}>
          <label>Modo</label>
          <div class="seg">
            <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              Reemplazar todo
            </button>
            <button type="button" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
              Fusionar
            </button>
          </div>
          <div class="hint">
            {mode === 'replace'
              ? 'Borra lo actual y deja solo lo del archivo.'
              : 'Sobrescribe los días que coincidan por fecha; conserva el resto.'}
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button class={`btn ${mode === 'replace' ? 'danger' : 'primary'}`} onClick={() => onConfirm(mode)}>
            Restaurar
          </button>
        </div>
      </div>
    </div>
  )
}

function SnapshotsSection() {
  const supported = snapshotsSupported()
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([])
  const [restore, setRestore] = useState<SnapshotInfo | null>(null)
  const refresh = () => listSnapshots().then(setSnaps)

  useEffect(() => {
    if (supported) refresh()
  }, [supported])

  if (!supported) {
    return (
      <section class="section">
        <h2>Copias automáticas</h2>
        <p class="hint">Este navegador no soporta el almacenamiento de copias automáticas locales.</p>
      </section>
    )
  }

  return (
    <section class="section">
      <h2>Copias automáticas (en el móvil)</h2>
      <p class="hint">
        La app guarda una copia local cada vez que cambias algo (conserva las 10 últimas). Se
        pierden si borras los datos del navegador o desinstalas.
      </p>
      <button
        class="btn block"
        onClick={async () => {
          await saveSnapshot()
          await refresh()
          toast('Copia local guardada')
        }}
      >
        Guardar copia local ahora
      </button>
      {snaps.length > 0 && (
        <div class="card" style={{ marginTop: '8px' }}>
          {snaps.map((s) => (
            <div class="list-row" key={s.name}>
              <div class="grow">
                {new Date(s.savedAt).toLocaleString('es-ES')}
                <div class="sub">{s.sizeKB} KB</div>
              </div>
              <button class="btn ghost" onClick={() => setRestore(s)}>
                Restaurar
              </button>
              <button
                class="icon-btn"
                aria-label="Eliminar"
                onClick={async () => {
                  await deleteSnapshot(s.name)
                  await refresh()
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {restore && (
        <ConfirmDialog
          title="Restaurar copia local"
          message={`Se reemplazarán todos los datos actuales por los de la copia del ${new Date(restore.savedAt).toLocaleString('es-ES')}.`}
          confirmLabel="Restaurar"
          onConfirm={async () => {
            const text = await readSnapshot(restore.name)
            setRestore(null)
            if (!text) return toast('No se pudo leer la copia')
            try {
              const parsed = parseBackup(text)
              await restoreBackup(parsed.file, 'replace')
              toast('Datos restaurados')
            } catch (err) {
              toast((err as Error).message)
            }
          }}
          onCancel={() => setRestore(null)}
        />
      )}
    </section>
  )
}

function StorageSection() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof storageStatus>> | null>(null)
  const refresh = () => storageStatus().then(setStatus)
  useEffect(() => {
    refresh()
  }, [])

  return (
    <section class="section">
      <h2>Almacenamiento</h2>
      {status && (
        <>
          <p class="hint">
            Persistente:{' '}
            <strong>{status.persisted ? 'sí ✓' : status.supported ? 'no' : 'no soportado'}</strong>
            {status.usageMB != null && ` · uso ${status.usageMB} MB`}
          </p>
          {!status.persisted && status.supported && (
            <button
              class="btn block"
              onClick={async () => {
                const ok = await requestPersistentStorage()
                toast(ok ? 'Almacenamiento persistente activado' : 'El navegador no lo concedió')
                refresh()
              }}
            >
              Activar almacenamiento persistente
            </button>
          )}
          <p class="hint">
            Con el almacenamiento persistente el navegador no borra tus datos para liberar
            espacio. Aun así, haz copias de seguridad.
          </p>
        </>
      )}
    </section>
  )
}

function AboutSection() {
  const count = useLiveQuery(() => db.days.count(), [], 0)
  const [danger, setDanger] = useState(false)
  return (
    <section class="section">
      <h2>Acerca de</h2>
      <p class="hint">
        Calendario Curro · formato de datos v{SCHEMA_VERSION} · {count} días con anotaciones. Todo
        se guarda solo en este dispositivo y funciona sin conexión.
      </p>
      <button class="btn danger ghost block" onClick={() => setDanger(true)}>
        Borrar todos los datos
      </button>
      {danger && (
        <ConfirmDialog
          title="Borrar todos los datos"
          message="Se eliminan todos los días y ajustes de este dispositivo. Descarga una copia antes si quieres conservarlos."
          confirmLabel="Borrar todo"
          onConfirm={async () => {
            await Promise.all([db.days.clear(), db.meta.clear()])
            setDanger(false)
            toast('Datos borrados')
          }}
          onCancel={() => setDanger(false)}
        />
      )}
    </section>
  )
}
