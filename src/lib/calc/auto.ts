import type {
  AjusteBolsaEntry,
  AutoCategoria,
  ComplementoEntry,
  Day,
  DisponibilidadEntry,
  Entry,
  LibranzaCompEntry,
} from '../../db/types'
import { dowMon0, type DateKey } from '../datetime'
import { bolsaCtx, turnoBolsa, type BolsaCtx } from './bolsa'
import { complementosDia } from './complementos'
import { libranzaCompDia } from './libranzas'
import { dispoDeFinde, sabadoDeFinde, type DispoAncla } from './disponibilidad'

/**
 * Entradas que la app genera y mantiene sola al rellenar turnos/festivos.
 * Todas llevan `auto: true` y un `id` estable (`auto-…-fecha`) para poder
 * regenerarlas sin duplicar. El usuario puede editarlas (pone `override`) o
 * quitarlas (añade la categoría a `day.autoOff`).
 */

export function esEntradaAuto(e: Entry): boolean {
  return e.auto === true
}

export function categoriaDe(e: Entry): AutoCategoria | null {
  if (e.type === 'ajusteBolsa') return 'bolsa'
  if (e.type === 'complemento') return 'complemento'
  if (e.type === 'libranzaComp') return 'libranza'
  if (e.type === 'disponibilidad') return 'disponibilidad'
  return null
}

function motivoBolsa(date: DateKey, periodo: 'manana' | 'tarde' | 'noche'): string {
  if (periodo === 'noche') return 'Noche extra (fuera del bloque de 5)'
  return dowMon0(date) === 5
    ? 'Sábado trabajado (fuera de jornada)'
    : 'Domingo trabajado (fuera de jornada)'
}

/**
 * Ajuste de bolsa automático de un día (por trabajar sábado/domingo o noche
 * extra). `ctx` se puede precalcular una vez para varias llamadas (p.ej. al
 * recalcular todo el historial); si no se pasa, se calcula a partir de `dias`.
 */
export function autoBolsaDia(date: DateKey, dias: Map<DateKey, Day>, ctx?: BolsaCtx): AjusteBolsaEntry[] {
  const turno = dias.get(date)?.entries.find((e) => e.type === 'turno')
  if (!turno || turno.type !== 'turno') return []
  const horas = turnoBolsa(date, turno.periodo, ctx ?? bolsaCtx([...dias.values()]))
  if (horas === 0) return []
  return [
    {
      id: `auto-bolsa-${date}`,
      type: 'ajusteBolsa',
      horas,
      auto: true,
      motivo: motivoBolsa(date, turno.periodo),
    },
  ]
}

/** Complementos automáticos de un día (sábado / festivo, enteros o medios). */
export function autoComplementoDia(date: DateKey, dias: Map<DateKey, Day>): ComplementoEntry[] {
  return complementosDia(date, dias).map((c) => ({
    id: `auto-comp-${date}-${c.tipo}`,
    type: 'complemento' as const,
    tipo: c.tipo,
    valor: c.valor,
    auto: true,
    motivo: 'Calculado por los turnos del cuadrante',
  }))
}

/** Libranza compensatoria automática por trabajar el finde anterior. */
export function autoLibranzaCompDia(date: DateKey, dias: Map<DateKey, Day>): LibranzaCompEntry[] {
  const c = libranzaCompDia(date, dias)
  if (!c) return []
  return [{ id: `auto-libra-${date}`, type: 'libranzaComp', dia: c.dia, auto: true }]
}

/** Disponibilidad T/D automática de un sábado/domingo, según el ancla activa. */
export function autoDisponibilidadDia(
  date: DateKey,
  ancla: DispoAncla | null | undefined,
): DisponibilidadEntry[] {
  const sabado = sabadoDeFinde(date)
  if (!sabado) return []
  const valor = dispoDeFinde(sabado, ancla ?? null)
  if (!valor) return []
  return [{ id: `auto-dispo-${date}`, type: 'disponibilidad', valor, auto: true }]
}

/** Todas las entradas auto de un día, respetando las categorías descartadas. */
export function entradasAutoDia(
  date: DateKey,
  dias: Map<DateKey, Day>,
  autoOff: AutoCategoria[] = [],
  ctx?: BolsaCtx,
  ancla?: DispoAncla | null,
): Entry[] {
  const off = new Set(autoOff)
  const out: Entry[] = []
  if (!off.has('bolsa')) out.push(...autoBolsaDia(date, dias, ctx))
  if (!off.has('complemento')) out.push(...autoComplementoDia(date, dias))
  if (!off.has('libranza')) out.push(...autoLibranzaCompDia(date, dias))
  if (!off.has('disponibilidad')) out.push(...autoDisponibilidadDia(date, ancla))
  return out
}

/**
 * Recalcula las entradas auto de una lista de días (útil para tests y para la
 * migración en memoria). No toca la base de datos. Los días sin fila propia
 * (p. ej. un finde sin turno) no se generan aquí — para eso hace falta iterar
 * el rango de fechas, ver `regenerarRangoVisible` en `db/days.ts`.
 */
export function regenerarEnMemoria(days: Day[], ancla: DispoAncla | null = null): Day[] {
  const mapa = new Map(days.map((d) => [d.date, d]))
  const ctx = bolsaCtx(days)
  return days
    .map((d) => {
      const autos = entradasAutoDia(d.date, mapa, d.autoOff, ctx, ancla)
      const entries = fusionarEntradas(d.entries, autos)
      return { ...d, entries }
    })
    .filter((d) => d.entries.length > 0)
}

/**
 * Fusiona las entradas manuales de un día con las auto recién calculadas,
 * conservando los `override` que el usuario hubiera puesto.
 */
export function fusionarEntradas(previas: Entry[], autoNuevas: Entry[]): Entry[] {
  const manuales = previas.filter((e) => !esEntradaAuto(e))
  const overridePrevio = new Map<string, number | undefined>()
  const notasPrevias = new Map<string, string | undefined>()
  for (const e of previas) {
    if (!esEntradaAuto(e)) continue
    if (e.type === 'ajusteBolsa' || e.type === 'complemento') overridePrevio.set(e.id, e.override)
    notasPrevias.set(e.id, e.notes)
  }
  const autos = autoNuevas.map((e) => {
    const next = { ...e } as Entry
    if ((next.type === 'ajusteBolsa' || next.type === 'complemento') && overridePrevio.has(next.id)) {
      const ov = overridePrevio.get(next.id)
      if (ov !== undefined) next.override = ov
    }
    const notas = notasPrevias.get(next.id)
    if (notas) next.notes = notas
    return next
  })
  return [...manuales, ...autos]
}
