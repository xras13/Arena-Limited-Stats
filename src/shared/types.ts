export interface CardRating {
  mtgaId: number
  name: string
  color: string
  rarity: string
  types: string[]
  imageUrl: string
  avgSeen: number | null
  avgPick: number | null
  gameCount: number | null
  winRate: number | null
  openingHandWinRate: number | null
  everDrawnWinRate: number | null
  drawnImprovementWinRate: number | null
  playRate: number | null
}

export interface PersonalCardStats {
  winRate: number | null
  playRate: number | null
  gameCount: number
}

export interface RatedCard {
  grpId: number
  name: string
  color: string
  rarity: string
  imageUrl?: string
  rating?: CardRating
  personal?: PersonalCardStats
  count?: number
}

export interface PackViewModel {
  kind: 'pack'
  set: string
  format: string
  ratingsSource: string
  pack: number
  pick: number
  cards: RatedCard[]
  picked: RatedCard[]
  personalConnected: boolean
}

export interface SealedViewModel {
  kind: 'sealed'
  set: string
  format: string
  ratingsSource: string
  cards: RatedCard[]
  personalConnected: boolean
}

export interface IdleViewModel {
  kind: 'idle'
  message: string
}

export type ViewModel = PackViewModel | SealedViewModel | IdleViewModel

export interface Settings {
  opacity: number
  logPath?: string
  formatOverride?: string
}
