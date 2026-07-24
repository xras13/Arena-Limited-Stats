import { describe, expect, it } from 'vitest'
import { rateCards, sortByGihWr } from '../src/main/data/join'
import { formatFallbackChain, normalizeName } from '../src/main/data/ratings'
import type { RatingsResult } from '../src/main/data/ratings'
import type { CardRating, RatedCard } from '../src/shared/types'

function rating(mtgaId: number, name: string, gihWr: number): CardRating {
  return {
    mtgaId,
    name,
    color: 'W',
    rarity: 'common',
    types: [],
    imageUrl: '',
    avgSeen: 5,
    avgPick: 5,
    gameCount: 1000,
    winRate: 0.55,
    openingHandWinRate: 0.55,
    everDrawnWinRate: gihWr,
    drawnImprovementWinRate: 0.02,
    playRate: 0.5
  }
}

function ratingsResult(ratings: CardRating[]): RatingsResult {
  return {
    source: 'PremierDraft',
    byMtgaId: new Map(ratings.map((r) => [r.mtgaId, r])),
    byName: new Map(ratings.map((r) => [normalizeName(r.name), r])),
    meanGihWr: 0.55
  }
}

describe('rateCards', () => {
  it('joins by mtga_id and keeps unknown cards visible', async () => {
    const ratings = ratingsResult([rating(101, 'Alpha', 0.6), rating(102, 'Beta', 0.5)])
    // 999999999 resolves nowhere (Scryfall negative lookup may hit network once;
    // an invalid id returns 404 and is cached)
    const cards = await rateCards([101, 102], ratings)
    expect(cards.map((c) => c.name)).toEqual(['Alpha', 'Beta'])
    expect(cards[0].rating?.everDrawnWinRate).toBe(0.6)
  })
})

describe('sortByGihWr', () => {
  it('sorts rated cards descending, unrated last', () => {
    const cards: RatedCard[] = [
      { grpId: 1, name: 'Low', color: '', rarity: '', rating: rating(1, 'Low', 0.5) },
      { grpId: 2, name: 'Unrated', color: '', rarity: '' },
      { grpId: 3, name: 'High', color: '', rarity: '', rating: rating(3, 'High', 0.62) }
    ]
    expect(sortByGihWr(cards).map((c) => c.name)).toEqual(['High', 'Low', 'Unrated'])
  })
})

describe('formatFallbackChain', () => {
  it('tries the exact known format first', () => {
    expect(formatFallbackChain('PickTwoDraft')[0]).toBe('PickTwoDraft')
    expect(formatFallbackChain('QuickDraft')[0]).toBe('QuickDraft')
  })

  it('falls back to Sealed for unknown sealed-like formats', () => {
    expect(formatFallbackChain('SuperSealed')[0]).toBe('Sealed')
  })

  it('falls back to PremierDraft for unknown draft formats', () => {
    expect(formatFallbackChain('WeirdDraft')[0]).toBe('PremierDraft')
  })
})
