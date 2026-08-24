import type { PersonalCardStats, RatedCard } from '../../shared/types'
import type { RatingsResult } from './ratings'
import { lookupArenaCard } from './scryfall'
import { lookupLocalCard } from './arena-db'

export type PersonalStatsLookup = (name: string) => PersonalCardStats | undefined

export async function rateCards(
  grpIds: number[],
  ratings: RatingsResult | null,
  personal?: PersonalStatsLookup
): Promise<RatedCard[]> {
  return Promise.all(
    grpIds.map(async (grpId): Promise<RatedCard> => {
      const rating = ratings?.byMtgaId.get(grpId)
      if (rating) {
        return {
          grpId,
          name: rating.name,
          color: rating.color,
          rarity: rating.rarity,
          imageUrl: rating.imageUrl,
          rating,
          personal: personal?.(rating.name)
        }
      }
      const scryfall = await lookupArenaCard(grpId)
      if (scryfall) {
        const byName = ratings?.byName.get(normalize(scryfall.name))
        return {
          grpId,
          name: scryfall.name,
          color: scryfall.color,
          rarity: scryfall.rarity,
          imageUrl: scryfall.imageUrl,
          rating: byName,
          personal: personal?.(scryfall.name)
        }
      }
      const local = lookupLocalCard(grpId)
      if (local) {
        const byName = ratings?.byName.get(normalize(local.name))
        return {
          grpId,
          name: local.name,
          color: local.color,
          rarity: local.rarity,
          imageUrl: byName?.imageUrl,
          rating: byName,
          personal: personal?.(local.name)
        }
      }
      return { grpId, name: `#${grpId}`, color: '', rarity: '' }
    })
  )
}

function normalize(name: string): string {
  return name.split('//')[0].trim().toLowerCase()
}

const BASIC_LAND = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i

export function collapsePool(cards: RatedCard[]): RatedCard[] {
  const byGrpId = new Map<number, RatedCard>()
  for (const card of cards) {
    if (card.rarity === 'basic' || BASIC_LAND.test(card.name)) continue
    const existing = byGrpId.get(card.grpId)
    if (existing) existing.count = (existing.count ?? 1) + 1
    else byGrpId.set(card.grpId, { ...card, count: 1 })
  }
  return [...byGrpId.values()]
}

export function sortByGihWr(cards: RatedCard[]): RatedCard[] {
  return [...cards].sort((a, b) => {
    const aWr = a.rating?.everDrawnWinRate ?? -1
    const bWr = b.rating?.everDrawnWinRate ?? -1
    return bWr - aWr
  })
}
