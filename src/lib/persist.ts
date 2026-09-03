/** Pide almacenamiento persistente para que el navegador no borre los datos. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageStatus(): Promise<{
  persisted: boolean
  supported: boolean
  usageMB?: number
  quotaMB?: number
}> {
  const supported = !!navigator.storage?.persist
  if (!supported) return { persisted: false, supported }
  const persisted = await navigator.storage.persisted()
  let usageMB: number | undefined
  let quotaMB: number | undefined
  try {
    const est = await navigator.storage.estimate()
    if (est.usage != null) usageMB = Math.round((est.usage / 1_048_576) * 10) / 10
    if (est.quota != null) quotaMB = Math.round(est.quota / 1_048_576)
  } catch {
    /* ignora */
  }
  return { persisted, supported, usageMB, quotaMB }
}
