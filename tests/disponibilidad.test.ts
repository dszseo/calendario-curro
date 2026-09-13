import { describe, expect, it } from 'vitest'
import {
  conAncla,
  dispoDeFinde,
  opuesto,
  sabadoDeFinde,
  type DispoAncla,
} from '../src/lib/calc/disponibilidad'
import { autoDisponibilidadDia } from '../src/lib/calc/auto'

// 2026-09: 05 sáb · 06 dom · 12 sáb · 13 dom · 19 sáb · 20 dom · 26 sáb · 27 dom
// 2026-10: 10 sáb · 11 dom · 17 sáb · 18 dom

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

describe('dispoDeFinde — una sola ancla (alterna en las dos direcciones)', () => {
  const anclas: DispoAncla[] = [{ sabado: '2026-09-05', valor: 'T' }]

  it('sin anclas, no hay disponibilidad', () => {
    expect(dispoDeFinde('2026-09-05', [])).toBeNull()
    expect(dispoDeFinde('2026-09-05', null)).toBeNull()
  })
  it('el finde ancla vale lo fijado', () => {
    expect(dispoDeFinde('2026-09-05', anclas)).toBe('T')
  })
  it('alterna cada semana hacia delante', () => {
    expect(dispoDeFinde('2026-09-12', anclas)).toBe('D')
    expect(dispoDeFinde('2026-09-19', anclas)).toBe('T')
    expect(dispoDeFinde('2026-09-26', anclas)).toBe('D')
  })
  it('con una sola ancla, también alterna hacia atrás (no hay historia que proteger)', () => {
    expect(dispoDeFinde('2026-08-29', anclas)).toBe('D')
    expect(dispoDeFinde('2026-08-22', anclas)).toBe('T')
  })
})

describe('dispoDeFinde — varias anclas: lo pasado NO cambia al reanclar', () => {
  // Ancla original: 5-sep = T (alterna: 12=D, 19=T, 26=D, 3-oct=T, 10-oct=D…)
  // Se reancla el 10-oct a T (en vez del D que tocaría) -> desde ahí alterna
  // sola con el nuevo valor, y lo anterior al 10-oct queda exactamente igual.
  const anclas: DispoAncla[] = conAncla(
    [{ sabado: '2026-09-05', valor: 'T' }],
    { sabado: '2026-10-10', valor: 'T' },
  )

  it('lo anterior a la nueva ancla no cambia', () => {
    expect(dispoDeFinde('2026-09-05', anclas)).toBe('T')
    expect(dispoDeFinde('2026-09-12', anclas)).toBe('D')
    expect(dispoDeFinde('2026-09-19', anclas)).toBe('T')
    expect(dispoDeFinde('2026-09-26', anclas)).toBe('D')
    expect(dispoDeFinde('2026-10-03', anclas)).toBe('T') // seguía la vieja ancla
  })
  it('puede quedar una secuencia de dos T seguidas justo en el cambio', () => {
    // 3-oct = T (ancla vieja) y 10-oct = T (nueva ancla): dos T seguidas, ok.
    expect(dispoDeFinde('2026-10-03', anclas)).toBe('T')
    expect(dispoDeFinde('2026-10-10', anclas)).toBe('T')
  })
  it('a partir de la nueva ancla, alterna con el nuevo valor', () => {
    expect(dispoDeFinde('2026-10-17', anclas)).toBe('D')
    expect(dispoDeFinde('2026-10-24', anclas)).toBe('T')
  })
})

describe('conAncla', () => {
  it('añade y ordena por fecha', () => {
    const r = conAncla([{ sabado: '2026-10-10', valor: 'T' }], { sabado: '2026-09-05', valor: 'D' })
    expect(r.map((a) => a.sabado)).toEqual(['2026-09-05', '2026-10-10'])
  })
  it('si ya existe una ancla en esa fecha, la sustituye (no duplica)', () => {
    const r = conAncla([{ sabado: '2026-09-05', valor: 'T' }], { sabado: '2026-09-05', valor: 'D' })
    expect(r).toEqual([{ sabado: '2026-09-05', valor: 'D' }])
  })
})

describe('autoDisponibilidadDia', () => {
  const anclas: DispoAncla[] = [{ sabado: '2026-09-05', valor: 'T' }]

  it('genera la misma entrada para sábado y domingo del finde', () => {
    const sab = autoDisponibilidadDia('2026-09-12', anclas)
    const dom = autoDisponibilidadDia('2026-09-13', anclas)
    expect(sab).toEqual([{ id: 'auto-dispo-2026-09-12', type: 'disponibilidad', valor: 'D', auto: true }])
    expect(dom).toEqual([{ id: 'auto-dispo-2026-09-13', type: 'disponibilidad', valor: 'D', auto: true }])
  })
  it('entre semana no genera nada', () => {
    expect(autoDisponibilidadDia('2026-09-09', anclas)).toEqual([])
  })
  it('sin anclas no genera nada', () => {
    expect(autoDisponibilidadDia('2026-09-12', null)).toEqual([])
  })
})
