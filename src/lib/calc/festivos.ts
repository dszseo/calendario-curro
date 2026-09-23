import { localDateKey, type DateKey } from '../datetime'

/**
 * Festivos automáticos: nacionales (fijos en todo el territorio, más Viernes
 * Santo, que aunque formalmente lo elige cada comunidad, todas lo celebran) y
 * autonómicos propios de cada comunidad (fecha fija). Los locales (municipio)
 * no se pueden calcular sin más datos y se siguen marcando a mano, como
 * siempre — el festivo automático solo es un punto de partida editable.
 *
 * Sin red: todo se calcula con fórmulas o fechas fijas conocidas de antemano,
 * nunca hace falta un fichero por año.
 */

export type ComunidadAutonoma =
  | 'AND'
  | 'ARA'
  | 'AST'
  | 'BAL'
  | 'CAN'
  | 'CANT'
  | 'CLM'
  | 'CYL'
  | 'CAT'
  | 'EXT'
  | 'GAL'
  | 'MAD'
  | 'MUR'
  | 'NAV'
  | 'PV'
  | 'RIO'
  | 'VAL'

export const COMUNIDAD_LABEL: Record<ComunidadAutonoma, string> = {
  AND: 'Andalucía',
  ARA: 'Aragón',
  AST: 'Asturias',
  BAL: 'Islas Baleares',
  CAN: 'Canarias',
  CANT: 'Cantabria',
  CLM: 'Castilla-La Mancha',
  CYL: 'Castilla y León',
  CAT: 'Cataluña',
  EXT: 'Extremadura',
  GAL: 'Galicia',
  MAD: 'Comunidad de Madrid',
  MUR: 'Región de Murcia',
  NAV: 'Comunidad Foral de Navarra',
  PV: 'País Vasco',
  RIO: 'La Rioja',
  VAL: 'Comunitat Valenciana',
}

export interface FestivoAuto {
  nombre: string
  ambito: 'nacional' | 'autonomico'
}

/** Domingo de Pascua (algoritmo anónimo gregoriano / de Gauss). */
function domingoPascua(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31) // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, mes - 1, dia)
}

/** Viernes Santo = domingo de Pascua − 2 días. */
function viernesSanto(year: number): DateKey {
  const p = domingoPascua(year)
  p.setDate(p.getDate() - 2)
  return localDateKey(p)
}

/** Festivos nacionales de fecha fija (mismo día y mes todos los años). */
const NACIONALES_FIJOS: { md: string; nombre: string }[] = [
  { md: '01-01', nombre: 'Año Nuevo' },
  { md: '01-06', nombre: 'Epifanía del Señor' },
  { md: '05-01', nombre: 'Fiesta del Trabajo' },
  { md: '08-15', nombre: 'Asunción de la Virgen' },
  { md: '10-12', nombre: 'Fiesta Nacional de España' },
  { md: '11-01', nombre: 'Todos los Santos' },
  { md: '12-06', nombre: 'Día de la Constitución' },
  { md: '12-08', nombre: 'Inmaculada Concepción' },
  { md: '12-25', nombre: 'Natividad del Señor' },
]

/** Festivos autonómicos propios de fecha fija. Se puede ir ampliando por
 *  comunidad según haga falta; de momento solo Castilla-La Mancha. */
const AUTONOMICOS_FIJOS: Partial<Record<ComunidadAutonoma, { md: string; nombre: string }[]>> = {
  CLM: [{ md: '05-31', nombre: 'Día de Castilla-La Mancha' }],
}

/** Festivo automático de un día, o null si no le corresponde ninguno. */
export function festivoAutoDia(date: DateKey, comunidad: ComunidadAutonoma | null): FestivoAuto | null {
  const year = Number(date.slice(0, 4))
  if (date === viernesSanto(year)) return { nombre: 'Viernes Santo', ambito: 'nacional' }
  const md = date.slice(5)
  const fijo = NACIONALES_FIJOS.find((f) => f.md === md)
  if (fijo) return { nombre: fijo.nombre, ambito: 'nacional' }
  if (comunidad) {
    const auto = AUTONOMICOS_FIJOS[comunidad]?.find((f) => f.md === md)
    if (auto) return { nombre: auto.nombre, ambito: 'autonomico' }
  }
  return null
}
