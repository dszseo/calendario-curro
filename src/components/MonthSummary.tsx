import type { Day } from '../db/types'
import { resumenMes } from '../lib/calc/resumen'

const hh = (n: number) => (Number.isInteger(n) ? `${n} h` : `${n.toFixed(1)} h`)
const signed = (n: number) => `${n > 0 ? '+' : ''}${hh(n)}`

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div class="stat">
      <div class="k">{k}</div>
      <div class="v">{v}</div>
    </div>
  )
}

export function MonthSummary({ days }: { days: Day[] }) {
  const r = resumenMes(days)
  const turnos = `${r.porPeriodo.manana}M · ${r.porPeriodo.tarde}T · ${r.porPeriodo.noche}N`
  const libranzasTotal =
    r.libranzas.asuntos +
    r.libranzas.regulacion +
    r.libranzas.vacaciones +
    r.libranzas.horas +
    r.libranzas.permiso +
    r.libranzas.especial

  return (
    <div class="section">
      <h2>Resumen del mes</h2>
      <div class="grid2">
        <Stat k="Días con turno" v={r.diasConTurno} />
        <Stat k="Horas de turno" v={hh(r.horasTurno)} />
        <Stat k="Turnos (M/T/N)" v={turnos} />
        <Stat k="Festivos marcados" v={r.festivos} />
        {r.complementoSabado > 0 && <Stat k="Complementos sábado" v={r.complementoSabado} />}
        {r.complementoFestivo > 0 && <Stat k="Complementos festivo" v={r.complementoFestivo} />}
        {r.librosCompensatorios > 0 && (
          <Stat k="Libranzas por finde" v={r.librosCompensatorios} />
        )}
        {libranzasTotal > 0 && <Stat k="Libranzas de 1 día" v={libranzasTotal} />}
        {r.vacaciones > 0 && <Stat k="Días de vacaciones" v={r.vacaciones} />}
        {r.asuntosPropios > 0 && <Stat k="Asuntos propios" v={r.asuntosPropios} />}
        {r.regulacion > 0 && <Stat k="Días de regulación" v={r.regulacion} />}
        {r.permisos > 0 && <Stat k="Permisos retribuidos" v={r.permisos} />}
        {r.bajas > 0 && <Stat k="Días de baja" v={r.bajas} />}
        {r.permisosML > 0 && <Stat k="Permiso maternidad/paternidad" v={r.permisosML} />}
        {r.diasEspeciales > 0 && <Stat k="Días especiales" v={r.diasEspeciales} />}
        {r.horasExtraCobrar > 0 && <Stat k="Horas extra a cobrar" v={hh(r.horasExtraCobrar)} />}
        {r.horasExtraBolsa > 0 && <Stat k="Horas extra a bolsa" v={hh(r.horasExtraBolsa)} />}
        <Stat k="Variación bolsa (mes)" v={signed(r.variacionBolsa)} />
      </div>
    </div>
  )
}
