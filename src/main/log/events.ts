/** Typed events extracted from Arena's Player.log. */

export interface CourseSummary {
  courseId: string
  internalEventName: string
  currentModule?: string
  /** Arena grpIds granted to this event (sealed pools, drafted cards). */
  cardPool?: number[]
}

export type LogEvent =
  /** Log file was truncated/rotated — all session state derived from it is stale. */
  | { type: 'LogReset' }
  | { type: 'EventJoined'; eventName: string }
  | {
      type: 'DraftPackUpdated'
      draftId: string
      pack: number
      pick: number
      grpIds: number[]
    }
  | {
      type: 'PickMade'
      draftId: string
      pack: number
      pick: number
      grpIds: number[]
    }
  | {
      type: 'DraftCompleted'
      eventName: string
      /** Authoritative final pool when the log provides one (quick drafts). */
      pickedGrpIds?: number[]
    }
  | { type: 'CoursesUpdated'; courses: CourseSummary[] }

export interface ParsedEventName {
  format: string
  set: string
}

/**
 * Arena event names look like "PickTwoDraft_MSH_20260623" / "QuickDraft_FIN_..".
 * Returns null for non-limited events (e.g. "DualColorPrecons").
 */
export function parseEventName(eventName: string): ParsedEventName | null {
  const parts = eventName.split('_')
  if (parts.length < 2) return null
  const [format, set] = parts
  if (!/Draft|Sealed/i.test(format)) return null
  if (!/^[A-Z][A-Z0-9]{2,4}$/.test(set)) return null
  return { format, set }
}
