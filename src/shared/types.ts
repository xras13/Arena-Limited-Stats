/** Types shared between main and renderer (the IPC view model). */

export interface CardRating {
  mtgaId: number
  name: string
  color: string
  rarity: string
  types: string[]
  imageUrl: string
  /**
   * Stat fields are null when 17lands lacks a large enough sample
   * (e.g. rarely-played cards early in a set).
   */
  /** ALSA — average last seen at */
  avgSeen: number | null
  /** ATA — average taken at */
  avgPick: number | null
  gameCount: number | null
  /** GP WR — games played win rate */
  winRate: number | null
  /** OH WR — opening hand win rate */
  openingHandWinRate: number | null
  /** GIH WR — games in hand win rate (primary sort metric) */
  everDrawnWinRate: number | null
  /** IWD — improvement when drawn */
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
}

export interface PackViewModel {
  kind: 'pack'
  set: string
  format: string
  /** which 17lands format the ratings actually came from (fallback chain) */
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
