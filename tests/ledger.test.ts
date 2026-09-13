import { describe, expect, it } from 'vitest'
import { construirLedgerAnio, descripcionMovimiento } from '../src/lib/calc/ledger'
import type { AjusteBolsaEntry, Day, LibranzaCompEntry } from '../src/db/types'

const ajuste = (horas: number, motivo: string): AjusteBolsaEntry => ({
  id: Math.random().toString(),
  type: 'ajusteBolsa',
  horas,
  auto: true,
  motivo,
})

const libranzaComp = (dia: 'sabado' | 'domingo'): LibranzaCompEntry => ({
  id: Math.random().toString(),
  type: 'libranzaComp',
  dia,
  auto: true,
})

describe('ledger', () => {
  it('reproduce el folio de la oficina: ajuste + sábado/domingo trabajados + sus libranzas', () => {
    const days: Day[] = [
      { date: '2026-01-05', entries: [ajuste(8, 'Sábado trabajado (fuera de jornada)')], updatedAt: 0 },
      { date: '2026-01-06', entries: [ajuste(8, 'Domingo trabajado (fuera de jornada)')], updatedAt: 0 },
      { date: '2026-01-07', entries: [libranzaComp('sabado')], updatedAt: 0 },
      { date: '2026-01-08', entries: [libranzaComp('domingo')], updatedAt: 0 },
    ]

    const lineas = construirLedgerAnio(2026, days, 20)

    expect(lineas).toEqual([
      { date: '2026-01-01', desc: 'Ajuste 2025', horas: 20, saldo: 20 },
      { date: '2026-01-05', desc: 'Sábado trabajado (fuera de jornada)', horas: 8, saldo: 28 },
      { date: '2026-01-06', desc: 'Domingo trabajado (fuera de jornada)', horas: 8, saldo: 36 },
      { date: '2026-01-07', desc: 'Libranza compensatoria (sábado)', horas: -8, saldo: 28 },
      { date: '2026-01-08', desc: 'Libranza compensatoria (domingo)', horas: -8, saldo: 20 },
    ])
  })

  it('año sin movimientos: solo la línea de ajuste', () => {
    const lineas = construirLedgerAnio(2026, [], 5)
    expect(lineas).toEqual([{ date: '2026-01-01', desc: 'Ajuste 2025', horas: 5, saldo: 5 }])
  })

  it('descripcionMovimiento ignora entradas que no mueven la bolsa', () => {
    expect(descripcionMovimiento({ id: '1', type: 'turno', periodo: 'manana', horas: 8 })).toBeNull()
    expect(
      descripcionMovimiento({ id: '2', type: 'horaExtra', horas: 2, destino: 'cobrar' }),
    ).toBeNull()
    expect(
      descripcionMovimiento({ id: '3', type: 'horaExtra', horas: 2, destino: 'bolsa' }),
    ).toBe('Hora extra a la bolsa')
  })
})
