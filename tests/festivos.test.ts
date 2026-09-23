import { describe, expect, it } from 'vitest'
import { festivoAutoDia } from '../src/lib/calc/festivos'
import { regenerarEnMemoria } from '../src/lib/calc/auto'
import type { Day, Entry } from '../src/db/types'

const e = (x: Partial<Entry> & { type: Entry['type'] }): Entry => ({ id: Math.random().toString(), ...x } as Entry)
const day = (date: string, entries: Entry[]): Day => ({ date, entries, updatedAt: 0 })

describe('festivoAutoDia', () => {
  it('festivos nacionales de fecha fija', () => {
    expect(festivoAutoDia('2026-01-01', null)).toEqual({ nombre: 'Año Nuevo', ambito: 'nacional' })
    expect(festivoAutoDia('2026-12-25', null)).toEqual({ nombre: 'Natividad del Señor', ambito: 'nacional' })
  })

  it('Viernes Santo es móvil (Pascua − 2 días), correcto para varios años', () => {
    expect(festivoAutoDia('2026-04-03', null)?.nombre).toBe('Viernes Santo') // Pascua 2026 = 5 abril
    expect(festivoAutoDia('2025-04-18', null)?.nombre).toBe('Viernes Santo') // Pascua 2025 = 20 abril
    expect(festivoAutoDia('2027-03-26', null)?.nombre).toBe('Viernes Santo') // Pascua 2027 = 28 marzo
  })

  it('un martes cualquiera sin festivo → null', () => {
    expect(festivoAutoDia('2026-09-15', null)).toBeNull()
  })

  it('autonómico de Castilla-La Mancha solo si se pasa esa comunidad', () => {
    expect(festivoAutoDia('2026-05-31', 'CLM')).toEqual({ nombre: 'Día de Castilla-La Mancha', ambito: 'autonomico' })
    expect(festivoAutoDia('2026-05-31', null)).toBeNull()
    expect(festivoAutoDia('2026-05-31', 'MAD')).toBeNull()
  })
})

describe('festivo automático + complemento en la misma pasada', () => {
  it('festivo nacional que cae en sábado: turno de mañana da complemento de festivo (1), no de sábado', () => {
    // 2026-01-01 es jueves, así que probamos con un sábado real que sea festivo
    // nacional: 2027-05-01 (Fiesta del Trabajo) es sábado.
    const dias = regenerarEnMemoria([day('2027-05-01', [e({ type: 'turno', periodo: 'manana', horas: 8 })])], null, null)
    const c = dias[0].entries.find((x) => x.type === 'complemento')
    expect(c && c.type === 'complemento' && c.tipo).toBe('festivo')
    expect(c && c.type === 'complemento' && c.valor).toBe(1)
  })

  it('festivo nacional entre semana con turno trabajado: complemento festivo en la primera pasada', () => {
    // 2026-12-25 es viernes; probamos con un festivo nacional fijo en martes:
    // 2027-12-07... mejor usar Año Nuevo si cae martes. 2030-01-01 es martes.
    const dias = regenerarEnMemoria([day('2030-01-01', [e({ type: 'turno', periodo: 'tarde', horas: 8 })])], null, null)
    const c = dias[0].entries.find((x) => x.type === 'complemento')
    expect(c && c.type === 'complemento' && c.tipo).toBe('festivo')
    expect(c && c.type === 'complemento' && c.valor).toBe(1)
  })

  it('sin comunidad configurada, el autonómico no genera festivo ni complemento (miércoles normal)', () => {
    // 2028-05-31 es miércoles: sin festivo marcado no debería generar nada.
    const dias = regenerarEnMemoria([day('2028-05-31', [e({ type: 'turno', periodo: 'manana', horas: 8 })])], null, null)
    const c = dias[0].entries.find((x) => x.type === 'complemento')
    expect(c).toBeUndefined()
  })

  it('con Castilla-La Mancha configurada, el autonómico sí genera festivo y complemento', () => {
    const dias = regenerarEnMemoria([day('2028-05-31', [e({ type: 'turno', periodo: 'manana', horas: 8 })])], null, 'CLM')
    const f = dias[0].entries.find((x) => x.type === 'festivo')
    const c = dias[0].entries.find((x) => x.type === 'complemento')
    expect(f && f.type === 'festivo' && f.nombre).toBe('Día de Castilla-La Mancha')
    expect(c && c.type === 'complemento' && c.tipo).toBe('festivo')
  })
})
