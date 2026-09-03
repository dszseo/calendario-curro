import { describe, expect, it } from 'vitest'
import { autofillTurno, esInicioDeBloque } from '../src/lib/calc/turnos'

// 2026-09-07 lunes · 2026-09-11 viernes · 2026-09-13 domingo

describe('esInicioDeBloque', () => {
  it('mañana/tarde: solo el lunes rellena la semana', () => {
    expect(esInicioDeBloque('2026-09-07', 'tarde')).toBe(true)
    expect(esInicioDeBloque('2026-09-11', 'tarde')).toBe(false) // viernes -> solo ese día
    expect(esInicioDeBloque('2026-09-13', 'manana')).toBe(false) // domingo
  })

  it('noche: rellena si es domingo o lunes', () => {
    expect(esInicioDeBloque('2026-09-13', 'noche')).toBe(true) // domingo
    expect(esInicioDeBloque('2026-09-07', 'noche')).toBe(true) // lunes
    expect(esInicioDeBloque('2026-09-09', 'noche')).toBe(false) // miércoles
  })
})

describe('autofillTurno', () => {
  it('tarde desde el lunes: lunes a viernes', () => {
    const block = autofillTurno('2026-09-07', 'tarde', 8)
    expect(block.map((b) => b.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ])
  })

  it('noche desde el domingo: domingo a jueves', () => {
    const block = autofillTurno('2026-09-13', 'noche', 8)
    expect(block.map((b) => b.date)).toEqual([
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ])
  })

  it('noche desde el lunes: lunes a viernes', () => {
    const block = autofillTurno('2026-09-07', 'noche', 8)
    expect(block[0].date).toBe('2026-09-07')
    expect(block[4].date).toBe('2026-09-11')
  })
})
