import { getMeta, setMeta } from './db'
import { DIAS_POR_DEFECTO } from '../lib/config'

export interface ConfigDiasAnio {
  vacaciones: number
  asuntosPropios: number
  regulacion: number
}

const key = (year: number) => `diasConfig:${year}`

/** Días disponibles configurados para un año (por defecto los orientativos). */
export function getConfigDiasAnio(year: number): Promise<ConfigDiasAnio> {
  return getMeta<ConfigDiasAnio>(key(year), { ...DIAS_POR_DEFECTO })
}

/** Guarda los días disponibles de un año. No afecta a ningún otro año. */
export function setConfigDiasAnio(year: number, config: ConfigDiasAnio): Promise<void> {
  return setMeta(key(year), config)
}
