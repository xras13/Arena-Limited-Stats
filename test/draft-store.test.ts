import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DraftStore } from '../src/main/log/draft-store'
import { LogParser } from '../src/main/log/parser'
import type { LogEvent } from '../src/main/log/events'

const FIXTURE = path.join(__dirname, 'fixtures/pick2draft-msh-player.log')

function replay(text: string): { store: DraftStore; events: LogEvent[] } {
  const parser = new LogParser()
  const store = new DraftStore()
  const events: LogEvent[] = []
  for (const line of text.split(/\r?\n/)) {
    for (const event of parser.feedLine(line)) {
      events.push(event)
      store.apply(event)
    }
  }
  return { store, events }
}

describe('DraftStore over the real MSH pick-two draft fixture', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8')
  const { store, events } = replay(text)

  it('sees the full draft: 21 packs shown, 21 picks made', () => {
    expect(events.filter((e) => e.type === 'DraftPackUpdated')).toHaveLength(21)
    expect(events.filter((e) => e.type === 'PickMade')).toHaveLength(21)
  })

  it('identifies the event as PickTwoDraft / MSH', () => {
    const state = store.getState()
    expect(state.format).toBe('PickTwoDraft')
    expect(state.set).toBe('MSH')
  })

  it('records 42 picked cards (2 per pick) and marks the draft completed', () => {
    const state = store.getState()
    expect(state.draft?.pickedGrpIds).toHaveLength(42)
    expect(state.draft?.completed).toBe(true)
  })

  it('sees monotonically non-decreasing (pack, pick) ordering', () => {
    let last = 0
    for (const e of events) {
      if (e.type !== 'DraftPackUpdated') continue
      const key = e.pack * 100 + e.pick
      expect(key).toBeGreaterThanOrEqual(last)
      last = key
    }
  })

  it('every shown pack has between 1 and 15 cards', () => {
    for (const e of events) {
      if (e.type !== 'DraftPackUpdated') continue
      expect(e.grpIds.length).toBeGreaterThanOrEqual(1)
      expect(e.grpIds.length).toBeLessThanOrEqual(15)
    }
  })
})

describe('DraftStore completion', () => {
  it('marks the draft completed and adopts the authoritative pool from the event', () => {
    const store = new DraftStore()
    store.apply({ type: 'EventJoined', eventName: 'QuickDraft_MSH_20260702' })
    store.apply({
      type: 'DraftPackUpdated',
      draftId: 'QuickDraft_MSH_20260702',
      pack: 3,
      pick: 14,
      grpIds: [105182]
    })
    store.apply({
      type: 'PickMade',
      draftId: 'QuickDraft_MSH_20260702',
      pack: 3,
      pick: 14,
      grpIds: [105182]
    })
    store.apply({
      type: 'DraftCompleted',
      eventName: 'QuickDraft_MSH_20260702',
      pickedGrpIds: [105138, 105118, 105182]
    })
    const state = store.getState()
    expect(state.draft?.completed).toBe(true)
    expect(state.draft?.pickedGrpIds).toEqual([105138, 105118, 105182])
  })

  it('keeps the tracked pool when DraftCompleted carries none', () => {
    const store = new DraftStore()
    store.apply({
      type: 'DraftPackUpdated',
      draftId: 'd1',
      pack: 3,
      pick: 14,
      grpIds: [105182]
    })
    store.apply({ type: 'PickMade', draftId: 'd1', pack: 3, pick: 14, grpIds: [105182] })
    store.apply({ type: 'DraftCompleted', eventName: 'PickTwoDraft_MSH_20260623' })
    const state = store.getState()
    expect(state.draft?.completed).toBe(true)
    expect(state.draft?.pickedGrpIds).toEqual([105182])
  })
})

describe('DraftStore reset', () => {
  it('clears all state on LogReset', () => {
    const store = new DraftStore()
    store.apply({ type: 'EventJoined', eventName: 'QuickDraft_FIN_20250701' })
    expect(store.getState().set).toBe('FIN')
    store.apply({ type: 'LogReset' })
    expect(store.getState()).toEqual({})
  })

  it('recovers the active event from courses when EventJoin was missed', () => {
    const store = new DraftStore()
    store.apply({
      type: 'CoursesUpdated',
      courses: [
        { courseId: 'x', internalEventName: 'Sealed_MSH_20260601', cardPool: [1, 2, 3] }
      ]
    })
    const state = store.getState()
    expect(state.set).toBe('MSH')
    expect(state.format).toBe('Sealed')
    expect(state.sealedPool?.grpIds).toEqual([1, 2, 3])
  })
})
