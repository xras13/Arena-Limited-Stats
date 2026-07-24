import { readCache, readCacheStale, writeCache } from './cache'

/**
 * Fallback card lookup for grpIds that 17lands ratings don't cover
 * (basic lands, bonus sheets, tokens). Uses Scryfall's per-arena-id
 * endpoint with a disk cache: hits are kept forever, misses for a week —
 * Scryfall's arena_id mapping lags new sets, so a 404 today may resolve
 * after their next data update.
 */
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
    // Honor a recent miss; retry once it ages out
    if (readCache<CachedLookup>(cacheKey, NOT_FOUND_TTL_MS) === 'not_found') return null
  }

  const pending = inFlight.get(grpId)
  if (pending) return pending

  const promise = doLookup(grpId, cacheKey).finally(() => inFlight.delete(grpId))
  inFlight.set(grpId, promise)
  return promise
}

async function doLookup(grpId: number, cacheKey: string): Promise<ScryfallCard | null> {
  // Scryfall asks for <=10 requests/sec; space lookups ~150ms apart
  const wait = Math.max(0, lastRequestAt + 150 - Date.now())
  lastRequestAt = Date.now() + wait
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))

  try {
    const res = await fetch(`https://api.scryfall.com/cards/arena/${grpId}`, {
      headers: { 'User-Agent': 'mtga-companion (personal draft overlay)' }
    })
    if (res.status === 404) {
      writeCache<CachedLookup>(cacheKey, 'not_found')
      return null
    }
    if (!res.ok) return null // transient — retry on a future call
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
