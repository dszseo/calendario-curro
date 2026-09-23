import type { Day, LibranzaMotivo, Periodo } from '../../db/types'
import { bolsaDeltaDay, round1 } from './bolsa'

export interface ResumenMes {
  diasConTurno: number
  horasTurno: number
  porPeriodo: Record<Periodo, number>
  libranzas: Record<LibranzaMotivo, number>
  festivos: number
  bajas: number
  permisosML: number
  vacaciones: number
  asuntosPropios: number
  regulacion: number
  permisos: number
  diasEspeciales: number
  horasExtraCobrar: number
  horasExtraBolsa: number
  ajusteBolsaMes: number
  complementoSabado: number
  complementoFestivo: number
  librosCompensatorios: number
  /** Variación de la bolsa de horas en el mes (aprox.; el total está en la barra). */
  variacionBolsa: number
}

export function resumenMes(days: Day[]): ResumenMes {
  const r: ResumenMes = {
    diasConTurno: 0,
    horasTurno: 0,
    porPeriodo: { manana: 0, tarde: 0, noche: 0 },
    libranzas: { asuntos: 0, regulacion: 0, vacaciones: 0, horas: 0, permiso: 0, especial: 0 },
    festivos: 0,
    bajas: 0,
    permisosML: 0,
    vacaciones: 0,
    asuntosPropios: 0,
    regulacion: 0,
    permisos: 0,
    diasEspeciales: 0,
    horasExtraCobrar: 0,
    horasExtraBolsa: 0,
    ajusteBolsaMes: 0,
    complementoSabado: 0,
    complementoFestivo: 0,
    librosCompensatorios: 0,
    variacionBolsa: 0,
  }

  for (const d of days) {
    const libraComp = d.entries.some((e) => e.type === 'libranzaComp')
    for (const e of d.entries) {
      switch (e.type) {
        case 'turno':
          if (!libraComp) {
            r.diasConTurno++
            r.horasTurno += e.horas
            r.porPeriodo[e.periodo]++
          }
          break
        case 'libranzaComp':
          r.librosCompensatorios++
          break
        case 'libranza':
          r.libranzas[e.motivo]++
          // la libranza de 1 día (sección 17) cuenta para el mismo total que la
          // entrada dedicada — son dos formas de anotar lo mismo.
          if (e.motivo === 'vacaciones') r.vacaciones++
          else if (e.motivo === 'asuntos') r.asuntosPropios++
          else if (e.motivo === 'regulacion') r.regulacion++
          break
        case 'festivo':
          r.festivos++
          break
        case 'baja':
          r.bajas++
          break
        case 'permisoML':
          r.permisosML++
          break
        case 'vacaciones':
          r.vacaciones++
          break
        case 'asuntoPropio':
          r.asuntosPropios++
          break
        case 'regulacion':
          r.regulacion++
          break
        case 'permiso':
          r.permisos++
          break
        case 'diaEspecial':
          r.diasEspeciales++
          if (e.pagaHorasExtra) r.horasExtraCobrar += e.pagaHorasExtra
          break
        case 'horaExtra':
          if (e.destino === 'cobrar' || e.destino === 'ambos') r.horasExtraCobrar += e.horas
          if (e.destino === 'bolsa' || e.destino === 'ambos') r.horasExtraBolsa += e.horas
          break
        case 'ajusteBolsa':
          r.ajusteBolsaMes += e.override ?? e.horas
          break
        case 'complemento': {
          const v = e.override ?? e.valor
          if (e.tipo === 'sabado') r.complementoSabado += v
          else r.complementoFestivo += v
          break
        }
      }
    }
    r.variacionBolsa += bolsaDeltaDay(d)
  }

  r.horasTurno = round1(r.horasTurno)
  r.horasExtraCobrar = round1(r.horasExtraCobrar)
  r.horasExtraBolsa = round1(r.horasExtraBolsa)
  r.ajusteBolsaMes = round1(r.ajusteBolsaMes)
  r.complementoSabado = round1(r.complementoSabado)
  r.complementoFestivo = round1(r.complementoFestivo)
  r.variacionBolsa = round1(r.variacionBolsa)
  return r
}
