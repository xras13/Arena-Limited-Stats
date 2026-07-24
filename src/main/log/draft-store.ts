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

/** Reduces parser events into the current limited-event session state. */
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
            // Trust the log's final pool over tracked picks (rotation-safe)
            pickedGrpIds:
              event.pickedGrpIds && event.pickedGrpIds.length > 0
                ? event.pickedGrpIds
                : draft.pickedGrpIds
          }
        }
        return true
      }

      case 'CoursesUpdated': {
        let changed = false
        for (const course of event.courses) {
          const parsed = parseEventName(course.internalEventName)
          if (!parsed) continue
          // Recover the active event when EventJoin happened before this log started
          if (!this.state.eventName) {
            this.state = {
              ...this.state,
              eventName: course.internalEventName,
              format: parsed.format,
              set: parsed.set
            }
            changed = true
          }
          if (
            /Sealed/i.test(parsed.format) &&
            course.cardPool &&
            course.cardPool.length > 0
          ) {
            this.state = {
              ...this.state,
              sealedPool: {
                eventName: course.internalEventName,
                set: parsed.set,
                grpIds: course.cardPool
              }
            }
            changed = true
          }
        }
        return changed
      }
    }
  }
}
