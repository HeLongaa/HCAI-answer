function readImportMetaEnv(name: string): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name]
  } catch {
    return undefined
  }
}

export function readRuntimeEnv(name: string, fallback = ''): string {
  const normalizedName = name.trim()
  const reactName = normalizedName.startsWith('VITE_')
    ? `REACT_APP_${normalizedName.slice('VITE_'.length)}`
    : normalizedName
  return String.prototype.trim.call(
    readImportMetaEnv(normalizedName) ??
      process.env[normalizedName] ??
      process.env[reactName] ??
      fallback,
  )
}
