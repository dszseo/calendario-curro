import type { Entry, EntryType } from '../db/types'
import { ENTRY_LABEL } from './scales'

/** Ausencias que ocupan el día completo y se excluyen entre sí y con el trabajo. */
const AUSENCIA_COMPLETA: EntryType[] = [
  'baja',
  'permisoML',
  'vacaciones',
  'asuntoPropio',
  'regulacion',
  'permiso',
  'libranza',
]

/** Entradas que implican haber trabajado ese día. */
const TRABAJO: EntryType[] = ['turno', 'horaExtra', 'diaEspecial']

/** Solo puede haber una por día. El resto admite varias. */
const SINGLETON: EntryType[] = [
  'turno',
  'festivo',
  'baja',
  'permisoML',
  'libranza',
  'libranzaComp',
  'vacaciones',
  'asuntoPropio',
  'regulacion',
  'permiso',
  'disponibilidad',
  'diaEspecial',
]

function pairConflicts(a: EntryType, b: EntryType): boolean {
  if (a === b) return SINGLETON.includes(a)
  const aAus = AUSENCIA_COMPLETA.includes(a)
  const bAus = AUSENCIA_COMPLETA.includes(b)
  if (aAus && bAus) return true // dos ausencias completas distintas el mismo día
  if (aAus && TRABAJO.includes(b)) return true
  if (bAus && TRABAJO.includes(a)) return true
  return false
}

export interface CompatResult {
  ok: boolean
  reason?: string
}

/** ¿Se puede añadir una entrada de este tipo a las que ya tiene el día? */
export function canAddEntry(existing: Entry[], type: EntryType): CompatResult {
  for (const e of existing) {
    if (pairConflicts(e.type, type)) {
      const same = e.type === type
      return {
        ok: false,
        reason: same
          ? `Ya hay «${ENTRY_LABEL[type]}» en este día.`
          : `Incompatible con «${ENTRY_LABEL[e.type]}».`,
      }
    }
  }
  return { ok: true }
}

/** Valida una lista completa de entradas (para restaurar / importar). */
export function validateDay(entries: Entry[]): CompatResult {
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (pairConflicts(entries[i].type, entries[j].type)) {
        return {
          ok: false,
          reason: `«${ENTRY_LABEL[entries[i].type]}» y «${ENTRY_LABEL[entries[j].type]}» no pueden ir el mismo día.`,
        }
      }
    }
  }
  return { ok: true }
}
