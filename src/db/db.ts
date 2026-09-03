import Dexie, { type Table } from 'dexie'
import type { Day, MetaEntry } from './types'

export const SCHEMA_VERSION = 1

export class CuadranteDB extends Dexie {
  days!: Table<Day, string>
  meta!: Table<MetaEntry, string>

  constructor() {
    super('calendario-curro')
    this.version(1).stores({
      days: 'date',
      meta: 'key',
    })
  }
}

export const db = new CuadranteDB()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
