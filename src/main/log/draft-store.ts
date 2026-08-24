import type { LogEvent } from './events'
import { parseEventName } from './events'

export interface PickRecord {
  pack: number
  pick: number
  grpIds: number[]
}

export interface DraftState {
  draftId: string
  pack: number
  pick: number
  packGrpIds: number[]
  picks: PickRecord[]
  pickedGrpIds: number[]
  completed: boolean
}

export interface SealedPool {
  eventName: string
  set?: string
  grpIds: number[]
}

export interface SessionState {
  eventName?: string
  format?: string
  set?: string
  draft?: DraftState
  sealedPool?: SealedPool
}

type Listener = (state: SessionState) => void

interface LimitedCourse {
  course: { internalEventName: string; currentModule?: string; cardPool?: number[] }
  parsed: { format: string; set: string }
}

function bestCourse(courses: LimitedCourse[]): LimitedCourse {
  return courses.reduce((best, candidate) => (rank(candidate) >= rank(best) ? candidate : best))
}

function rank(c: LimitedCourse): number {
  const hasPool = c.course.cardPool && c.course.cardPool.length > 0 ? 2 : 0
  const running = c.course.currentModule !== 'Complete' ? 1 : 0
  return hasPool + running
}

function sameIds(a: number[] | undefined, b: number[] | null): boolean {
  if (!a || !b) return !a && !b
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export class DraftStore {
  private state: SessionState = {}
  private listeners: Listener[] = []

  getState(): SessionState {
    return this.state
  }

  onChange(listener: Listener): void {
    this.listeners.push(listener)
  }

  apply(event: LogEvent): void {
    const changed = this.reduce(event)
    if (changed) {
      for (const listener of this.listeners) listener(this.state)
    }
  }

  private reduce(event: LogEvent): boolean {
    switch (event.type) {
      case 'LogReset':
        this.state = {}
        return true

      case 'EventJoined': {
        const parsed = parseEventName(event.eventName)
        if (!parsed) return false
        this.state = {
          eventName: event.eventName,
          format: parsed.format,
          set: parsed.set
        }
        return true
      }

      case 'DraftPackUpdated': {
        const prev = this.state.draft
        const draft: DraftState =
          prev && prev.draftId === event.draftId
            ? prev
            : {
                draftId: event.draftId,
                pack: 0,
                pick: 0,
                packGrpIds: [],
                picks: [],
                pickedGrpIds: [],
                completed: false
              }
        this.state = {
          ...this.state,
          draft: {
            ...draft,
            pack: event.pack,
            pick: event.pick,
            packGrpIds: event.grpIds
          }
        }
        return true
      }

      case 'PickMade': {
        const draft = this.state.draft
        if (!draft || draft.draftId !== event.draftId) return false
        this.state = {
          ...this.state,
          draft: {
            ...draft,
            picks: [...draft.picks, { pack: event.pack, pick: event.pick, grpIds: event.grpIds }],
            pickedGrpIds: [...draft.pickedGrpIds, ...event.grpIds]
          }
        }
        return true
      }

      case 'DraftCompleted': {
        const draft = this.state.draft
        if (!draft) return false
        this.state = {
          ...this.state,
          draft: {
            ...draft,
            completed: true,
            pickedGrpIds:
              event.pickedGrpIds && event.pickedGrpIds.length > 0
                ? event.pickedGrpIds
                : draft.pickedGrpIds
          }
        }
        return true
      }

      case 'CoursesUpdated': {
        const limited = event.courses.flatMap((course) => {
          const parsed = parseEventName(course.internalEventName)
          return parsed ? [{ course, parsed }] : []
        })
        if (limited.length === 0) return false

        const active =
          limited.find((c) => c.course.internalEventName === this.state.eventName) ??
          bestCourse(limited)

        const isNewEvent = active.course.internalEventName !== this.state.eventName
        const pool =
          /Sealed/i.test(active.parsed.format) &&
          active.course.cardPool &&
          active.course.cardPool.length > 0
            ? active.course.cardPool
            : null

        if (!isNewEvent && sameIds(this.state.sealedPool?.grpIds, pool)) return false

        this.state = {
          ...(isNewEvent ? {} : this.state),
          eventName: active.course.internalEventName,
          format: active.parsed.format,
          set: active.parsed.set,
          ...(pool
            ? {
                sealedPool: {
                  eventName: active.course.internalEventName,
                  set: active.parsed.set,
                  grpIds: pool
                }
              }
            : {})
        }
        return true
      }
    }
  }
}
