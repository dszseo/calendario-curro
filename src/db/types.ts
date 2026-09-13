import type { DateKey } from '../lib/datetime'

export type Periodo = 'manana' | 'tarde' | 'noche'

export type LibranzaMotivo =
  | 'asuntos' // asuntos propios
  | 'regulacion' // días de regulación
  | 'vacaciones'
  | 'horas' // a cuenta de la bolsa de horas
  | 'permiso' // permiso retribuido
  | 'especial' // día libre por día especial trabajado

export type FestivoAmbito = 'nacional' | 'local' | 'empresa'

export type PermisoTipo =
  | 'matrimonio'
  | 'mudanza'
  | 'examen'
  | 'intervencion'
  | 'fallecimiento'
  | 'otro'

export type Disponibilidad = 'T' | 'D'

export type EntryType =
  | 'turno'
  | 'horaExtra'
  | 'libranza'
  | 'festivo'
  | 'baja'
  | 'vacaciones'
  | 'asuntoPropio'
  | 'regulacion'
  | 'permiso'
  | 'diaEspecial'
  | 'ajusteBolsa'
  | 'complemento'
  | 'libranzaComp'
  | 'disponibilidad'
  | 'nota'

/** Categorías de entrada que la app genera y mantiene automáticamente. */
export type AutoCategoria = 'bolsa' | 'complemento' | 'libranza'

interface BaseEntry {
  id: string
  type: EntryType
  notes?: string
  /** true si la creó la app al rellenar turnos/festivos. El usuario puede
   *  editarla o quitarla; al hacerlo deja de ser automática. */
  auto?: boolean
}

export interface TurnoEntry extends BaseEntry {
  type: 'turno'
  periodo: Periodo
  /** Horas del turno. Normalmente la jornada completa (8). Informativo: los
   *  desvíos (salir antes, quedarse más) se anotan como ajuste de bolsa, no
   *  cambiando este valor. */
  horas: number
  horaEntrada?: string // "HH:mm"
  horaSalida?: string
}

export interface HoraExtraEntry extends BaseEntry {
  type: 'horaExtra'
  horas: number
  /** 'ambos': se cobra Y además va a la bolsa (p.ej. festivo que da día libre y se paga). */
  destino: 'cobrar' | 'bolsa' | 'ambos'
}

export interface LibranzaEntry extends BaseEntry {
  type: 'libranza'
  motivo: LibranzaMotivo
}

export interface FestivoEntry extends BaseEntry {
  type: 'festivo'
  ambito: FestivoAmbito
  nombre?: string
}

export interface BajaEntry extends BaseEntry {
  type: 'baja'
  motivo?: string
}

export interface SimpleDiaEntry extends BaseEntry {
  type: 'vacaciones' | 'asuntoPropio' | 'regulacion'
}

export interface PermisoEntry extends BaseEntry {
  type: 'permiso'
  tipo: PermisoTipo
}

export interface DiaEspecialEntry extends BaseEntry {
  type: 'diaEspecial'
  pagaHorasExtra?: number
  diaLibre?: boolean
}

export interface AjusteBolsaEntry extends BaseEntry {
  type: 'ajusteBolsa'
  horas: number // positivo o negativo (valor calculado, si es auto)
  /** Valor puesto a mano por el usuario; manda sobre `horas` en entradas auto. */
  override?: number
  motivo?: string
}

export interface ComplementoEntry extends BaseEntry {
  type: 'complemento'
  tipo: 'sabado' | 'festivo'
  valor: number // 1 (entero) o 0.5 (medio) — valor calculado
  /** Valor puesto a mano por el usuario; manda sobre `valor` en entradas auto. */
  override?: number
  motivo?: string
}

/** Libranza compensatoria por trabajar el fin de semana (la semana siguiente). */
export interface LibranzaCompEntry extends BaseEntry {
  type: 'libranzaComp'
  dia: 'sabado' | 'domingo' // qué día del finde compensa
}

export interface DisponibilidadEntry extends BaseEntry {
  type: 'disponibilidad'
  valor: Disponibilidad
}

export interface NotaEntry extends BaseEntry {
  type: 'nota'
  texto: string
}

export type Entry =
  | TurnoEntry
  | HoraExtraEntry
  | LibranzaEntry
  | FestivoEntry
  | BajaEntry
  | SimpleDiaEntry
  | PermisoEntry
  | DiaEspecialEntry
  | AjusteBolsaEntry
  | ComplementoEntry
  | LibranzaCompEntry
  | DisponibilidadEntry
  | NotaEntry

export interface Day {
  date: DateKey // clave primaria "YYYY-MM-DD"
  entries: Entry[]
  updatedAt: number
  /** Categorías cuyas entradas automáticas ha descartado el usuario en este día
   *  (editándolas o quitándolas). La app no las vuelve a generar hasta que se
   *  pulse «recalcular». */
  autoOff?: AutoCategoria[]
}

export interface MetaEntry {
  key: string
  value: unknown
}

export interface BackupFile {
  app: 'calendario-curro'
  schemaVersion: number
  exportedAt: string
  days: Day[]
  meta: MetaEntry[]
}
