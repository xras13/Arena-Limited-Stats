export interface CourseSummary {
  courseId: string
  internalEventName: string
  currentModule?: string
  cardPool?: number[]
}

export type LogEvent =
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
      pickedGrpIds?: number[]
    }
  | { type: 'CoursesUpdated'; courses: CourseSummary[] }

export interface ParsedEventName {
  format: string
  set: string
}

const SET_CODE = /^[A-Z][A-Z0-9]{2,5}$/

export function parseEventName(eventName: string): ParsedEventName | null {
  const parts = eventName.split('_')
  if (parts.length < 2) return null
  const formatIndex = parts.findIndex((part) => /Draft|Sealed/i.test(part))
  if (formatIndex === -1) return null
  const set = parts.find((part, i) => i !== formatIndex && SET_CODE.test(part))
  if (!set) return null
  return { format: parts[formatIndex], set }
}
