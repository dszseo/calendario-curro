/**
 * Registro de cambios visible para quien usa la app (Ajustes → Novedades).
 * Va por fecha, más reciente primero. Cada cambio real que se despliegue a
 * producción debería añadir aquí una línea en español llano, sin nombres de
 * ficheros ni jerga técnica — es para quien ve que la app se actualizó y
 * quiere saber qué cambió, no para desarrolladores (para eso está el log de
 * git).
 */
export interface CambioFecha {
  fecha: string // "YYYY-MM-DD"
  cambios: string[]
}

export const CHANGELOG: CambioFecha[] = [
  {
    fecha: '2026-09-23',
    cambios: [
      'Festivos automáticos: los nacionales y los de tu comunidad autónoma se marcan solos en el calendario, sin conexión. Se pueden quitar con la papelera o recalcular, como el resto de cosas automáticas.',
      'Nuevo permiso de maternidad/paternidad: se marca por rango (inicio y fin) como la baja médica, contando también fines de semana y festivos.',
      'Nueva sección "Novedades" en Ajustes con el historial de cambios de la app.',
      'Los botones sueltos de "marcar baja/vacaciones/permiso" se juntan en uno solo, "+ Añadir periodo", que primero pregunta cuál de los tres quieres.',
    ],
  },
  {
    fecha: '2026-09-22',
    cambios: [
      'El complemento de sábado y festivo ya se ve en la casilla del calendario, no solo dentro de la ficha del día.',
      'Si quitas algo automático (bolsa, complemento, libranza, festivo...) con la papelera, ahora sale un aviso en la ficha del día explicando que no se vuelve a calcular hasta que pulses «Recalcular».',
      'Casillas del calendario más claras: el turno se ve igual, y todo lo demás (complementos, ajustes, notas...) se resume en un único indicador «+N» para que quepa siempre.',
      'Los días sin turno propio (libre, baja, vacaciones, festivo marcado...) vuelven a verse con su franja de color grande, en vez de un «+N» genérico.',
      'Nuevo botón en Ajustes para borrar la disponibilidad T/D del todo o desde una fecha en adelante.',
      'La T/D del fin de semana se ve junto al número del día, ya no cuenta como una cosa más del «+N».',
    ],
  },
  {
    fecha: '2026-09-20',
    cambios: [
      'Se puede deslizar con el dedo para cambiar de mes en el calendario.',
      'Las vacaciones se marcan igual que una baja médica: inicio, fin, y se rellena sola.',
      'Al marcar baja o vacaciones, la ficha del día se cierra sola.',
    ],
  },
  {
    fecha: '2026-09-14',
    cambios: [
      'Nueva pantalla «Vacaciones y días del año»: cuenta lo gastado y lo que queda de vacaciones, asuntos propios y regulación.',
    ],
  },
]
