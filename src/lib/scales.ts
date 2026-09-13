import type {
  Entry,
  EntryType,
  FestivoAmbito,
  LibranzaMotivo,
  Periodo,
  PermisoTipo,
} from '../db/types'

export const PERIODO_LABEL: Record<Periodo, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
}

export const LIBRANZA_LABEL: Record<LibranzaMotivo, string> = {
  asuntos: 'Asuntos propios',
  regulacion: 'Día de regulación',
  vacaciones: 'Vacaciones',
  horas: 'A cuenta de la bolsa de horas',
  permiso: 'Permiso retribuido',
  especial: 'Día libre (día especial)',
}

export const PERMISO_LABEL: Record<PermisoTipo, string> = {
  matrimonio: 'Matrimonio',
  mudanza: 'Mudanza',
  examen: 'Exámenes',
  intervencion: 'Intervención quirúrgica',
  fallecimiento: 'Fallecimiento de familiar (hasta 2.º grado)',
  otro: 'Otro',
}

export const FESTIVO_AMBITO_LABEL: Record<FestivoAmbito, string> = {
  nacional: 'Nacional',
  local: 'Local',
  empresa: 'Empresa / convenio',
}

export const ENTRY_LABEL: Record<EntryType, string> = {
  turno: 'Turno',
  horaExtra: 'Horas extra',
  libranza: 'Libranza (1 día)',
  festivo: 'Festivo',
  baja: 'Baja médica',
  vacaciones: 'Vacaciones',
  asuntoPropio: 'Asunto propio',
  regulacion: 'Día de regulación',
  permiso: 'Permiso retribuido',
  diaEspecial: 'Día especial',
  ajusteBolsa: 'Ajuste de bolsa de horas',
  complemento: 'Complemento (sábado / festivo)',
  libranzaComp: 'Libranza por finde trabajado',
  disponibilidad: 'Disponibilidad (T / D)',
  nota: 'Nota',
}

const h = (n: number) => (Number.isInteger(n) ? `${n} h` : `${n.toFixed(1)} h`)
const signed = (n: number) => `${n > 0 ? '+' : ''}${h(n)}`
const compl = (n: number) =>
  n === 0.5 ? '½' : n === 1 ? '1' : n === 1.5 ? '1½' : String(n)
const TIPO_COMPL: Record<'sabado' | 'festivo', string> = { sabado: 'sábado', festivo: 'festivo' }

export interface EntryView {
  title: string
  sub?: string
  swatch: string // clase CSS "sw-*"
}

/** Texto y color para pintar una entrada en el editor de día. */
export function describeEntry(e: Entry): EntryView {
  switch (e.type) {
    case 'turno':
      return {
        title: `Turno de ${PERIODO_LABEL[e.periodo].toLowerCase()}`,
        sub: e.horaEntrada && e.horaSalida ? `${e.horaEntrada}–${e.horaSalida}` : undefined,
        swatch: `sw-${e.periodo}`,
      }
    case 'horaExtra':
      return {
        title: `Horas extra: ${h(e.horas)}`,
        sub:
          e.destino === 'ambos'
            ? 'A la bolsa y para cobrar (nómina del mes siguiente)'
            : e.destino === 'bolsa'
              ? 'A la bolsa de horas'
              : 'Para cobrar (nómina del mes siguiente)',
        swatch: 'sw-extra',
      }
    case 'libranza':
      return { title: 'Libranza', sub: LIBRANZA_LABEL[e.motivo], swatch: 'sw-libra' }
    case 'festivo':
      return {
        title: e.nombre?.trim() || 'Festivo',
        sub: FESTIVO_AMBITO_LABEL[e.ambito],
        swatch: 'sw-festivo',
      }
    case 'baja':
      return { title: 'Baja médica', sub: e.motivo?.trim() || undefined, swatch: 'sw-baja' }
    case 'vacaciones':
      return { title: 'Vacaciones', swatch: 'sw-vac' }
    case 'asuntoPropio':
      return { title: 'Asunto propio', swatch: 'sw-libra' }
    case 'regulacion':
      return { title: 'Día de regulación', swatch: 'sw-libra' }
    case 'permiso':
      return { title: 'Permiso retribuido', sub: PERMISO_LABEL[e.tipo], swatch: 'sw-libra' }
    case 'diaEspecial':
      return {
        title: 'Día especial',
        sub: [
          e.pagaHorasExtra ? `${h(e.pagaHorasExtra)} extra` : '',
          e.diaLibre ? 'día libre' : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
        swatch: 'sw-extra',
      }
    case 'ajusteBolsa':
      return {
        title: `Bolsa de horas: ${signed(e.override ?? e.horas)}`,
        sub: [
          e.motivo?.trim(),
          e.override !== undefined ? `a mano (calculado ${signed(e.horas)})` : e.auto ? 'automático' : undefined,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
        swatch: 'sw-extra',
      }
    case 'complemento':
      return {
        title: `Complemento de ${TIPO_COMPL[e.tipo]}: ${compl(e.override ?? e.valor)}`,
        sub: [
          e.motivo?.trim(),
          e.override !== undefined ? `a mano (calculado ${compl(e.valor)})` : e.auto ? 'automático' : undefined,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
        swatch: 'sw-festivo',
      }
    case 'libranzaComp':
      return {
        title: `Libranza por ${e.dia} trabajado`,
        sub: [
          '−8 h a la bolsa (compensa el finde)',
          e.auto ? 'automático' : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        swatch: 'sw-libra',
      }
    case 'disponibilidad':
      return {
        title: e.valor === 'T' ? 'Disponible este fin de semana (T)' : 'Descanso este fin de semana (D)',
        sub: e.auto ? 'automático · alterna cada semana' : undefined,
        swatch: 'sw-nota',
      }
    case 'nota':
      return { title: 'Nota', sub: e.texto?.trim() || undefined, swatch: 'sw-nota' }
  }
}
