import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { Settings } from '../shared/types'

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

export interface StoredSettings extends Settings {
  bounds?: WindowBounds
}

const DEFAULTS: StoredSettings = {
  opacity: 0.96
}

let cached: StoredSettings | null = null

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): StoredSettings {
  if (cached) return cached
  let loaded: StoredSettings
  try {
    loaded = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }
  } catch {
    loaded = { ...DEFAULTS }
  }
  cached = loaded
  return loaded
}

export function updateSettings(patch: Partial<StoredSettings>): StoredSettings {
  cached = { ...getSettings(), ...patch }
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(cached, null, 2))
  return cached
}
