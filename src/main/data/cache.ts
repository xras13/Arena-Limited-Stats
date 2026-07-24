import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Tiny JSON disk cache. Lives in the same place Electron's userData points at
 * so the headless replay harness and the app share caches.
 */
const CACHE_DIR = path.join(
  os.homedir(),
  'Library/Application Support/mtga-companion/cache'
)

interface Envelope<T> {
  fetchedAt: number
  value: T
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  const entry = readEnvelope<T>(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null
  return entry.value
}

/** Returns the cached value regardless of age (offline fallback). */
export function readCacheStale<T>(key: string): T | null {
  return readEnvelope<T>(key)?.value ?? null
}

export function writeCache<T>(key: string, value: T): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const envelope: Envelope<T> = { fetchedAt: Date.now(), value }
  fs.writeFileSync(cachePath(key), JSON.stringify(envelope))
}

function readEnvelope<T>(key: string): Envelope<T> | null {
  try {
    return JSON.parse(fs.readFileSync(cachePath(key), 'utf8'))
  } catch {
    return null
  }
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`)
}
