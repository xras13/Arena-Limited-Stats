import { readCache, readCacheStale, writeCache } from './cache'

export interface ScryfallCard {
  name: string
  color: string
  rarity: string
  imageUrl?: string
}

type CachedLookup = ScryfallCard | 'not_found'

const NOT_FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000

const inFlight = new Map<number, Promise<ScryfallCard | null>>()
let lastRequestAt = 0

export async function lookupArenaCard(grpId: number): Promise<ScryfallCard | null> {
  const cacheKey = `scryfall-arena-${grpId}`
  const cached = readCacheStale<CachedLookup>(cacheKey)
  if (cached && cached !== 'not_found') return cached
  if (cached === 'not_found') {
    if (readCache<CachedLookup>(cacheKey, NOT_FOUND_TTL_MS) === 'not_found') return null
  }

  const pending = inFlight.get(grpId)
  if (pending) return pending

  const promise = doLookup(grpId, cacheKey).finally(() => inFlight.delete(grpId))
  inFlight.set(grpId, promise)
  return promise
}

async function doLookup(grpId: number, cacheKey: string): Promise<ScryfallCard | null> {
  const wait = Math.max(0, lastRequestAt + 150 - Date.now())
  lastRequestAt = Date.now() + wait
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))

  try {
    const res = await fetch(`https://api.scryfall.com/cards/arena/${grpId}`, {
      headers: { 'User-Agent': 'arena-limited-stats (personal draft overlay)' }
    })
    if (res.status === 404) {
      writeCache<CachedLookup>(cacheKey, 'not_found')
      return null
    }
    if (!res.ok) return null
    const raw = (await res.json()) as Record<string, any>
    const card: ScryfallCard = {
      name: String(raw.name ?? ''),
      color: Array.isArray(raw.colors) ? raw.colors.join('') : '',
      rarity: String(raw.rarity ?? ''),
      imageUrl:
        raw.image_uris?.normal ?? raw.card_faces?.[0]?.image_uris?.normal ?? undefined
    }
    writeCache<CachedLookup>(cacheKey, card)
    return card
  } catch {
    return null
  }
}
