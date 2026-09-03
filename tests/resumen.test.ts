import { describe, expect, it } from 'vitest'
import { resumenMes } from '../src/lib/calc/resumen'
import { regenerarEnMemoria } from '../src/lib/calc/auto'
import type { Day, Entry } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: Math.random().toString(), ...x } as Entry)
const day = (date: string, entries: Entry[]): Day => ({ date, entries, updatedAt: 0 })

describe('resumenMes', () => {
  it('cuenta turnos, horas, complementos y variación de bolsa (con entradas auto)', () => {
    const base: Day[] = [
      day('2026-09-07', [e({ type: 'turno', periodo: 'tarde', horas: 8 })]), // lunes
      day('2026-09-08', [e({ type: 'turno', periodo: 'tarde', horas: 8 })]),
      day('2026-09-09', [
        e({ type: 'turno', periodo: 'tarde', horas: 8 }),
        e({ type: 'ajusteBolsa', horas: -2 }), // salgo 2 h antes
      ]),
      day('2026-09-12', [
        e({ type: 'turno', periodo: 'manana', horas: 8 }), // sábado
        e({ type: 'horaExtra', horas: 8, destino: 'bolsa' }),
      ]),
      day('2026-09-14', [e({ type: 'libranza', motivo: 'horas' })]), // -8
    ]
    const r = resumenMes(regenerarEnMemoria(base))
    expect(r.diasConTurno).toBe(4)
    expect(r.horasTurno).toBe(32)
    expect(r.porPeriodo.tarde).toBe(3)
    expect(r.porPeriodo.manana).toBe(1)
    expect(r.horasExtraBolsa).toBe(8)
    expect(r.libranzas.horas).toBe(1)
    expect(r.complementoSabado).toBe(1) // sábado de mañana trabajado ≥ 4 h
    // −2 (ajuste) + 8 (sábado auto) + 8 (extra) − 8 (libranza horas) = +6
    expect(r.variacionBolsa).toBe(6)
  })
})
