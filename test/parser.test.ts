import { describe, expect, it } from 'vitest'
import { LogParser } from '../src/main/log/parser'
import { parseEventName } from '../src/main/log/events'

// Real line shapes captured from the user's Player.log (grpIds/uuids shortened where harmless)
const DRAFT_NOTIFY =
  '[UnityCrossThreadLogger]Draft.Notify {"draftId":"c8925cd2-e811-402d-b0f2-ee248397cb0f","SelfPick":2,"SelfPack":1,"PackCards":"104896,105143,105008,104941"}'
const MAKE_PICK =
  '[UnityCrossThreadLogger]==> EventPlayerDraftMakePick {"id":"e3a39b64-2a60-4e76-ba8d-95acbafde839","request":"{\\"DraftId\\":\\"c8925cd2-e811-402d-b0f2-ee248397cb0f\\",\\"GrpIds\\":[105140,104920],\\"Pack\\":1,\\"Pick\\":1}"}'
const EVENT_JOIN =
  '[UnityCrossThreadLogger]==> EventJoin {"id":"773b198e-7a75-445f-aebf-86bd12761f91","request":"{\\"EventName\\":\\"PickTwoDraft_MSH_20260623\\",\\"EntryCurrencyType\\":\\"Gold\\",\\"EntryCurrencyPaid\\":6000,\\"CustomTokenId\\":null,\\"EventChoice\\":\\"\\",\\"DebugIgnoreEntryLimits\\":false}"}'
const DRAFT_COMPLETE =
  '[UnityCrossThreadLogger]==> DraftCompleteDraft {"id":"0740c424-6c7e-4092-958a-0263c7db31b6","request":"{\\"EventName\\":\\"PickTwoDraft_MSH_20260623\\",\\"IsBotDraft\\":false}"}'
const COURSES_HEADER = '<== EventGetCoursesV2(c7ebac43-a895-4932-986b-62947337e966)'
const COURSES_PAYLOAD =
  '{"Courses":[{"CourseId":"e5b2eb97","InternalEventName":"Sealed_MSH_20260601","CurrentModule":"DeckBuild","CardPool":[105005,105084,105045]},{"CourseId":"aa","InternalEventName":"DualColorPrecons","CurrentModule":"CreateMatch"}]}'

describe('LogParser', () => {
  it('parses Draft.Notify pack updates', () => {
    const events = new LogParser().feedLine(DRAFT_NOTIFY)
    expect(events).toEqual([
      {
        type: 'DraftPackUpdated',
        draftId: 'c8925cd2-e811-402d-b0f2-ee248397cb0f',
        pack: 1,
        pick: 2,
        grpIds: [104896, 105143, 105008, 104941]
      }
    ])
  })

  it('parses EventPlayerDraftMakePick with multi-card GrpIds (pick-two)', () => {
    const events = new LogParser().feedLine(MAKE_PICK)
    expect(events).toEqual([
      {
        type: 'PickMade',
        draftId: 'c8925cd2-e811-402d-b0f2-ee248397cb0f',
        pack: 1,
        pick: 1,
        grpIds: [105140, 104920]
      }
    ])
  })

  it('parses EventJoin into EventJoined', () => {
    const events = new LogParser().feedLine(EVENT_JOIN)
    expect(events).toEqual([{ type: 'EventJoined', eventName: 'PickTwoDraft_MSH_20260623' }])
  })

  it('parses DraftCompleteDraft', () => {
    const events = new LogParser().feedLine(DRAFT_COMPLETE)
    expect(events).toEqual([{ type: 'DraftCompleted', eventName: 'PickTwoDraft_MSH_20260623' }])
  })

  it('parses a two-line courses response (header, then payload)', () => {
    const parser = new LogParser()
    expect(parser.feedLine(COURSES_HEADER)).toEqual([])
    const events = parser.feedLine(COURSES_PAYLOAD)
    expect(events).toEqual([
      {
        type: 'CoursesUpdated',
        courses: [
          {
            courseId: 'e5b2eb97',
            internalEventName: 'Sealed_MSH_20260601',
            currentModule: 'DeckBuild',
            cardPool: [105005, 105084, 105045]
          },
          {
            courseId: 'aa',
            internalEventName: 'DualColorPrecons',
            currentModule: 'CreateMatch',
            cardPool: undefined
          }
        ]
      }
    ])
  })

  it('recovers when a response header is not followed by a payload', () => {
    const parser = new LogParser()
    parser.feedLine(COURSES_HEADER)
    expect(parser.feedLine('PAPA:Update()')).toEqual([])
    // subsequent lines parse normally again
    expect(parser.feedLine(DRAFT_NOTIFY)).toHaveLength(1)
  })

  it('ignores unknown lines and malformed JSON without throwing', () => {
    const parser = new LogParser()
    expect(parser.feedLine('FrontDoorConnectionAWS:ProcessMessages()')).toEqual([])
    expect(parser.feedLine('[UnityCrossThreadLogger]Draft.Notify {not json')).toEqual([])
    expect(parser.feedLine('')).toEqual([])
  })
})

// Real quick-draft lines (Arena 2026-07, QuickDraft_MSH event)
const BOT_STATUS_HEADER = '<== BotDraftDraftStatus(012b17a8-9b86-473d-9c29-fbf4addc8801)'
const BOT_STATUS_PAYLOAD =
  '{"CurrentModule":"BotDraft","Payload":"{\\"Result\\":\\"Success\\",\\"EventName\\":\\"QuickDraft_MSH_20260702\\",\\"DraftStatus\\":\\"PickNext\\",\\"PackNumber\\":0,\\"PickNumber\\":0,\\"NumCardsToPick\\":1,\\"DraftPack\\":[\\"104987\\",\\"104911\\",\\"105076\\"],\\"PackStyles\\":[],\\"PickedCards\\":[],\\"PickedStyles\\":[]}"}'
const BOT_PICK_REQUEST =
  '[UnityCrossThreadLogger]==> BotDraftDraftPick {"id":"d52180dc-23d8-4d95-98aa-7f9e82629724","request":"{\\"EventName\\":\\"QuickDraft_MSH_20260702\\",\\"PickInfo\\":{\\"EventName\\":\\"QuickDraft_MSH_20260702\\",\\"CardIds\\":[\\"105118\\"],\\"PackNumber\\":0,\\"PickNumber\\":0}}"}'

describe('LogParser quick (bot) drafts', () => {
  it('parses BotDraftDraftStatus responses into 1-indexed pack updates', () => {
    const parser = new LogParser()
    expect(parser.feedLine(BOT_STATUS_HEADER)).toEqual([])
    expect(parser.feedLine(BOT_STATUS_PAYLOAD)).toEqual([
      {
        type: 'DraftPackUpdated',
        draftId: 'QuickDraft_MSH_20260702',
        pack: 1,
        pick: 1,
        grpIds: [104987, 104911, 105076]
      }
    ])
  })

  it('emits DraftCompleted from the final response (DraftStatus Completed, empty pack)', () => {
    const parser = new LogParser()
    expect(parser.feedLine('<== BotDraftDraftPick(9d41d02c-b2d0-429a-bd0e-4e62bff96768)')).toEqual([])
    const payload =
      '{"CurrentModule":"DeckSelect","Payload":"{\\"Result\\":\\"Success\\",\\"EventName\\":\\"QuickDraft_MSH_20260702\\",\\"DraftStatus\\":\\"Completed\\",\\"PackNumber\\":2,\\"PickNumber\\":13,\\"NumCardsToPick\\":1,\\"DraftPack\\":[],\\"PackStyles\\":[],\\"PickedCards\\":[\\"105138\\",\\"105118\\"]}"}'
    expect(parser.feedLine(payload)).toEqual([
      {
        type: 'DraftCompleted',
        eventName: 'QuickDraft_MSH_20260702',
        pickedGrpIds: [105138, 105118]
      }
    ])
  })

  it('parses BotDraftDraftPick requests into 1-indexed picks', () => {
    expect(new LogParser().feedLine(BOT_PICK_REQUEST)).toEqual([
      {
        type: 'PickMade',
        draftId: 'QuickDraft_MSH_20260702',
        pack: 1,
        pick: 1,
        grpIds: [105118]
      }
    ])
  })
})

describe('parseEventName', () => {
  it('parses limited event names', () => {
    expect(parseEventName('PickTwoDraft_MSH_20260623')).toEqual({ format: 'PickTwoDraft', set: 'MSH' })
    expect(parseEventName('QuickDraft_FIN_20250701')).toEqual({ format: 'QuickDraft', set: 'FIN' })
    expect(parseEventName('Sealed_MSH_20260601')).toEqual({ format: 'Sealed', set: 'MSH' })
    expect(parseEventName('TradSealed_EOE_1')).toEqual({ format: 'TradSealed', set: 'EOE' })
  })

  it('rejects non-limited events', () => {
    expect(parseEventName('DualColorPrecons')).toBeNull()
    expect(parseEventName('Constructed_Ranked')).toBeNull()
  })
})
