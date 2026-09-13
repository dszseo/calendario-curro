import { describe, expect, it } from 'vitest'
import { complementosDia } from '../src/lib/calc/complementos'
import { regenerarEnMemoria } from '../src/lib/calc/auto'
import type { Day, Entry } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: Math.random().toString(), ...x } as Entry)
const day = (date: string, entries: Entry[]): Day => ({ date, entries, updatedAt: 0 })
const noche = (date: string) => day(date, [e({ type: 'turno', periodo: 'noche', horas: 8 })])
const manana = (date: string) => day(date, [e({ type: 'turno', periodo: 'manana', horas: 8 })])

const comp = (date: string, dias: Day[]) =>
  complementosDia(date, new Map(dias.map((d) => [d.date, d])))

// 2026-09: 12 sáb · 13 dom · 17 jue · 18 vie · 19 sáb · 20 dom

describe('complementos — mañana / tarde', () => {
  it('sábado trabajado = 1 sábado; domingo = 1 festivo', () => {
    expect(comp('2026-09-12', [manana('2026-09-12')])).toEqual([{ tipo: 'sabado', valor: 1 }])
    expect(comp('2026-09-13', [manana('2026-09-13')])).toEqual([{ tipo: 'festivo', valor: 1 }])
  })
  it('entre semana no genera complemento', () => {
    expect(comp('2026-09-16', [manana('2026-09-16')])).toEqual([])
  })
})

describe('complementos — noche', () => {
  it('domingo noche = ½ festivo (siempre inicio de semana)', () => {
    const dias = [noche('2026-09-13')]
    expect(comp('2026-09-13', dias)).toEqual([{ tipo: 'festivo', valor: 0.5 }])
  })
  it('viernes noche = 1 sábado (cae entero en la fila del sábado)', () => {
    const dias = [noche('2026-09-18')]
    expect(comp('2026-09-18', dias)).toEqual([]) // el viernes en sí no tiene tipo
    expect(comp('2026-09-19', dias)).toEqual([{ tipo: 'sabado', valor: 1 }])
  })
  it('viernes + sábado noche → sábado = 1,5 (½ propio + 1 del viernes), domingo = 1 festivo (del sábado)', () => {
    const dias = [noche('2026-09-18'), noche('2026-09-19')]
    expect(comp('2026-09-19', dias)).toEqual([{ tipo: 'sabado', valor: 1.5 }])
    expect(comp('2026-09-20', dias)).toEqual([{ tipo: 'festivo', valor: 1 }])
  })
  it('festivo el jueves: miércoles noche + jueves noche = 1,5 festivos (fila del jueves)', () => {
    const dias = [
      noche('2026-09-16'), // miércoles
      day('2026-09-17', [e({ type: 'turno', periodo: 'noche', horas: 8 }), e({ type: 'festivo', ambito: 'local' })]),
    ]
    expect(comp('2026-09-17', dias)).toEqual([{ tipo: 'festivo', valor: 1.5 }])
  })
  it('salir 2 h antes (efectivas 6 ≥ 4) sigue contando; 3 h no', () => {
    const ok = [day('2026-09-18', [e({ type: 'turno', periodo: 'noche', horas: 8 }), e({ type: 'ajusteBolsa', horas: -2 })])]
    expect(comp('2026-09-19', ok)).toEqual([{ tipo: 'sabado', valor: 1 }])
    const no = [day('2026-09-18', [e({ type: 'turno', periodo: 'noche', horas: 8 }), e({ type: 'ajusteBolsa', horas: -5 })])]
    expect(comp('2026-09-19', no)).toEqual([])
  })

  it('semana de noche completa (arranque lunes, hasta sábado): viernes=1 sábado, sábado=½ sábado', () => {
    // 2026-09-14 lunes … 2026-09-19 sábado (6 noches, arranque lunes)
    const dias = ['14', '15', '16', '17', '18', '19'].map((d) => noche(`2026-09-${d}`))
    expect(comp('2026-09-19', dias)).toEqual([{ tipo: 'sabado', valor: 1.5 }]) // 1 (viernes) + ½ (propio)
    expect(comp('2026-09-20', dias)).toEqual([{ tipo: 'festivo', valor: 1 }]) // del sábado
  })
})

describe('festivo que cae en sábado', () => {
  it('sábado de mañana con festivo marcado → 1 festivo (no sábado)', () => {
    const dias = [day('2026-09-19', [e({ type: 'turno', periodo: 'manana', horas: 8 }), e({ type: 'festivo', ambito: 'local' })])]
    expect(comp('2026-09-19', dias)).toEqual([{ tipo: 'festivo', valor: 1 }])
  })
})

describe('regeneración: las entradas complemento aparecen solas', () => {
  it('un domingo de tarde genera su entrada complemento auto', () => {
    const dias = regenerarEnMemoria([day('2026-09-13', [e({ type: 'turno', periodo: 'tarde', horas: 8 })])])
    const c = dias[0].entries.find((x) => x.type === 'complemento')
    expect(c && c.type === 'complemento' && c.tipo).toBe('festivo')
    expect(c && c.type === 'complemento' && c.valor).toBe(1)
    expect(c?.auto).toBe(true)
  })
})
