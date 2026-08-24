import fs from 'node:fs'
import path from 'node:path'
import { appCacheDir } from '../platform'

const CACHE_DIR = appCacheDir()

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
