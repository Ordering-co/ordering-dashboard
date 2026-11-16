// redesign CA-B5 (decision 3, decision 7; M-CA2, M-CA9, M-CA12, M-CA13; auditor #3, #5, #6): the pure side of the create form:
// the draft read from the controller's state, what is still missing before «Send», and the overrides of the one POST.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  actionOf,
  buildOverrides,
  conditionsKey,
  fixedOperatorProblem,
  hasText,
  isDirty,
  minEndDay,
  minScheduleDay,
  missingForSend,
  ruleProblem,
  splitStamp,
  stampOf,
  timeSlots,
  toDraft
} from '../campaignDraft'

const READY = {
  name: 'Spring offer',
  channel: 'notification',
  audience: 'fixed',
  conditions: [{ type: 'orders_count', condition: '>', value: 3 }],
  title: 'Hello',
  body: 'World',
  when: 'asap',
  scheduledAt: null,
  scheduledTime: '00:00',
  enabled: true,
  endAt: null,
  endTime: '00:00',
  isConfigured: true
}
const draftOf = (patch = {}) => ({ ...READY, ...patch })

describe('toDraft · the draft read from the state of the controller', () => {
  const formState = (changes = {}) => ({ loading: false, changes: { enabled: true, conditions: [], status: 'pending', ...changes } })
  const contactState = (changes = {}) => ({ changes })

  it('starts empty, as the controller leaves it in add mode: ASAP, enabled, no rules', () => {
    expect(toDraft(formState(), contactState())).toEqual({
      name: '',
      channel: '',
      audience: '',
      conditions: [],
      title: '',
      body: '',
      when: 'asap',
      scheduledAt: null,
      scheduledTime: '09:00',
      enabled: true,
      endAt: null,
      endTime: '09:00',
      isConfigured: null
    })
  })

  it('reads the name, the channel, the audience and the message the controller holds', () => {
    const draft = toDraft(
      formState({ name: 'Spring', contact_type: 'sms', audience_type: 'dynamic', contact_data: { title: 'Hi', body: 'Text' } }),
      contactState({ contact_type: 'sms' })
    )
    expect(draft).toMatchObject({ name: 'Spring', channel: 'sms', audience: 'dynamic', title: 'Hi', body: 'Text' })
  })

  it('falls back to the contact state when the form state has not caught up (the message is mirrored in two places)', () => {
    const draft = toDraft(formState(), contactState({ contact_type: 'email', contact_data: { title: 'Subject', body: '<p>Hi</p>' } }))
    expect(draft).toMatchObject({ channel: 'email', title: 'Subject', body: '<p>Hi</p>' })
  })

  it('is «later» when the form holds a scheduled date, and keeps its day and time', () => {
    const draft = toDraft(formState({ scheduled_at: '2026-12-24 09:30:00' }), contactState())
    expect(draft).toMatchObject({ when: 'later', scheduledAt: '2026-12-24 09:30:00', scheduledTime: '09:30' })
  })

  it('takes the choice ASAP / later from the host, even with no date yet (M-CA12)', () => {
    expect(toDraft(formState(), contactState(), { when: 'later' })).toMatchObject({ when: 'later', scheduledAt: null })
    expect(toDraft(formState({ scheduled_at: '2026-12-24 09:30:00' }), contactState(), { when: 'asap' }).when).toBe('asap')
  })

  it('takes the time of day the host kept while there is no date yet', () => {
    expect(toDraft(formState(), contactState(), { scheduledTime: '13:30', endTime: '18:00' })).toMatchObject({ scheduledTime: '13:30', endTime: '18:00' })
  })

  it('keeps the rules the host holds (with the unfinished ones) over the ones of the controller', () => {
    const rows = [{ type: 'orders_count', condition: '>', value: null }]
    expect(toDraft(formState({ conditions: [] }), contactState(), { conditions: rows }).conditions).toEqual(rows)
  })

  it('tells whether the channel is set up only when the editor said so', () => {
    expect(toDraft(formState(), contactState(), { isConfigured: false }).isConfigured).toBe(false)
    expect(toDraft(formState(), contactState(), { isConfigured: true }).isConfigured).toBe(true)
    expect(toDraft(formState(), contactState()).isConfigured).toBeNull()
  })

  it('keeps the dynamic switch off when the form says so, and the end date', () => {
    const draft = toDraft(formState({ enabled: false, end_at: '2027-01-01 00:00:00' }), contactState())
    expect(draft).toMatchObject({ enabled: false, endAt: '2027-01-01 00:00:00' })
  })

  it('survives a controller that has not started (no state at all)', () => {
    expect(() => toDraft(undefined, undefined)).not.toThrow()
    expect(toDraft(undefined, undefined).conditions).toEqual([])
  })
})

describe('missingForSend · what stops the button (M-CA2, M-CA9)', () => {
  it('is empty for a draft that has everything', () => {
    expect(missingForSend(READY)).toEqual([])
  })

  it('asks for the name, the channel, the audience, the title, the body and a rule of an empty draft, in that order', () => {
    expect(missingForSend(draftOf({ name: '', channel: '', audience: '', title: '', body: '', conditions: [] }))).toEqual(['name', 'channel', 'audience', 'title', 'body', 'rules'])
  })

  it('M-CA2: a draft with only a name sends nothing', () => {
    expect(missingForSend(draftOf({ name: 'Only a name', channel: '', audience: '', title: '', body: '' }))).not.toEqual([])
  })

  it.each([
    ['channel', { channel: '' }],
    ['audience', { audience: '' }],
    ['title', { title: '' }],
    ['body', { body: '' }]
  ])('names «%s» when it is missing', (reason, patch) => {
    expect(missingForSend(draftOf(patch))).toEqual([reason])
  })

  it('treats a title or a body of only spaces as missing', () => {
    expect(missingForSend(draftOf({ title: '   ' }))).toEqual(['title'])
    expect(missingForSend(draftOf({ body: ' \n ' }))).toEqual(['body'])
  })

  it('treats the empty paragraph of the email editor as no body, and an image alone as a body', () => {
    expect(missingForSend(draftOf({ channel: 'email', body: '<p><br></p>' }))).toEqual(['body'])
    expect(missingForSend(draftOf({ channel: 'email', body: '<p>&nbsp;</p>' }))).toEqual(['body'])
    expect(missingForSend(draftOf({ channel: 'email', body: '<p><img src="a.png"></p>' }))).toEqual([])
  })

  it('asks to set the channel up only when its editor said it is not (false), never while unknown', () => {
    expect(missingForSend(draftOf({ isConfigured: false }))).toEqual(['setup'])
    expect(missingForSend(draftOf({ isConfigured: null }))).toEqual([])
    expect(missingForSend(draftOf({ isConfigured: undefined }))).toEqual([])
  })

  it('does not ask to set up a channel nobody chose: the channel is the reason', () => {
    expect(missingForSend(draftOf({ channel: '', isConfigured: false }))).toEqual(['channel'])
  })

  it('requires the name: the API refuses a campaign without one', () => {
    expect(missingForSend(draftOf({ name: '' }))).toEqual(['name'])
    expect(missingForSend(draftOf({ name: '   ' }))).toEqual(['name'])
  })

  it('requires a rule: the API refuses a campaign without one', () => {
    expect(missingForSend(draftOf({ conditions: [] }))).toEqual(['rules'])
    expect(missingForSend(draftOf({ audience: 'dynamic', endAt: '2026-12-24 09:00:00', conditions: [] }))).toEqual(['rules'])
  })

  it('requires the end date of a dynamic campaign, and not of a fixed one', () => {
    expect(missingForSend(draftOf({ audience: 'dynamic', endAt: null }))).toEqual(['end_date'])
    expect(missingForSend(draftOf({ audience: 'dynamic', endAt: '2026-12-24 09:00:00' }))).toEqual([])
    expect(missingForSend(draftOf({ audience: 'fixed', endAt: null }))).toEqual([])
  })

  it('asks for the date of a scheduled fixed campaign', () => {
    expect(missingForSend(draftOf({ when: 'later', scheduledAt: null }))).toEqual(['schedule_date'])
    expect(missingForSend(draftOf({ when: 'later', scheduledAt: '2026-12-24 00:00:00' }))).toEqual([])
  })

  it('does not ask for a date of ASAP, nor of a dynamic campaign', () => {
    expect(missingForSend(draftOf({ when: 'asap', scheduledAt: null }))).toEqual([])
    expect(missingForSend(draftOf({ audience: 'dynamic', when: 'later', scheduledAt: null, endAt: '2026-12-24 09:00:00' }))).toEqual([])
  })

  it('asks to finish a rule that has no number', () => {
    expect(missingForSend(draftOf({ conditions: [{ type: 'orders_count', condition: '>', value: null }] }))).toEqual(['rule_incomplete'])
  })

  it('asks to finish a rule that has no operator, no date or half a range', () => {
    expect(missingForSend(draftOf({ conditions: [{ type: 'orders_count', value: 3 }] }))).toEqual(['rule_incomplete'])
    expect(missingForSend(draftOf({ conditions: [{ type: 'user_created_at', date_condition: '<', date: null, max_date: null }] }))).toEqual(['rule_incomplete'])
    expect(missingForSend(draftOf({ conditions: [{ type: 'user_created_at', date_condition: '><', date: '2026-01-01 00:00:00', max_date: null }] }))).toEqual(['rule_incomplete'])
  })

  it('asks to finish a range whose two days are the same day (MAX_DATE_AFTER_DATE)', () => {
    const same = { type: 'user_last_order_at', date_condition: '><', date: '2026-01-01 00:00:00', max_date: '2026-01-01 00:00:00' }
    expect(missingForSend(draftOf({ conditions: [same] }))).toEqual(['rule_incomplete'])
  })

  it('keeps today\'s fixed checks: a date rule that is «=» or «>» and a count rule that is «=» (the options are not offered; the checks stay)', () => {
    expect(missingForSend(draftOf({ conditions: [{ type: 'user_created_at', date_condition: '=', date: '2026-01-01 00:00:00' }] }))).toEqual(['rule_fixed_operator'])
    expect(missingForSend(draftOf({ conditions: [{ type: 'user_created_at', date_condition: '>', date: '2026-01-01 00:00:00' }] }))).toEqual(['rule_fixed_operator'])
    expect(missingForSend(draftOf({ conditions: [{ type: 'orders_count', condition: '=', value: 2 }] }))).toEqual(['rule_fixed_operator'])
  })

  it('lists every reason, in the order of the form', () => {
    const everything = draftOf({
      channel: 'sms',
      isConfigured: false,
      audience: 'fixed',
      title: '',
      body: '',
      when: 'later',
      scheduledAt: null,
      conditions: [{ type: 'orders_count', condition: '>', value: null }, { type: 'user_created_at', date_condition: '=', date: '2026-01-01 00:00:00' }]
    })
    expect(missingForSend(everything)).toEqual(['setup', 'title', 'body', 'schedule_date', 'rule_incomplete', 'rule_fixed_operator'])
  })
})

describe('ruleProblem · why a rule is not finished', () => {
  it.each([
    [{ type: 'orders_count', condition: '>', value: 0 }, null],
    [{ type: 'orders_count', condition: '>', value: 7 }, null],
    [{ type: 'orders_count', condition: '<', value: 1 }, null],
    [{ type: 'orders_count', condition: '>', value: null }, 'number'],
    [{ type: 'orders_count', condition: '>', value: '' }, 'number'],
    [{ type: 'orders_count', condition: '>', value: NaN }, 'number'],
    [{ type: 'orders_count', condition: '<', value: 0 }, 'number'],
    [{ type: 'orders_count', condition: '>', value: -1 }, 'number'],
    [{ type: 'orders_count', value: 3 }, 'operator'],
    [{ type: 'user_created_at', date_condition: '<', date: '2026-01-01 00:00:00', max_date: null }, null],
    [{ type: 'user_created_at', date_condition: '<', date: null, max_date: null }, 'date'],
    [{ type: 'user_created_at', date_condition: '><', date: '2026-01-01 00:00:00', max_date: '2026-02-01 00:00:00' }, null],
    [{ type: 'user_created_at', date_condition: '><', date: null, max_date: null }, 'range'],
    [{ type: 'user_created_at', date_condition: '><', date: '2026-01-01 00:00:00', max_date: null }, 'range'],
    [{ type: 'user_created_at', date_condition: '><', date: '2026-01-01 00:00:00', max_date: '2026-01-01 00:00:00' }, 'same_day'],
    [{ type: 'user_created_at', date_condition: '><', date: '2026-02-01 00:00:00', max_date: '2026-01-01 00:00:00' }, 'range'],
    [{ type: 'user_created_at', date: '2026-01-01 00:00:00' }, 'operator']
  ])('%j → %s', (condition, problem) => {
    expect(ruleProblem(condition)).toBe(problem)
  })

  it('calls a type it does not know «unknown» (it cannot be edited here, so it cannot be finished here)', () => {
    expect(ruleProblem({ type: 'something_else' })).toBe('unknown')
  })
})

describe('fixedOperatorProblem · the two checks of main', () => {
  it.each([
    [{ type: 'user_created_at', date_condition: '=' }, 'date'],
    [{ type: 'user_created_at', date_condition: '>' }, 'date'],
    [{ type: 'user_created_at', date_condition: '<' }, null],
    [{ type: 'user_created_at', date_condition: '><' }, null],
    [{ type: 'orders_count', condition: '=' }, 'count'],
    [{ type: 'orders_count', condition: '>' }, null],
    [{ type: 'orders_count', condition: '<' }, null]
  ])('%j → %s', (condition, problem) => {
    expect(fixedOperatorProblem(condition)).toBe(problem)
  })
})

describe('buildOverrides · the one POST sends only the fields of the chosen audience (M-CA13)', () => {
  it('fixed + ASAP: no end date, no scheduled date, pending, enabled', () => {
    const overrides = buildOverrides(draftOf({ audience: 'fixed', when: 'asap', scheduledAt: '2026-12-24 00:00:00', endAt: '2027-01-01 00:00:00' }))
    expect(overrides).toEqual({ end_at: undefined, enabled: true, scheduled_at: undefined, status: 'pending' })
    expect(Object.keys(overrides)).toEqual(expect.arrayContaining(['end_at', 'scheduled_at']))
  })

  it('fixed + later: the scheduled date and the «scheduled» status, no end date', () => {
    expect(buildOverrides(draftOf({ audience: 'fixed', when: 'later', scheduledAt: '2026-12-24 09:30:00', endAt: '2027-01-01 00:00:00' }))).toEqual({
      end_at: undefined,
      enabled: true,
      scheduled_at: '2026-12-24 09:30:00',
      status: 'scheduled'
    })
  })

  it('fixed is always enabled, whatever the dynamic switch said before', () => {
    expect(buildOverrides(draftOf({ audience: 'fixed', enabled: false })).enabled).toBe(true)
  })

  it('dynamic: no scheduled date, pending, and the end date only when there is one', () => {
    expect(buildOverrides(draftOf({ audience: 'dynamic', scheduledAt: '2026-12-24 00:00:00', when: 'later' }))).toEqual({
      scheduled_at: undefined,
      status: 'pending',
      end_at: undefined,
      enabled: true
    })
    expect(buildOverrides(draftOf({ audience: 'dynamic', endAt: '2027-01-01 18:00:00' }))).toEqual({
      scheduled_at: undefined,
      status: 'pending',
      end_at: '2027-01-01 18:00:00',
      enabled: true
    })
  })

  it('dynamic keeps the switch the user chose, off included (auditor #6)', () => {
    expect(buildOverrides(draftOf({ audience: 'dynamic', enabled: false })).enabled).toBe(false)
    expect(buildOverrides(draftOf({ audience: 'dynamic', enabled: true })).enabled).toBe(true)
  })

  it('writes an undefined key (not a missing one), so the controller drops the stale value from the body', () => {
    const overrides = buildOverrides(draftOf({ audience: 'dynamic' }))
    expect('scheduled_at' in overrides).toBe(true)
    expect(overrides.scheduled_at).toBeUndefined()
    expect('end_at' in overrides).toBe(true)
  })
})

describe('actionOf · what the one button does', () => {
  it.each([
    [{ audience: 'fixed', when: 'asap' }, 'send'],
    [{ audience: 'fixed', when: 'later' }, 'schedule'],
    [{ audience: 'dynamic', when: 'asap' }, 'create'],
    [{ audience: 'dynamic', when: 'later' }, 'create'],
    [{ audience: '', when: 'asap' }, 'create']
  ])('%j → %s', (patch, action) => {
    expect(actionOf(draftOf(patch))).toBe(action)
  })
})

describe('isDirty · as soon as any field has a value', () => {
  it('is false for the empty draft and for a choice alone', () => {
    expect(isDirty(draftOf({ name: '', title: '', body: '', conditions: [], scheduledAt: null, endAt: null }))).toBe(false)
  })

  it.each([
    ['name', { name: 'a' }],
    ['title', { title: 'a' }],
    ['body', { body: 'a' }],
    ['a rule', { conditions: [{ type: 'orders_count', condition: '>', value: null }] }],
    ['a scheduled date', { scheduledAt: '2026-12-24 00:00:00' }],
    ['an end date', { endAt: '2027-01-01 00:00:00' }]
  ])('is true with %s', (_label, patch) => {
    expect(isDirty(draftOf({ name: '', title: '', body: '', conditions: [], scheduledAt: null, endAt: null, ...patch }))).toBe(true)
  })

  it('does not count the empty paragraph of the email editor as typing', () => {
    expect(isDirty(draftOf({ name: '', title: '', body: '<p><br></p>', conditions: [], scheduledAt: null, endAt: null }))).toBe(false)
  })

  it('does not count spaces as typing', () => {
    expect(isDirty(draftOf({ name: '  ', title: '', body: '', conditions: [], scheduledAt: null, endAt: null }))).toBe(false)
  })
})

describe('hasText', () => {
  it.each([
    ['', false],
    [null, false],
    [undefined, false],
    ['   ', false],
    ['<p><br></p>', false],
    ['<p>&nbsp;</p>', false],
    ['<div> </div>', false],
    ['Hello', true],
    ['<p>Hello</p>', true],
    ['<p><img src="a.png"></p>', true],
    [0, true]
  ])('%j → %s', (value, expected) => {
    expect(hasText(value)).toBe(expected)
  })
})

describe('conditionsKey · the identity of a list of rules', () => {
  it('ignores the order of the keys and the keys that are null (the controller deletes them in place before it counts)', () => {
    const a = [{ type: 'user_created_at', date_condition: '<', date: '2026-01-01 00:00:00', max_date: null }]
    const b = [{ date: '2026-01-01 00:00:00', date_condition: '<', type: 'user_created_at' }]
    expect(conditionsKey(a)).toBe(conditionsKey(b))
  })

  it('tells two different lists apart', () => {
    expect(conditionsKey([{ type: 'orders_count', condition: '>', value: 1 }])).not.toBe(conditionsKey([{ type: 'orders_count', condition: '>', value: 2 }]))
    expect(conditionsKey([])).not.toBe(conditionsKey([{ type: 'orders_count', condition: '>', value: 1 }]))
  })

  it('treats anything that is not a list as an empty one', () => {
    expect(conditionsKey(undefined)).toBe(conditionsKey([]))
    expect(conditionsKey(null)).toBe(conditionsKey([]))
  })
})

describe('time and date helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 9, 15, 45, 0)) // 9 October 2026, local
  })
  afterEach(() => vi.useRealTimers())

  it('offers the day in 30-minute steps, 48 slots from 00:00 to 23:30', () => {
    const slots = timeSlots()
    expect(slots).toHaveLength(48)
    expect(slots[0]).toBe('00:00')
    expect(slots[1]).toBe('00:30')
    expect(slots[47]).toBe('23:30')
  })

  it('writes a stamp as the API takes it, and reads it back', () => {
    expect(stampOf('2026-12-24', '09:30')).toBe('2026-12-24 09:30:00')
    expect(splitStamp('2026-12-24 09:30:00')).toEqual({ day: '2026-12-24', time: '09:30' })
    expect(splitStamp(null)).toEqual({ day: null, time: null })
    expect(splitStamp('')).toEqual({ day: null, time: null })
  })

  it('a stamp read back with a time that is not on the grid keeps it as it is', () => {
    expect(splitStamp('2026-12-24 09:17:00').time).toBe('09:17')
  })

  it('the first day to schedule is tomorrow (today\'s getMinDate), the first end day is today', () => {
    expect(minScheduleDay()).toBe('2026-10-10')
    expect(minEndDay()).toBe('2026-10-09')
  })
})
