import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { arenaRawDirs } from '../platform'

export interface ArenaCard {
  name: string
  color: string
  rarity: string
}

const RARITY: Record<number, string> = {
  1: 'basic',
  2: 'common',
  3: 'uncommon',
  4: 'rare',
  5: 'mythic'
}
const COLOR: Record<number, string> = { 1: 'W', 2: 'U', 3: 'B', 4: 'R', 5: 'G' }

interface Row {
  name: string | null
  rarity: number | null
  colors: string | null
}

let db: DatabaseSync | null = null
let dbTried = false

function findDatabasePath(): string | null {
  for (const dir of arenaRawDirs()) {
    try {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith('Raw_CardDatabase_') && f.endsWith('.mtga'))
        .map((f) => path.join(dir, f))
      if (files.length === 0) continue
      files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      return files[0]
    } catch {
      continue
    }
  }
  return null
}

function getDb(): DatabaseSync | null {
  if (dbTried) return db
  dbTried = true
  try {
    const file = findDatabasePath()
    if (!file) return null
    db = new DatabaseSync(file, { readOnly: true })
  } catch {
    db = null
  }
  return db
}

export function resetForTests(): void {
  db = null
  dbTried = false
}

export function lookupLocalCard(grpId: number): ArenaCard | null {
  const database = getDb()
  if (!database) return null
  try {
    const row = database
      .prepare(
        `SELECT (SELECT Loc FROM Localizations_enUS WHERE LocId = c.TitleId LIMIT 1) AS name,
                c.Rarity AS rarity, c.Colors AS colors
         FROM Cards c WHERE c.GrpId = ?`
      )
      .get(grpId) as Row | undefined
    if (!row || typeof row.name !== 'string' || row.name.length === 0) return null
    const color = String(row.colors ?? '')
      .split(',')
      .map((v) => COLOR[Number(v)])
      .filter(Boolean)
      .join('')
    return { name: row.name, color, rarity: RARITY[Number(row.rarity)] ?? '' }
  } catch {
    return null
  }
}
