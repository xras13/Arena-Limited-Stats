import type { ViewModel } from '../shared/types'
import type { SessionState } from './log/draft-store'
import { collapsePool, rateCards, sortByGihWr, type PersonalStatsLookup } from './data/join'
import { getRatings } from './data/ratings'

type ActiveView =
  | {
      kind: 'pack'
      set: string
      format: string
      pack: number
      pick: number
      grpIds: number[]
      picked: number[]
    }
  | { kind: 'sealed'; set: string; format: string; grpIds: number[] }

function resolveActiveView(state: SessionState): ActiveView | null {
  const { set, format } = state
  if (!set || !format) return null

  const draft = state.draft
  if (draft && !draft.completed && draft.packGrpIds.length > 0) {
    return {
      kind: 'pack',
      set,
      format,
      pack: draft.pack,
      pick: draft.pick,
      grpIds: draft.packGrpIds,
      picked: draft.pickedGrpIds
    }
  }
  if (state.sealedPool) {
    return {
      kind: 'sealed',
      set: state.sealedPool.set ?? set,
      format,
      grpIds: state.sealedPool.grpIds
    }
  }
  if (draft?.completed) {
    return { kind: 'sealed', set, format, grpIds: draft.pickedGrpIds }
  }
  return null
}

export async function buildViewModel(
  state: SessionState,
  personal?: PersonalStatsLookup,
  formatOverride?: string
): Promise<ViewModel> {
  const active = resolveActiveView(state)
  if (!active) {
    return {
      kind: 'idle',
      message:
        state.set && state.format
          ? `In ${state.eventName ?? 'a limited event'} — waiting for pack…`
          : 'Waiting for a draft or sealed event…'
    }
  }

  const ratings = await getRatings(active.set, formatOverride ?? active.format)
  const source = ratings?.source ?? 'no 17lands data'

  if (active.kind === 'pack') {
    return {
      kind: 'pack',
      set: active.set,
      format: active.format,
      ratingsSource: source,
      pack: active.pack,
      pick: active.pick,
      cards: sortByGihWr(await rateCards(active.grpIds, ratings, personal)),
      picked: await rateCards(active.picked, ratings, personal),
      personalConnected: personal !== undefined
    }
  }

  return {
    kind: 'sealed',
    set: active.set,
    format: active.format,
    ratingsSource: source,
    cards: sortByGihWr(collapsePool(await rateCards(active.grpIds, ratings, personal))),
    personalConnected: personal !== undefined
  }
}
