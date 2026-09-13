import { differenceInCalendarDays, format, getISOWeek, parse } from 'date-fns'
import { es } from 'date-fns/locale'

/** Clave de día en hora local: "YYYY-MM-DD". Es la unidad de todo el modelo. */
export type DateKey = string

export function localDateKey(ts: number | Date): DateKey {
  return format(ts, 'yyyy-MM-dd')
}

export const todayKey = (): DateKey => localDateKey(Date.now())

/** Convierte una clave a Date local (medianoche). */
export function parseKey(key: DateKey): Date {
  return parse(key, 'yyyy-MM-dd', new Date())
}

export function addDaysKey(key: DateKey, delta: number): DateKey {
  const d = parseKey(key)
  d.setDate(d.getDate() + delta)
  return format(d, 'yyyy-MM-dd')
}

/** Día de la semana con lunes = 0 … domingo = 6. */
export function dowMon0(key: DateKey): number {
  return (parseKey(key).getDay() + 6) % 7
}

export function isWeekend(key: DateKey): boolean {
  const d = parseKey(key).getDay()
  return d === 0 || d === 6
}

export function isSaturday(key: DateKey): boolean {
  return parseKey(key).getDay() === 6
}

export function isSunday(key: DateKey): boolean {
  return parseKey(key).getDay() === 0
}

/**
 * Lunes de la "semana laboral" de referencia para un día.
 * Si el día es domingo se toma el lunes SIGUIENTE (el domingo cierra la semana
 * anterior; para mañana/tarde no cuenta como día laborable).
 */
export function mondayOfWorkWeek(key: DateKey): DateKey {
  const dow = dowMon0(key) // lunes=0 … domingo=6
  if (dow === 6) return addDaysKey(key, 1) // domingo -> lunes siguiente
  return addDaysKey(key, -dow)
}

/** Lista inclusiva de claves entre dos fechas (orden ascendente). */
export function keysBetween(fromKey: DateKey, toKey: DateKey): DateKey[] {
  const a = fromKey <= toKey ? fromKey : toKey
  const b = fromKey <= toKey ? toKey : fromKey
  const out: DateKey[] = []
  let cur = a
  // límite de seguridad: 2 años
  for (let i = 0; i < 800 && cur <= b; i++) {
    out.push(cur)
    cur = addDaysKey(cur, 1)
  }
  return out
}

/** "Miércoles, 2 de septiembre de 2026" (inicial en mayúscula). */
export function longDate(key: DateKey | number): string {
  const d = typeof key === 'number' ? new Date(key) : parseKey(key)
  const s = format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "mié 2 sep" */
export function shortDate(key: DateKey | number): string {
  const d = typeof key === 'number' ? new Date(key) : parseKey(key)
  return format(d, 'EEE d MMM', { locale: es })
}

export function monthTitle(year: number, month0: number): string {
  const s = format(new Date(year, month0, 1), 'LLLL yyyy', { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function monthKeyRange(year: number, month0: number): { fromKey: DateKey; toKey: DateKey } {
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  return { fromKey: localDateKey(first), toKey: localDateKey(last) }
}

export function ymOfKey(key: DateKey): { year: number; month0: number } {
  const d = parseKey(key)
  return { year: d.getFullYear(), month0: d.getMonth() }
}

/** Número de semana ISO 8601 (semana que empieza en lunes, la 1.ª es la que tiene el primer jueves del año). */
export function isoWeek(key: DateKey): number {
  return getISOWeek(parseKey(key))
}

/** Días de diferencia entre dos claves (a − b). Positivo si `a` es posterior. */
export function diffDiasKeys(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(parseKey(a), parseKey(b))
}
