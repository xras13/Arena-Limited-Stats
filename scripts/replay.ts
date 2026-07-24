/**
 * Replay harness: feed a Player.log through the parser + store and print
 * what the app would see. Usage:
 *
 *   npm run replay -- test/fixtures/pick2draft-msh-player.log
 */
import fs from 'node:fs'
import { LogParser } from '../src/main/log/parser'
import { DraftStore } from '../src/main/log/draft-store'
import { getRatings } from '../src/main/data/ratings'
import { rateCards, sortByGihWr } from '../src/main/data/join'
import type { RatedCard } from '../src/shared/types'

const file = process.argv[2]
if (!file) {
  console.error('usage: npm run replay -- <Player.log>')
  process.exit(1)
}

const parser = new LogParser()
const store = new DraftStore()

const text = fs.readFileSync(file, 'utf8')
let eventCount = 0

for (const line of text.split(/\r?\n/)) {
  for (const event of parser.feedLine(line)) {
    eventCount++
    switch (event.type) {
      case 'EventJoined':
        console.log(`EventJoined        ${event.eventName}`)
        break
      case 'DraftPackUpdated':
        console.log(
          `DraftPackUpdated   P${event.pack}P${event.pick}  ${event.grpIds.length} cards  [${event.grpIds.slice(0, 4).join(', ')}${event.grpIds.length > 4 ? ', …' : ''}]`
        )
        break
      case 'PickMade':
        console.log(`PickMade           P${event.pack}P${event.pick}  -> ${event.grpIds.join(', ')}`)
        break
      case 'DraftCompleted':
        console.log(`DraftCompleted     ${event.eventName}`)
        break
      case 'CoursesUpdated':
        for (const c of event.courses) {
          console.log(
            `CoursesUpdated     ${c.internalEventName}${c.cardPool ? `  pool=${c.cardPool.length}` : ''}`
          )
        }
        break
      case 'LogReset':
        console.log('LogReset')
        break
    }
    store.apply(event)
  }
}

const state = store.getState()
console.log('\n=== final state ===')
console.log(`events emitted : ${eventCount}`)
console.log(`active event   : ${state.eventName ?? '-'} (format=${state.format ?? '-'}, set=${state.set ?? '-'})`)
if (state.draft) {
  console.log(
    `draft          : ${state.draft.picks.length} picks, ${state.draft.pickedGrpIds.length} cards picked, last P${state.draft.pack}P${state.draft.pick}, completed=${state.draft.completed}`
  )
}
if (state.sealedPool) {
  console.log(`sealed pool    : ${state.sealedPool.grpIds.length} cards (${state.sealedPool.eventName})`)
}

// Rated table: join the last pack + full picked pool against 17lands
async function printRated(): Promise<void> {
  if (!state.set || !state.format) return
  const ratings = await getRatings(state.set, state.format)
  if (!ratings) {
    console.log(`\nno 17lands data found for ${state.set}/${state.format}`)
    return
  }
  console.log(`\n=== 17lands ratings (${state.set} / ${ratings.source}, mean GIH ${pct(ratings.meanGihWr)}) ===`)

  const table = (title: string, cards: RatedCard[]): void => {
    console.log(`\n${title}`)
    console.log('  GIH WR  OH WR   ALSA   IWD     R  Card')
    for (const c of sortByGihWr(cards)) {
      const r = c.rating
      const alsa = typeof r?.avgSeen === 'number' ? r.avgSeen.toFixed(2) : '-'
      const iwd =
        typeof r?.drawnImprovementWinRate === 'number'
          ? (r.drawnImprovementWinRate * 100).toFixed(1) + 'pp'
          : '-'
      console.log(
        `  ${pct(r?.everDrawnWinRate).padStart(6)}  ${pct(r?.openingHandWinRate).padStart(5)}  ${alsa.padStart(5)}  ${iwd.padStart(6)}  ${(c.rarity[0] ?? '-').toUpperCase()}  ${c.name}`
      )
    }
  }

  if (state.draft && state.draft.packGrpIds.length > 0) {
    table(
      `Last pack shown (P${state.draft.pack}P${state.draft.pick}):`,
      await rateCards(state.draft.packGrpIds, ratings)
    )
  }
  if (state.draft && state.draft.pickedGrpIds.length > 0) {
    table('Picked pool:', await rateCards(state.draft.pickedGrpIds, ratings))
  }
  if (state.sealedPool) {
    table('Sealed pool:', await rateCards(state.sealedPool.grpIds, ratings))
  }
}

function pct(v: number | null | undefined): string {
  return typeof v === 'number' && v > 0 ? (v * 100).toFixed(1) + '%' : '-'
}

void printRated()
