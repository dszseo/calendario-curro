import { describe, expect, it } from 'vitest'
import { usoDiasAnio } from '../src/lib/calc/diasAnio'
import type { Day, Entry } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: Math.random().toString(), ...x } as Entry)
const day = (date: string, entries: Entry[]): Day => ({ date, entries, updatedAt: 0 })

describe('usoDiasAnio', () => {
  it('cuenta la entrada dedicada y la libranza de 1 día como lo mismo', () => {
    const uso = usoDiasAnio([
      day('2026-01-05', [e({ type: 'vacaciones' })]),
      day('2026-01-06', [e({ type: 'libranza', motivo: 'vacaciones' })]),
      day('2026-02-01', [e({ type: 'asuntoPropio' })]),
      day('2026-03-01', [e({ type: 'regulacion' })]),
      day('2026-03-02', [e({ type: 'libranza', motivo: 'regulacion' })]),
    ])
    expect(uso.vacaciones).toEqual(['2026-01-05', '2026-01-06'])
    expect(uso.asuntosPropios).toEqual(['2026-02-01'])
    expect(uso.regulacion).toEqual(['2026-03-01', '2026-03-02'])
  })

  it('otras libranzas (horas, permiso, especial) no cuentan aquí', () => {
    const uso = usoDiasAnio([
      day('2026-01-05', [e({ type: 'libranza', motivo: 'horas' })]),
      day('2026-01-06', [e({ type: 'libranza', motivo: 'permiso' })]),
      day('2026-01-07', [e({ type: 'permiso', tipo: 'otro' })]),
    ])
    expect(uso.vacaciones).toEqual([])
    expect(uso.asuntosPropios).toEqual([])
    expect(uso.regulacion).toEqual([])
  })

  it('sin días, todo vacío', () => {
    expect(usoDiasAnio([])).toEqual({ vacaciones: [], asuntosPropios: [], regulacion: [] })
  })
})
