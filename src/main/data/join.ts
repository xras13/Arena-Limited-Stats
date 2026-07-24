import type { PersonalCardStats, RatedCard } from '../../shared/types'
import type { RatingsResult } from './ratings'
import { lookupArenaCard } from './scryfall'
import { lookupLocalCard } from './arena-db'

export type PersonalStatsLookup = (name: string) => PersonalCardStats | undefined

/**
 * Joins Arena grpIds against 17lands ratings (primary, keyed by mtga_id),
 * then Scryfall (name + image), then Arena's local card database (name only,
 * but knows every grpId the game does — basics, brand-new sets).
 * Cards that resolve nowhere still render (as "#grpId") rather than vanish.
 */
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
        // Scryfall knows the card; 17lands may still have it under its name
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
        // Alt printings share a name with the rated base printing
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

/** Sort for pack display: rated cards by GIH WR desc, unrated sink to bottom. */
export function sortByGihWr(cards: RatedCard[]): RatedCard[] {
  return [...cards].sort((a, b) => {
    const aWr = a.rating?.everDrawnWinRate ?? -1
    const bWr = b.rating?.everDrawnWinRate ?? -1
    return bWr - aWr
  })
}
