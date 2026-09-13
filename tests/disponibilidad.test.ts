import { describe, expect, it } from 'vitest'
import { dispoDeFinde, opuesto, sabadoDeFinde, type DispoAncla } from '../src/lib/calc/disponibilidad'
import { autoDisponibilidadDia } from '../src/lib/calc/auto'

// 2026-09: 05 sáb · 06 dom · 12 sáb · 13 dom · 19 sáb · 20 dom · 26 sáb · 27 dom

describe('sabadoDeFinde', () => {
  it('sábado y domingo apuntan al mismo sábado del finde', () => {
    expect(sabadoDeFinde('2026-09-05')).toBe('2026-09-05')
    expect(sabadoDeFinde('2026-09-06')).toBe('2026-09-05')
  })
  it('entre semana no es finde', () => {
    expect(sabadoDeFinde('2026-09-09')).toBeNull()
  })
})

describe('opuesto', () => {
  it('T <-> D', () => {
    expect(opuesto('T')).toBe('D')
    expect(opuesto('D')).toBe('T')
  })
})

describe('dispoDeFinde — alternancia', () => {
  const ancla: DispoAncla = { sabado: '2026-09-05', valor: 'T' }

  it('sin ancla, no hay disponibilidad', () => {
    expect(dispoDeFinde('2026-09-05', null)).toBeNull()
  })
  it('el finde ancla vale lo fijado', () => {
    expect(dispoDeFinde('2026-09-05', ancla)).toBe('T')
  })
  it('alterna cada semana hacia delante', () => {
    expect(dispoDeFinde('2026-09-12', ancla)).toBe('D')
    expect(dispoDeFinde('2026-09-19', ancla)).toBe('T')
    expect(dispoDeFinde('2026-09-26', ancla)).toBe('D')
  })
  it('alterna también hacia atrás', () => {
    expect(dispoDeFinde('2026-08-29', ancla)).toBe('D')
    expect(dispoDeFinde('2026-08-22', ancla)).toBe('T')
  })
})

describe('autoDisponibilidadDia', () => {
  const ancla: DispoAncla = { sabado: '2026-09-05', valor: 'T' }

  it('genera la misma entrada para sábado y domingo del finde', () => {
    const sab = autoDisponibilidadDia('2026-09-12', ancla)
    const dom = autoDisponibilidadDia('2026-09-13', ancla)
    expect(sab).toEqual([{ id: 'auto-dispo-2026-09-12', type: 'disponibilidad', valor: 'D', auto: true }])
    expect(dom).toEqual([{ id: 'auto-dispo-2026-09-13', type: 'disponibilidad', valor: 'D', auto: true }])
  })
  it('entre semana no genera nada', () => {
    expect(autoDisponibilidadDia('2026-09-09', ancla)).toEqual([])
  })
  it('sin ancla no genera nada', () => {
    expect(autoDisponibilidadDia('2026-09-12', null)).toEqual([])
  })
})
