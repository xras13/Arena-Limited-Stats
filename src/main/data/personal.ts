import { BrowserWindow, session, type Session } from 'electron'
import type { PersonalCardStats } from '../../shared/types'
import { readCache, writeCache } from './cache'

const PARTITION = 'persist:17lands'
const BASE = 'https://www.17lands.com'
const PERSONAL_TTL_MS = 12 * 60 * 60 * 1000
const MAX_DRAFTS = 40
const REQUEST_SPACING_MS = 250

function ses(): Session {
  return session.fromPartition(PARTITION)
}

async function apiGet(path: string): Promise<unknown | null> {
  try {
    const res = await ses().fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('json')) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function isConnected(): Promise<boolean> {
  const account = (await apiGet('/api/account')) as Record<string, unknown> | null
  return account !== null && typeof account === 'object'
}

const COOKIE_LIFETIME_S = 90 * 24 * 60 * 60

async function persistSessionCookies(): Promise<void> {
  try {
    const cookies = await ses().cookies.get({ domain: '17lands.com' })
    for (const cookie of cookies) {
      if (!cookie.session) continue
      const host = (cookie.domain ?? 'www.17lands.com').replace(/^\./, '')
      try {
        await ses().cookies.set({
          url: `https://${host}${cookie.path ?? '/'}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: Date.now() / 1000 + COOKIE_LIFETIME_S
        })
      } catch {}
    }
    await ses().cookies.flushStore()
  } catch {}
}

export async function connect(): Promise<boolean> {
  if (await isConnected()) {
    await persistSessionCookies()
    return true
  }
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      title: 'Log in to 17lands',
      webPreferences: { partition: PARTITION }
    })
    let settled = false
    const finish = (ok: boolean): void => {
      if (settled) return
      settled = true
      clearInterval(poll)
      const done = ok ? persistSessionCookies() : Promise.resolve()
      void done.finally(() => {
        resolve(ok)
        if (!win.isDestroyed()) win.close()
      })
    }
    const poll = setInterval(() => {
      void isConnected().then((ok) => {
        if (ok) finish(true)
      })
    }, 2000)
    win.on('closed', () => {
      clearInterval(poll)
      if (!settled) {
        settled = true
        void isConnected().then(async (ok) => {
          if (ok) await persistSessionCookies()
          resolve(ok)
        })
      }
    })
    win.webContents.on('did-navigate', () => {
      void isConnected().then((ok) => {
        if (ok) finish(true)
      })
    })
    void win.loadURL(`${BASE}/login`)
  })
}

export type PersonalStatsMap = Map<string, PersonalCardStats>

interface DeckListEntry {
  draftId: string
  deckIndex: number
  wins: number | null
  losses: number | null
}

export async function getPersonalStats(set: string): Promise<PersonalStatsMap | null> {
  const cacheKey = `personal-${set}`
  const cached = readCache<Record<string, PersonalCardStats>>(cacheKey, PERSONAL_TTL_MS)
  if (cached) return new Map(Object.entries(cached))

  const deckList = (await apiGet('/data/user_deck_list')) as Record<string, unknown> | null
  const rawDecks = Array.isArray(deckList?.decks) ? (deckList.decks as Record<string, any>[]) : null
  if (!rawDecks) return null

  const byDraft = new Map<string, DeckListEntry>()
  for (const deck of rawDecks) {
    const expansion = firstString(deck, ['expansion', 'set', 'expansion_code'])
    if (expansion?.toUpperCase() !== set.toUpperCase()) continue
    const draftId = firstString(deck, ['draft_id', 'draftId', 'id'])
    if (!draftId) continue
    const deckIndex = firstNumber(deck, ['deck_index', 'deckIndex']) ?? 0
    const existing = byDraft.get(draftId)
    if (!existing || deckIndex > existing.deckIndex) {
      byDraft.set(draftId, {
        draftId,
        deckIndex,
        wins: firstNumber(deck, ['wins', 'win_count', 'match_wins']),
        losses: firstNumber(deck, ['losses', 'loss_count', 'match_losses'])
      })
    }
  }
  if (byDraft.size === 0) return new Map()

  const drafts = [...byDraft.values()].slice(0, MAX_DRAFTS)
  const perCard = new Map<string, { games: number; wins: number; decks: number }>()
  let draftsCounted = 0

  for (const draft of drafts) {
    await new Promise((r) => setTimeout(r, REQUEST_SPACING_MS))
    const deck = (await apiGet(
      `/api/deck/draft/?draft_id=${encodeURIComponent(draft.draftId)}&deck_index=${draft.deckIndex}`
    )) as Record<string, unknown> | null
    const maindeck = extractCardNames(deck?.maindeck)
    if (maindeck.length === 0) continue

    let wins = draft.wins
    let losses = draft.losses
    if (wins === null || losses === null) {
      const details = (await apiGet(
        `/data/event_details?draft_id=${encodeURIComponent(draft.draftId)}`
      )) as Record<string, any> | null
      const record = countRecord(details?.details?.match_results)
      wins = record.wins
      losses = record.losses
    }
    const games = (wins ?? 0) + (losses ?? 0)
    if (games === 0) continue

    draftsCounted++
    for (const name of new Set(maindeck.map(normalizeName))) {
      const entry = perCard.get(name) ?? { games: 0, wins: 0, decks: 0 }
      entry.games += games
      entry.wins += wins ?? 0
      entry.decks += 1
      perCard.set(name, entry)
    }
  }

  const result: PersonalStatsMap = new Map()
  for (const [name, { games, wins, decks }] of perCard) {
    result.set(name, {
      winRate: games > 0 ? wins / games : null,
      playRate: draftsCounted > 0 ? decks / draftsCounted : null,
      gameCount: games
    })
  }
  writeCache(cacheKey, Object.fromEntries(result))
  return result
}

function extractCardNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const names: string[] = []
  for (const item of value) {
    if (typeof item === 'string') names.push(item)
    else if (typeof item === 'object' && item !== null) {
      const record = item as Record<string, unknown>
      const name =
        firstString(record, ['name', 'card_name']) ??
        firstString((record.card as Record<string, unknown>) ?? {}, ['name'])
      if (name) names.push(name)
    }
  }
  return names
}

function countRecord(matchResults: unknown): { wins: number | null; losses: number | null } {
  if (!Array.isArray(matchResults)) return { wins: null, losses: null }
  let wins = 0
  let losses = 0
  for (const match of matchResults) {
    const games = (match as Record<string, any>)?.game_results
    if (!Array.isArray(games)) continue
    for (const game of games) {
      const won = (game as Record<string, any>)?.won ?? (game as Record<string, any>)?.win
      if (won === true) wins++
      else if (won === false) losses++
    }
  }
  return { wins, losses }
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string
  }
  return null
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (typeof obj[key] === 'number') return obj[key] as number
  }
  return null
}

export function normalizeName(name: string): string {
  return name.split('//')[0].trim().toLowerCase()
}
