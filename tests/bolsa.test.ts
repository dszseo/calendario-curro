import { describe, expect, it } from 'vitest'
import { bolsaDeltaEntry, bolsaTotal, turnoBolsa, bolsaCtx } from '../src/lib/calc/bolsa'
import { regenerarEnMemoria } from '../src/lib/calc/auto'
import type { Day, Entry } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: 'x', ...x } as Entry)
const day = (date: string, entries: Entry[]): Day => ({ date, entries, updatedAt: 0 })
const noche = (date: string) => day(date, [e({ type: 'turno', periodo: 'noche', horas: 8 })])

// Referencias 2026-09: 07 lun · 11 vie · 12 sáb · 13 dom · 14 lun · 18 vie · 19 sáb

describe('bolsaDeltaEntry', () => {
  it('horas extra a bolsa / a cobrar', () => {
    expect(bolsaDeltaEntry(e({ type: 'horaExtra', horas: 2, destino: 'bolsa' }))).toBe(2)
    expect(bolsaDeltaEntry(e({ type: 'horaExtra', horas: 8, destino: 'cobrar' }))).toBe(0)
  })
  it('libranza a cuenta de horas: −8', () => {
    expect(bolsaDeltaEntry(e({ type: 'libranza', motivo: 'horas' }))).toBe(-8)
  })
  it('ajuste con override manda sobre el valor calculado', () => {
    expect(bolsaDeltaEntry(e({ type: 'ajusteBolsa', horas: 8, override: 6 }))).toBe(6)
  })
})

describe('turnoBolsa — regla', () => {
  it('mañana/tarde: sábado y domingo +8, resto 0', () => {
    expect(turnoBolsa('2026-09-09', 'manana')).toBe(0)
    expect(turnoBolsa('2026-09-12', 'tarde')).toBe(8)
    expect(turnoBolsa('2026-09-13', 'manana')).toBe(8)
  })
  it('noche: domingo 0 siempre; lun-jue 0; sábado +8 siempre', () => {
    expect(turnoBolsa('2026-09-13', 'noche')).toBe(0)
    expect(turnoBolsa('2026-09-17', 'noche')).toBe(0)
    expect(turnoBolsa('2026-09-19', 'noche')).toBe(8)
  })
  it('noche viernes: +8 solo si la semana arrancó el domingo', () => {
    expect(turnoBolsa('2026-09-18', 'noche')).toBe(0)
    expect(turnoBolsa('2026-09-18', 'noche', bolsaCtx([noche('2026-09-13')]))).toBe(8)
  })
})

describe('bolsaTotal con entradas auto (regeneradas)', () => {
  it('semana de noche arrancada el domingo + trabajar el finde: +16', () => {
    const dias = regenerarEnMemoria([
      noche('2026-09-13'),
      noche('2026-09-14'),
      noche('2026-09-15'),
      noche('2026-09-16'),
      noche('2026-09-17'),
      noche('2026-09-18'), // viernes → +8
      noche('2026-09-19'), // sábado → +8
    ])
    expect(bolsaTotal(dias)).toBe(16)
  })

  it('semana de noche arrancada el lunes + sábado: solo +8', () => {
    const dias = regenerarEnMemoria([
      noche('2026-09-14'),
      noche('2026-09-15'),
      noche('2026-09-16'),
      noche('2026-09-17'),
      noche('2026-09-18'), // viernes → 0 (arrancó el lunes)
      noche('2026-09-19'), // sábado → +8
    ])
    expect(bolsaTotal(dias)).toBe(8)
  })

  it('sábado de mañana + salir 2 h antes: +8 −2 = +6', () => {
    const dias = regenerarEnMemoria([
      day('2026-09-12', [
        e({ type: 'turno', periodo: 'manana', horas: 8 }),
        e({ type: 'ajusteBolsa', horas: -2 }),
      ]),
    ])
    expect(bolsaTotal(dias)).toBe(6)
  })

  it('override del ajuste auto: +8 pasa a +6', () => {
    const dias = regenerarEnMemoria([
      day('2026-09-12', [e({ type: 'turno', periodo: 'manana', horas: 8 })]),
    ])
    const auto = dias[0].entries.find((x) => x.type === 'ajusteBolsa')!
    if (auto.type === 'ajusteBolsa') auto.override = 6
    expect(bolsaTotal(dias)).toBe(6)
  })
})
