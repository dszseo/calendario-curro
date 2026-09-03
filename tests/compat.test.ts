import { describe, expect, it } from 'vitest'
import { canAddEntry, validateDay } from '../src/lib/compat'
import type { Entry } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: Math.random().toString(), ...x } as Entry)

describe('compat', () => {
  it('no se puede estar de mañana y de noche el mismo día', () => {
    const existing = [e({ type: 'turno', periodo: 'manana', horas: 8 })]
    expect(canAddEntry(existing, 'turno').ok).toBe(false)
  })

  it('baja excluye turno y vacaciones', () => {
    const baja = [e({ type: 'baja' })]
    expect(canAddEntry(baja, 'turno').ok).toBe(false)
    expect(canAddEntry(baja, 'vacaciones').ok).toBe(false)
    expect(canAddEntry(baja, 'nota').ok).toBe(true)
  })

  it('un sábado se puede trabajar y apuntar horas extra + ajuste', () => {
    const existing: Entry[] = [e({ type: 'turno', periodo: 'manana', horas: 8 })]
    expect(canAddEntry(existing, 'horaExtra').ok).toBe(true)
    existing.push(e({ type: 'horaExtra', horas: 8, destino: 'bolsa' }))
    expect(canAddEntry(existing, 'horaExtra').ok).toBe(true) // varias permitidas
    expect(canAddEntry(existing, 'ajusteBolsa').ok).toBe(true)
  })

  it('festivo es compatible con turno y con vacaciones', () => {
    expect(canAddEntry([e({ type: 'turno', periodo: 'noche', horas: 8 })], 'festivo').ok).toBe(true)
    expect(canAddEntry([e({ type: 'vacaciones' })], 'festivo').ok).toBe(true)
  })

  it('validateDay detecta dos ausencias completas', () => {
    expect(validateDay([e({ type: 'vacaciones' }), e({ type: 'asuntoPropio' })]).ok).toBe(false)
  })
})
