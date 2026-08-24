import type { CourseSummary, LogEvent } from './events'

const LOGGER_PREFIX = '[UnityCrossThreadLogger]'

export class LogParser {
  private pendingResponse: string | null = null

  feedLine(rawLine: string): LogEvent[] {
    const line = rawLine.trimEnd()
    if (line.length === 0) return []

    if (this.pendingResponse !== null) {
      const method = this.pendingResponse
      this.pendingResponse = null
      if (line.startsWith('{') || line.startsWith('[')) {
        return this.parseResponsePayload(method, line)
      }
    }

    const responseHeader = line.match(/^<== (\w+)\([0-9a-f-]+\)\s*$/)
    if (responseHeader) {
      this.pendingResponse = responseHeader[1]
      return []
    }

    if (!line.includes(LOGGER_PREFIX)) return []
    const body = line.slice(line.indexOf(LOGGER_PREFIX) + LOGGER_PREFIX.length)

    if (body.startsWith('Draft.Notify ')) {
      return this.parseDraftNotify(body.slice('Draft.Notify '.length))
    }

    const request = body.match(/^==> (\w+) (\{.*\})$/)
    if (request) {
      return this.parseRequest(request[1], request[2])
    }

    return []
  }

  private parseDraftNotify(json: string): LogEvent[] {
    const payload = safeJson(json)
    if (!payload || typeof payload.PackCards !== 'string' || !payload.draftId) return []
    const grpIds = parseGrpIdList(payload.PackCards)
    if (grpIds.length === 0) return []
    return [
      {
        type: 'DraftPackUpdated',
        draftId: String(payload.draftId),
        pack: Number(payload.SelfPack) || 0,
        pick: Number(payload.SelfPick) || 0,
        grpIds
      }
    ]
  }

  private parseRequest(method: string, outerJson: string): LogEvent[] {
    const outer = safeJson(outerJson)
    const req = typeof outer?.request === 'string' ? safeJson(outer.request) : outer
    if (!req) return []

    switch (method) {
      case 'EventJoin':
        return typeof req.EventName === 'string'
          ? [{ type: 'EventJoined', eventName: req.EventName }]
          : []
      case 'EventPlayerDraftMakePick': {
        const grpIds = Array.isArray(req.GrpIds) ? req.GrpIds.map(Number).filter(Number.isFinite) : []
        if (grpIds.length === 0 || !req.DraftId) return []
        return [
          {
            type: 'PickMade',
            draftId: String(req.DraftId),
            pack: Number(req.Pack) || 0,
            pick: Number(req.Pick) || 0,
            grpIds
          }
        ]
      }
      case 'DraftCompleteDraft':
        return [{ type: 'DraftCompleted', eventName: String(req.EventName ?? '') }]
      case 'BotDraftDraftPick': {
        const info = req.PickInfo as Record<string, any> | undefined
        const grpIds = Array.isArray(info?.CardIds)
          ? info.CardIds.map(Number).filter(Number.isFinite)
          : []
        if (grpIds.length === 0) return []
        return [
          {
            type: 'PickMade',
            draftId: String(req.EventName ?? 'bot-draft'),
            pack: (Number(info?.PackNumber) || 0) + 1,
            pick: (Number(info?.PickNumber) || 0) + 1,
            grpIds
          }
        ]
      }
      default:
        return []
    }
  }

  private parseResponsePayload(method: string, json: string): LogEvent[] {
    const payload = safeJson(json)
    if (!payload) return []

    if (method.startsWith('EventGetCourse') || method === 'EventJoin') {
      const rawCourses = Array.isArray(payload.Courses)
        ? payload.Courses
        : typeof payload.Course === 'object' && payload.Course !== null
          ? [payload.Course]
          : payload.CourseId
            ? [payload]
            : []
      const courses = rawCourses.map(toCourseSummary).filter((c: CourseSummary | null) => c !== null)
      return courses.length > 0 ? [{ type: 'CoursesUpdated', courses }] : []
    }

    if (method.startsWith('BotDraftDraft')) {
      const inner =
        typeof payload.Payload === 'string' ? safeJson(payload.Payload) : payload
      if (!inner) return []
      if (inner.DraftStatus === 'Completed') {
        const picked = Array.isArray(inner.PickedCards)
          ? inner.PickedCards.map(Number).filter(Number.isFinite)
          : []
        return [
          {
            type: 'DraftCompleted',
            eventName: String(inner.EventName ?? 'bot-draft'),
            ...(picked.length > 0 ? { pickedGrpIds: picked } : {})
          }
        ]
      }
      const packCards = Array.isArray(inner.DraftPack) ? inner.DraftPack : null
      if (!packCards) return []
      const grpIds = packCards.map(Number).filter(Number.isFinite)
      if (grpIds.length === 0) return []
      return [
        {
          type: 'DraftPackUpdated',
          draftId: String(inner.EventName ?? 'bot-draft'),
          pack: (Number(inner.PackNumber) || 0) + 1,
          pick: (Number(inner.PickNumber) || 0) + 1,
          grpIds
        }
      ]
    }

    return []
  }
}

function toCourseSummary(raw: unknown): CourseSummary | null {
  if (typeof raw !== 'object' || raw === null) return null
  const c = raw as Record<string, unknown>
  if (typeof c.CourseId !== 'string' || typeof c.InternalEventName !== 'string') return null
  let cardPool = Array.isArray(c.CardPool)
    ? c.CardPool.map(Number).filter(Number.isFinite)
    : undefined
  if ((!cardPool || cardPool.length === 0) && Array.isArray(c.CardPoolByCollation)) {
    const flattened = c.CardPoolByCollation.flatMap((entry) =>
      typeof entry === 'object' && entry !== null && Array.isArray((entry as Record<string, unknown>).CardPool)
        ? ((entry as Record<string, unknown>).CardPool as unknown[]).map(Number).filter(Number.isFinite)
        : []
    )
    if (flattened.length > 0) cardPool = flattened
  }
  return {
    courseId: c.CourseId,
    internalEventName: c.InternalEventName,
    currentModule: typeof c.CurrentModule === 'string' ? c.CurrentModule : undefined,
    cardPool
  }
}

function parseGrpIdList(csv: string): number[] {
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Number.isFinite)
}

function safeJson(text: string): Record<string, any> | null {
  try {
    const value = JSON.parse(text)
    return typeof value === 'object' && value !== null ? value : null
  } catch {
    return null
  }
}
