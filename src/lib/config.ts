/**
 * Constantes del convenio. En la Fase 1 son fijas; en la Fase 3 pasan a la
 * configuración anual editable (una fila por año). Centralizadas aquí para que
 * el resto del código no las tenga incrustadas.
 */
export const JORNADA_HORAS = 8

/** Horas mínimas trabajadas para cobrar el complemento de sábado/domingo/festivo. */
export const UMBRAL_COMPLEMENTO_HORAS = 4

/** Días disponibles por defecto (orientativo hasta la Fase 3). */
export const DIAS_POR_DEFECTO = {
  vacaciones: 22,
  asuntosPropios: 3,
  regulacion: 3,
} as const
