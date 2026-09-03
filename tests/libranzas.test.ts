import { describe, expect, it } from 'vitest'
import { compOffsets, compSemana, ROTACION } from '../src/lib/calc/libranzas'
import { regenerarEnMemoria } from '../src/lib/calc/auto'
import type { Day, Entry, Periodo } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: Math.random().toString(), ...x } as Entry)
const day = (date: string, entries: Entry[]): Day => ({ date, entries, updatedAt: 0 })
const turno = (date: string, periodo: Periodo) => day(date, [e({ type: 'turno', periodo, horas: 8 })])
const semana = (monday: string, periodo: Periodo) => {
  const base = new Date(monday)
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    return turno(d.toISOString().slice(0, 10), periodo)
  })
}
const mapa = (days: Day[]) => new Map(days.map((d) => [d.date, d]))

// 2026-09: 07 lun · 12 sáb · 13 dom · 14 lun (semana siguiente)

describe('compOffsets', () => {
  it('tarde: sábado→viernes, domingo→lunes', () => {
    expect(compOffsets('tarde', true, true)).toEqual([
      { dia: 'sabado', off: 4 },
      { dia: 'domingo', off: 0 },
    ])
    expect(compOffsets('tarde', false, true)).toEqual([{ dia: 'domingo', off: 0 }])
  })
  it('mañana: dos días→jueves+viernes; uno solo→viernes', () => {
    expect(compOffsets('manana', true, true)).toEqual([
      { dia: 'sabado', off: 3 },
      { dia: 'domingo', off: 4 },
    ])
    expect(compOffsets('manana', true, false)).toEqual([{ dia: 'sabado', off: 4 }])
  })
})

describe('ROTACION', () => {
  it('tarde → mañana → noche → tarde', () => {
    expect(ROTACION.tarde).toBe('manana')
    expect(ROTACION.manana).toBe('noche')
    expect(ROTACION.noche).toBe('tarde')
  })
})

describe('compSemana', () => {
  it('finde de tarde + semana de mañana → libra lunes y viernes', () => {
    const days = [
      ...semana('2026-09-07', 'tarde'),
      turno('2026-09-12', 'tarde'), // sábado
      turno('2026-09-13', 'tarde'), // domingo
      ...semana('2026-09-14', 'manana'),
    ]
    const c = compSemana('2026-09-14', mapa(days))
    expect(c.cambioDeTurno).toBe(false)
    expect(c.dias.map((d) => d.date).sort()).toEqual(['2026-09-14', '2026-09-18'])
  })

  it('finde de tarde + semana de NOCHE → cambio de turno, sin libranzas', () => {
    const days = [
      turno('2026-09-12', 'tarde'),
      turno('2026-09-13', 'tarde'),
      ...semana('2026-09-14', 'noche'),
    ]
    const c = compSemana('2026-09-14', mapa(days))
    expect(c.cambioDeTurno).toBe(true)
    expect(c.dias).toEqual([])
  })

  it('sin finde trabajado → nada', () => {
    const c = compSemana('2026-09-14', mapa(semana('2026-09-14', 'manana')))
    expect(c).toEqual({ dias: [], cambioDeTurno: false })
  })
})

describe('regeneración: la libranza aparece sola y resta 8 h de la bolsa', () => {
  it('finde de tarde trabajado + semana de mañana', () => {
    const base = [
      turno('2026-09-12', 'tarde'),
      turno('2026-09-13', 'tarde'),
      ...semana('2026-09-14', 'manana'),
    ]
    const dias = regenerarEnMemoria(base)
    const lunes = dias.find((d) => d.date === '2026-09-14')!
    const viernes = dias.find((d) => d.date === '2026-09-18')!
    expect(lunes.entries.some((x) => x.type === 'libranzaComp' && x.auto)).toBe(true)
    expect(viernes.entries.some((x) => x.type === 'libranzaComp' && x.auto)).toBe(true)
  })
})
