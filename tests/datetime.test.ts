import { describe, expect, it } from 'vitest'
import {
  addDaysKey,
  dowMon0,
  isWeekend,
  keysBetween,
  mondayOfWorkWeek,
} from '../src/lib/datetime'

describe('datetime', () => {
  it('dowMon0: lunes=0 … domingo=6', () => {
    expect(dowMon0('2026-09-07')).toBe(0) // lunes
    expect(dowMon0('2026-09-12')).toBe(5) // sábado
    expect(dowMon0('2026-09-13')).toBe(6) // domingo
  })

  it('isWeekend', () => {
    expect(isWeekend('2026-09-12')).toBe(true)
    expect(isWeekend('2026-09-13')).toBe(true)
    expect(isWeekend('2026-09-14')).toBe(false)
  })

  it('addDaysKey cruza fin de mes', () => {
    expect(addDaysKey('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('mondayOfWorkWeek: día entre semana -> su lunes', () => {
    expect(mondayOfWorkWeek('2026-09-09')).toBe('2026-09-07') // miércoles -> lunes
    expect(mondayOfWorkWeek('2026-09-07')).toBe('2026-09-07')
    expect(mondayOfWorkWeek('2026-09-12')).toBe('2026-09-07') // sábado -> lunes de esa semana
  })

  it('mondayOfWorkWeek: domingo -> lunes SIGUIENTE (cierra la semana previa)', () => {
    expect(mondayOfWorkWeek('2026-09-13')).toBe('2026-09-14')
  })

  it('keysBetween inclusivo y ordenado', () => {
    expect(keysBetween('2026-09-01', '2026-09-04')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ])
    expect(keysBetween('2026-09-04', '2026-09-01')).toHaveLength(4)
  })
})
