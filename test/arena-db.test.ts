import { describe, expect, it } from 'vitest'
import { lookupLocalCard } from '../src/main/data/arena-db'

const swamp = lookupLocalCard(105177)

describe.skipIf(swamp === null)('arena-db (requires local MTGA install)', () => {
  it('resolves basics that 17lands and Scryfall miss', () => {
    expect(swamp).toEqual({ name: 'Swamp', color: '', rarity: 'basic' })
  })

  it('resolves colored cards with WUBRG letters and rarity strings', () => {
    const card = lookupLocalCard(104892)
    expect(card?.name).toBe('Agent 13, Sharon Carter')
    expect(card?.color).toBe('W')
    expect(card?.rarity).toBe('uncommon')
  })

  it('returns null for unknown grpIds', () => {
    expect(lookupLocalCard(999999999)).toBeNull()
  })
})
