import type { ViewModel } from '../shared/types'
import type { SessionState } from './log/draft-store'
import { rateCards, sortByGihWr, type PersonalStatsLookup } from './data/join'
import { getRatings } from './data/ratings'

/**
 * Builds the renderer's view model from the current session state.
 * Ratings fetches are disk-cached, so this is cheap after the first call.
 */
export async function buildViewModel(
  state: SessionState,
  personal?: PersonalStatsLookup,
  formatOverride?: string
): Promise<ViewModel> {
  if (!state.set || !state.format) {
    return { kind: 'idle', message: 'Waiting for a draft or sealed event…' }
  }

  const format = formatOverride ?? state.format
  const ratings = await getRatings(state.set, format)
  const source = ratings?.source ?? 'no 17lands data'

  if (state.draft && !state.draft.completed && state.draft.packGrpIds.length > 0) {
    return {
      kind: 'pack',
      set: state.set,
      format: state.format,
      ratingsSource: source,
      pack: state.draft.pack,
      pick: state.draft.pick,
      cards: sortByGihWr(await rateCards(state.draft.packGrpIds, ratings, personal)),
      picked: await rateCards(state.draft.pickedGrpIds, ratings, personal),
      personalConnected: personal !== undefined
    }
  }

  if (state.sealedPool) {
    return {
      kind: 'sealed',
      set: state.set,
      format: state.format,
      ratingsSource: source,
      cards: sortByGihWr(await rateCards(state.sealedPool.grpIds, ratings, personal)),
      personalConnected: personal !== undefined
    }
  }

  if (state.draft?.completed) {
    return {
      kind: 'sealed',
      set: state.set,
      format: state.format,
      ratingsSource: source,
      cards: sortByGihWr(await rateCards(state.draft.pickedGrpIds, ratings, personal)),
      personalConnected: personal !== undefined
    }
  }

  return {
    kind: 'idle',
    message: `In ${state.eventName ?? 'a limited event'} — waiting for pack…`
  }
}
