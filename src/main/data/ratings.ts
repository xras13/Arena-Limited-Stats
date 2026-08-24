import type { CardRating } from '../../shared/types'
import { readCache, readCacheStale, writeCache } from './cache'

const RATINGS_TTL_MS = 24 * 60 * 60 * 1000

export interface RatingsResult {
  source: string
  byMtgaId: Map<number, CardRating>
  byName: Map<string, CardRating>
  meanGihWr: number
}

export function formatFallbackChain(arenaFormat: string): string[] {
  const KNOWN = [
    'PremierDraft',
    'TradDraft',
    'QuickDraft',
    'PickTwoDraft',
    'Sealed',
    'TradSealed'
  ]
  const chain = KNOWN.includes(arenaFormat) ? [arenaFormat] : []
  const isSealed = /Sealed/i.test(arenaFormat)
  for (const fallback of isSealed ? ['Sealed', 'PremierDraft'] : ['PremierDraft', 'QuickDraft']) {
    if (!chain.includes(fallback)) chain.push(fallback)
  }
  return chain
}

const MIN_COVERAGE = 0.5

export async function getRatings(set: string, arenaFormat: string): Promise<RatingsResult | null> {
  let best: { rows: RawRow[]; format: string; coverage: number } | null = null
  for (const format of formatFallbackChain(arenaFormat)) {
    const rows = await fetchRatingRows(set, format)
    if (!rows || rows.length === 0) continue
    const coverage = rows.filter((r) => typeof r.ever_drawn_win_rate === 'number').length / rows.length
    if (coverage >= MIN_COVERAGE) return buildResult(format, rows)
    if (!best || coverage > best.coverage) best = { rows, format, coverage }
  }
  return best ? buildResult(best.format, best.rows) : null
}

interface RawRow {
  name: string
  mtga_id: number
  color: string
  rarity: string
  types: string[]
  url: string
  avg_seen: number
  avg_pick: number
  game_count: number
  play_rate: number
  win_rate: number
  opening_hand_win_rate: number
  ever_drawn_win_rate: number
  drawn_improvement_win_rate: number
}

async function fetchRatingRows(set: string, format: string): Promise<RawRow[] | null> {
  const cacheKey = `ratings-v2-${set}-${format}`
  const cached = readCache<RawRow[]>(cacheKey, RATINGS_TTL_MS)
  if (cached) return cached

  const url = `https://www.17lands.com/api/card_data?expansion=${encodeURIComponent(set)}&event_type=${encodeURIComponent(format)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'mtga-companion (personal draft overlay)' }
    })
    if (!res.ok) throw new Error(`17lands ${res.status}`)
    const payload = (await res.json()) as { data?: RawRow[] } | RawRow[]
    const rows = Array.isArray(payload) ? payload : payload.data
    if (!Array.isArray(rows)) throw new Error('unexpected 17lands payload')
    if (rows.length > 0) writeCache(cacheKey, rows)
    return rows
  } catch (err) {
    console.warn(`[ratings] fetch failed for ${set}/${format}: ${String(err)}`)
    return readCacheStale<RawRow[]>(cacheKey)
  }
}

function buildResult(source: string, rows: RawRow[]): RatingsResult {
  const byMtgaId = new Map<number, CardRating>()
  const byName = new Map<string, CardRating>()
  let gihSum = 0
  let gihCount = 0

  for (const row of rows) {
    const rating: CardRating = {
      mtgaId: Number(row.mtga_id) || 0,
      name: row.name,
      color: row.color ?? '',
      rarity: row.rarity ?? '',
      types: row.types ?? [],
      imageUrl: row.url ?? '',
      avgSeen: row.avg_seen,
      avgPick: row.avg_pick,
      gameCount: row.game_count,
      winRate: row.win_rate,
      openingHandWinRate: row.opening_hand_win_rate,
      everDrawnWinRate: row.ever_drawn_win_rate,
      drawnImprovementWinRate: row.drawn_improvement_win_rate,
      playRate: row.play_rate
    }
    if (rating.mtgaId) byMtgaId.set(rating.mtgaId, rating)
    byName.set(normalizeName(rating.name), rating)
    if (typeof rating.everDrawnWinRate === 'number' && rating.everDrawnWinRate > 0) {
      gihSum += rating.everDrawnWinRate
      gihCount++
    }
  }

  return {
    source,
    byMtgaId,
    byName,
    meanGihWr: gihCount > 0 ? gihSum / gihCount : 0.55
  }
}

export function normalizeName(name: string): string {
  return name.split('//')[0].trim().toLowerCase()
}
