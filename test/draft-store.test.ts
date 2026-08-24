import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DraftStore } from '../src/main/log/draft-store'
import { LogParser } from '../src/main/log/parser'
import type { LogEvent } from '../src/main/log/events'

const FIXTURE = path.join(__dirname, 'fixtures/pick2draft-msh-player.log')

function readFixture(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

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

const draftFixture = readFixture(FIXTURE)

describe.skipIf(draftFixture === null)('DraftStore over the real MSH pick-two draft fixture', () => {
  const { store, events } = replay(draftFixture ?? '')

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

const SEALED_FIXTURE = path.join(__dirname, 'fixtures/sealed-hob-player.log')

function coursesEvent(
  courses: { name: string; module?: string; pool?: number[] }[]
): LogEvent {
  return {
    type: 'CoursesUpdated',
    courses: courses.map((c, i) => ({
      courseId: `course-${i}`,
      internalEventName: c.name,
      currentModule: c.module,
      cardPool: c.pool
    }))
  }
}

const sealedFixture = readFixture(SEALED_FIXTURE)

describe.skipIf(sealedFixture === null)('DraftStore over the real HOB sealed fixture', () => {
  const { store, events } = replay(sealedFixture ?? '')

  it('emits a single CoursesUpdated carrying all three courses', () => {
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('CoursesUpdated')
  })

  it('adopts the Arena Direct sealed event, whose format is not the first segment', () => {
    const state = store.getState()
    expect(state.eventName).toBe('ArenaDirect_HOB_Collector_Sealed_20260814')
    expect(state.format).toBe('Sealed')
    expect(state.set).toBe('HOB')
  })

  it('stores the full 84-card pool', () => {
    expect(store.getState().sealedPool?.grpIds).toHaveLength(84)
    expect(store.getState().sealedPool?.set).toBe('HOB')
  })
})

describe('DraftStore course selection', () => {
  it('prefers the course holding a pool over a finished one', () => {
    const store = new DraftStore()
    store.apply(
      coursesEvent([
        { name: 'PremierDraft_HOB_20260811', module: 'Complete', pool: [1, 2] },
        { name: 'ArenaDirect_HOB_Collector_Sealed_20260814', module: 'DeckSelect', pool: [3, 4, 5] }
      ])
    )
    const state = store.getState()
    expect(state.eventName).toBe('ArenaDirect_HOB_Collector_Sealed_20260814')
    expect(state.format).toBe('Sealed')
    expect(state.sealedPool?.grpIds).toEqual([3, 4, 5])
  })

  it('does not switch away from the event a draft is in progress for', () => {
    const store = new DraftStore()
    store.apply({ type: 'EventJoined', eventName: 'PremierDraft_HOB_20260811' })
    store.apply({
      type: 'DraftPackUpdated',
      draftId: 'd1',
      pack: 1,
      pick: 3,
      grpIds: [10, 11, 12]
    })
    store.apply(
      coursesEvent([
        { name: 'Sealed_MSH_20260601', module: 'Complete', pool: [90, 91] },
        { name: 'PremierDraft_HOB_20260811', module: 'PlayerDraft' }
      ])
    )
    const state = store.getState()
    expect(state.eventName).toBe('PremierDraft_HOB_20260811')
    expect(state.draft?.packGrpIds).toEqual([10, 11, 12])
    expect(state.sealedPool).toBeUndefined()
  })

  it('clears a stale draft when a different event becomes active', () => {
    const store = new DraftStore()
    store.apply({ type: 'EventJoined', eventName: 'PremierDraft_HOB_20260811' })
    store.apply({ type: 'DraftPackUpdated', draftId: 'd1', pack: 1, pick: 1, grpIds: [10, 11] })
    store.apply(
      coursesEvent([
        { name: 'ArenaDirect_HOB_Collector_Sealed_20260814', module: 'DeckSelect', pool: [3, 4] }
      ])
    )
    const state = store.getState()
    expect(state.draft).toBeUndefined()
    expect(state.sealedPool?.grpIds).toEqual([3, 4])
  })

  it('reports no change when the same courses payload is polled again', () => {
    const store = new DraftStore()
    let notifications = 0
    store.onChange(() => notifications++)
    const event = coursesEvent([
      { name: 'ArenaDirect_HOB_Collector_Sealed_20260814', module: 'DeckSelect', pool: [3, 4] }
    ])
    store.apply(event)
    store.apply(event)
    store.apply(event)
    expect(notifications).toBe(1)
  })

  it('ignores payloads with no limited events', () => {
    const store = new DraftStore()
    store.apply(coursesEvent([{ name: 'DualColorPrecons' }, { name: 'Historic_Ladder' }]))
    expect(store.getState()).toEqual({})
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
