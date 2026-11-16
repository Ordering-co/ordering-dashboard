// redesign CA-B3 (decisions 1 and 2; M-CA6, M-CA7): the pure side of the campaigns directory. No React, no context.
import { describe, expect, it } from 'vitest'

import { STATUS_FAMILIES } from '../../../Shared/Product/Status'
import {
  CREATABLE_CHANNELS,
  RULE_TYPES,
  asConditions,
  asContactData,
  audienceLabel,
  campaignStatus,
  channelLabel,
  filterOptions,
  formatCount,
  formatWhen,
  hasOrderStats,
  ruleSummary,
  scheduledAt
} from '../campaignData'

// What the page's `t` does with no catalog: the default text
const t = (key, text) => text
// A catalog that says the KEY: it proves each value has its own literal key (no key built from the data)
const keyed = (key) => `<${key}>`

describe('CREATABLE_CHANNELS · the three that main lets you create', () => {
  it('are email, sms and notification, in that order', () => {
    expect(CREATABLE_CHANNELS).toEqual(['email', 'sms', 'notification'])
  })
})

describe('channelLabel · never the raw value (M-CA6)', () => {
  it.each([
    ['email', 'Email', 'EMAIL'],
    ['sms', 'SMS', 'SMS'],
    ['notification', 'Push notification', 'PUSH_NOTIFICATION'],
    ['whatsapp', 'WhatsApp', 'CAMPAIGNS_CHANNEL_WHATSAPP'],
    ['webhook', 'Webhook', 'WEBHOOK'],
    ['popup', 'Popup', 'POPUP']
  ])('%s -> «%s», through its own key %s', (type, label, key) => {
    expect(channelLabel(t, type)).toBe(label)
    expect(channelLabel(keyed, type)).toBe(`<${key}>`)
  })

  it.each([['carrier-pigeon'], [''], [null], [undefined], [7]])('%j -> «Other», through CAMPAIGNS_CHANNEL_UNKNOWN', (type) => {
    expect(channelLabel(t, type)).toBe('Other')
    expect(channelLabel(keyed, type)).toBe('<CAMPAIGNS_CHANNEL_UNKNOWN>')
  })
})

describe('audienceLabel · never the raw value (M-CA6)', () => {
  it('fixed -> «Fixed» (FIXED) and dynamic -> «Dynamic» (DYNAMIC)', () => {
    expect(audienceLabel(t, 'fixed')).toBe('Fixed')
    expect(audienceLabel(t, 'dynamic')).toBe('Dynamic')
    expect(audienceLabel(keyed, 'fixed')).toBe('<FIXED>')
    expect(audienceLabel(keyed, 'dynamic')).toBe('<DYNAMIC>')
  })

  it.each([[null], [undefined], [''], ['everyone']])('%j -> «—», never the raw text', (type) => {
    expect(audienceLabel(t, type)).toBe('—')
  })
})

describe('campaignStatus · family, label and toggle (M-CA6)', () => {
  const dynamic = (extra) => ({ audience_type: 'dynamic', status: 'pending', enabled: true, ...extra })
  const fixed = (extra) => ({ audience_type: 'fixed', ...extra })

  it('an ended campaign is «Ended», family done, no toggle (fixed or dynamic, enabled or not)', () => {
    expect(campaignStatus(fixed({ status: 'ended' }), t)).toEqual({ family: 'done', label: 'Ended', toggle: false })
    expect(campaignStatus(dynamic({ status: 'ended', enabled: true }), t)).toEqual({ family: 'done', label: 'Ended', toggle: false })
    expect(campaignStatus(dynamic({ status: 'ended', enabled: false }), t)).toEqual({ family: 'done', label: 'Ended', toggle: false })
  })

  it('a dynamic that is not ended draws the toggle: enabled is «Active» (progress), disabled is «Paused» (pending)', () => {
    expect(campaignStatus(dynamic({ enabled: true }), t)).toEqual({ family: 'progress', label: 'Active', toggle: true })
    expect(campaignStatus(dynamic({ enabled: false }), t)).toEqual({ family: 'pending', label: 'Paused', toggle: true })
  })

  it('the toggle follows `enabled`, not `status` (a dynamic with another raw status)', () => {
    expect(campaignStatus(dynamic({ status: 'scheduled', enabled: true }), t).label).toBe('Active')
    expect(campaignStatus(dynamic({ status: 'whatever', enabled: false }), t).label).toBe('Paused')
  })

  it.each([[0], [null], [undefined], ['0'], ['false']])('a dynamic with enabled %j is «Paused»', (enabled) => {
    expect(campaignStatus(dynamic({ enabled }), t)).toEqual({ family: 'pending', label: 'Paused', toggle: true })
  })

  it.each([[1], ['1'], [true]])('a dynamic with enabled %j is «Active»', (enabled) => {
    expect(campaignStatus(dynamic({ enabled }), t)).toEqual({ family: 'progress', label: 'Active', toggle: true })
  })

  it('a fixed campaign is «Scheduled», «Pending» or «Draft» (all family pending), never a toggle', () => {
    expect(campaignStatus(fixed({ status: 'scheduled' }), t)).toEqual({ family: 'pending', label: 'Scheduled', toggle: false })
    expect(campaignStatus(fixed({ status: 'pending' }), t)).toEqual({ family: 'pending', label: 'Pending', toggle: false })
    expect(campaignStatus(fixed({ status: 'draft' }), t)).toEqual({ family: 'pending', label: 'Draft', toggle: false })
  })

  it('a campaign with no audience reads its status the same way', () => {
    expect(campaignStatus({ status: 'pending' }, t).label).toBe('Pending')
    expect(campaignStatus({ status: 'draft' }, t).label).toBe('Draft')
  })

  it.each([['sent'], ['cancelled'], [''], [undefined], [4]])('a fixed status %j is «Unknown», never the raw value', (status) => {
    expect(campaignStatus(fixed({ status }), t)).toEqual({ family: 'pending', label: 'Unknown', toggle: false })
  })

  it.each([[null], [undefined], [{}], ['pending'], [42]])('%j is «Unknown» in family pending', (campaign) => {
    expect(campaignStatus(campaign, t)).toEqual({ family: 'pending', label: 'Unknown', toggle: false })
  })

  it('every label has its own literal key', () => {
    expect(campaignStatus(fixed({ status: 'ended' }), keyed).label).toBe('<CAMPAIGNS_STATUS_ENDED>')
    expect(campaignStatus(dynamic({ enabled: true }), keyed).label).toBe('<ACTIVE>')
    expect(campaignStatus(dynamic({ enabled: false }), keyed).label).toBe('<CAMPAIGNS_STATUS_PAUSED>')
    expect(campaignStatus(fixed({ status: 'scheduled' }), keyed).label).toBe('<CAMPAIGNS_STATUS_SCHEDULED>')
    expect(campaignStatus(fixed({ status: 'pending' }), keyed).label).toBe('<PENDING>')
    expect(campaignStatus(fixed({ status: 'draft' }), keyed).label).toBe('<DRAFT>')
    expect(campaignStatus(null, keyed).label).toBe('<CAMPAIGNS_STATUS_UNKNOWN>')
  })

  it('the family is always one of STATUS_FAMILIES (P/Status throws on any other)', () => {
    const campaigns = [
      null, {}, fixed({ status: 'ended' }), fixed({ status: 'scheduled' }), fixed({ status: 'pending' }), fixed({ status: 'draft' }),
      fixed({ status: 'x' }), dynamic({ enabled: true }), dynamic({ enabled: false }), dynamic({ status: 'ended' })
    ]
    campaigns.forEach(campaign => expect(STATUS_FAMILIES).toContain(campaignStatus(campaign, t).family))
  })
})

describe('scheduledAt and formatWhen · local wall time, never ISO (M-CA7)', () => {
  it('scheduledAt gives the scheduled_at string, or null', () => {
    expect(scheduledAt({ scheduled_at: '2026-10-09 13:40:00' })).toBe('2026-10-09 13:40:00')
    expect(scheduledAt({ scheduled_at: null })).toBeNull()
    expect(scheduledAt({ scheduled_at: '' })).toBeNull()
    expect(scheduledAt({})).toBeNull()
    expect(scheduledAt(null)).toBeNull()
    expect(scheduledAt({ scheduled_at: 12 })).toBeNull()
  })

  it('formatWhen asks parseDate for the project format WITHOUT shifting the zone (utc: false)', () => {
    const parseDate = (value, options) => `parsed(${value}|${JSON.stringify(options)})`
    expect(formatWhen('2026-10-09 13:40:00', parseDate)).toBe('parsed(2026-10-09 13:40:00|{"utc":false})')
  })

  it.each([[null], [undefined], ['']])('formatWhen of %j is null and never calls parseDate', (value) => {
    const parseDate = () => { throw new Error('must not be called') }
    expect(formatWhen(value, parseDate)).toBeNull()
  })

  it('formatWhen without a parseDate is null, not an ISO string', () => {
    expect(formatWhen('2026-10-09 13:40:00', undefined)).toBeNull()
  })
})

// redesign CA-R1 (live check): a count reads as a number in the person's language
describe('formatCount · counts in the number format of the language', () => {
  it('English groups thousands with a comma: 1240 -> «1,240»', () => {
    expect(formatCount(1240, 'en')).toBe('1,240')
  })

  it('Spanish follows its own grouping rule: 1240 -> «1240», 12400 -> «12.400»', () => {
    expect(formatCount(1240, 'es')).toBe('1240')
    expect(formatCount(12400, 'es')).toBe('12.400')
  })

  it('keeps small numbers and zero as they are', () => {
    expect(formatCount(0, 'en')).toBe('0')
    expect(formatCount(7, 'es')).toBe('7')
    expect(formatCount(999, 'en')).toBe('999')
  })

  it('accepts the number as the API may send it (a numeric string) and drops decimals', () => {
    expect(formatCount('1240', 'en')).toBe('1,240')
    expect(formatCount(1240.6, 'en')).toBe('1,241')
  })

  it('null and undefined are null, so the caller keeps its N/A and «no count» paths', () => {
    expect(formatCount(null, 'en')).toBeNull()
    expect(formatCount(undefined, 'en')).toBeNull()
  })

  it('a value that is not a number reads 0', () => {
    expect(formatCount('soon', 'en')).toBe('0')
  })

  it('without a language, or with one the runtime does not know, still writes the number', () => {
    expect(formatCount(1240, undefined)).toMatch(/^1\D?240$/)
    expect(formatCount(1240, 'not_a_locale!')).toMatch(/^1\D?240$/)
  })
})

describe('asConditions and asContactData · the API sends JSON strings too (auditor #16)', () => {
  it('asConditions accepts an array, a JSON string of an array, and nothing else', () => {
    const rules = [{ type: 'orders_count', condition: '>', value: 2 }]
    expect(asConditions(rules)).toEqual(rules)
    expect(asConditions(JSON.stringify(rules))).toEqual(rules)
    expect(asConditions('[]')).toEqual([])
    ;[null, undefined, '', 'not json', '{"a":1}', {}, 7, true].forEach(value => expect(asConditions(value)).toEqual([]))
  })

  it('asContactData accepts an object, a JSON string of an object, and nothing else', () => {
    const data = { title: 'Hello', message: 'World' }
    expect(asContactData(data)).toEqual(data)
    expect(asContactData(JSON.stringify(data))).toEqual(data)
    ;[null, undefined, '', 'not json', '[1,2]', [1, 2], 7, true, '5', 'null'].forEach(value => expect(asContactData(value)).toEqual({}))
  })
})

describe('RULE_TYPES', () => {
  it('lists the four rules in order, each with its kind', () => {
    expect(RULE_TYPES.map(rule => [rule.type, rule.kind])).toEqual([
      ['orders_count', 'count'],
      ['user_created_at', 'date'],
      ['user_last_order_at', 'date'],
      ['user_last_open_cart_at', 'date']
    ])
  })

  it('labels them «Orders», «Sign-up date», «Last order date» and «Open carts», each with its own key', () => {
    expect(RULE_TYPES.map(rule => rule.label(t))).toEqual(['Orders', 'Sign-up date', 'Last order date', 'Open carts'])
    expect(RULE_TYPES.map(rule => rule.label(keyed))).toEqual([
      '<CAMPAIGNS_RULE_ORDERS>', '<CAMPAIGNS_RULE_SIGN_UP>', '<CAMPAIGNS_RULE_LAST_ORDER>', '<OPEN_CARTS>'
    ])
  })
})

describe('ruleSummary · one line per rule (the label and the text, the caller wraps the figures)', () => {
  // the caller's formatter: the project format of a stored `YYYY-MM-DD HH:mm:ss`
  const MONTHS = { '2026-08-01': '01 Aug 2026', '2026-06-01': '01 Jun 2026', '2026-06-30': '30 Jun 2026' }
  const formatDate = (value) => MONTHS[String(value).slice(0, 10)] ?? 'invalid'
  const line = (condition, translate = t) => {
    const { label, text } = ruleSummary(translate, condition, formatDate)
    return `${label}: ${text}`
  }

  it('Orders: more than 2', () => {
    expect(line({ type: 'orders_count', condition: '>', value: 2 })).toBe('Orders: more than 2')
  })

  it('Orders: less than 5', () => {
    expect(line({ type: 'orders_count', condition: '<', value: 5 })).toBe('Orders: less than 5')
  })

  it('keeps a zero (more than 0 is a real rule)', () => {
    expect(line({ type: 'orders_count', condition: '>', value: 0 })).toBe('Orders: more than 0')
  })

  it('accepts the value as the API may send it (a numeric string)', () => {
    expect(line({ type: 'orders_count', condition: '>', value: '3' })).toBe('Orders: more than 3')
  })

  it('Sign-up date: before 01 Aug 2026', () => {
    expect(line({ type: 'user_created_at', date_condition: '<', date: '2026-08-01 00:00:00' })).toBe('Sign-up date: before 01 Aug 2026')
  })

  it('Last order date: between 01 Jun 2026 and 30 Jun 2026', () => {
    expect(line({ type: 'user_last_order_at', date_condition: '><', date: '2026-06-01 00:00:00', max_date: '2026-06-30 00:00:00' }))
      .toBe('Last order date: between 01 Jun 2026 and 30 Jun 2026')
  })

  it('Open carts: before 01 Aug 2026', () => {
    expect(line({ type: 'user_last_open_cart_at', date_condition: '<', date: '2026-08-01 00:00:00' })).toBe('Open carts: before 01 Aug 2026')
  })

  it('returns the figures it wrote in `values`, so the caller can put them in odc-figure', () => {
    expect(ruleSummary(t, { type: 'orders_count', condition: '>', value: 2 }, formatDate).values).toEqual(['2'])
    expect(ruleSummary(t, { type: 'user_created_at', date_condition: '<', date: '2026-08-01 00:00:00' }, formatDate).values).toEqual(['01 Aug 2026'])
    expect(ruleSummary(t, { type: 'user_last_order_at', date_condition: '><', date: '2026-06-01 00:00:00', max_date: '2026-06-30 00:00:00' }, formatDate).values)
      .toEqual(['01 Jun 2026', '30 Jun 2026'])
  })

  it('writes the phrase through interpolation keys with their placeholders', () => {
    const seen = {}
    const spy = (key, text) => { seen[key] = text; return text }
    ruleSummary(spy, { type: 'orders_count', condition: '>', value: 2 }, formatDate)
    ruleSummary(spy, { type: 'orders_count', condition: '<', value: 2 }, formatDate)
    ruleSummary(spy, { type: 'user_created_at', date_condition: '<', date: '2026-08-01 00:00:00' }, formatDate)
    ruleSummary(spy, { type: 'user_created_at', date_condition: '><', date: '2026-06-01 00:00:00', max_date: '2026-06-30 00:00:00' }, formatDate)
    expect(seen).toMatchObject({
      CAMPAIGNS_RULE_MORE_THAN: 'more than _value_',
      CAMPAIGNS_RULE_LESS_THAN: 'less than _value_',
      CAMPAIGNS_RULE_BEFORE: 'before _value_',
      CAMPAIGNS_RULE_BETWEEN: 'between _from_ and _to_'
    })
  })

  it('a translated phrase is filled in the same way', () => {
    const es = (key, text) => ({ CAMPAIGNS_RULE_MORE_THAN: 'más de _value_', CAMPAIGNS_RULE_ORDERS: 'Pedidos' }[key] ?? text)
    expect(line({ type: 'orders_count', condition: '>', value: 2 }, es)).toBe('Pedidos: más de 2')
  })

  it.each([
    ['an unknown operator on a count rule', { type: 'orders_count', condition: '=', value: 2 }, 'Orders'],
    ['a missing operator on a count rule', { type: 'orders_count', value: 2 }, 'Orders'],
    ['a missing value on a count rule', { type: 'orders_count', condition: '>' }, 'Orders'],
    ['a date operator on a count rule', { type: 'orders_count', date_condition: '<', date: '2026-08-01 00:00:00' }, 'Orders'],
    ['an unknown date operator', { type: 'user_created_at', date_condition: '>', date: '2026-08-01 00:00:00' }, 'Sign-up date'],
    ['a count operator on a date rule', { type: 'user_last_order_at', condition: '>', value: 2 }, 'Last order date'],
    ['a missing date', { type: 'user_last_open_cart_at', date_condition: '<' }, 'Open carts'],
    ['a range without its end', { type: 'user_created_at', date_condition: '><', date: '2026-06-01 00:00:00' }, 'Sign-up date']
  ])('%s -> the label and «—»', (_, condition, label) => {
    expect(ruleSummary(t, condition, formatDate)).toMatchObject({ label, text: '—', values: [] })
  })

  it('an unknown rule type is «Rule: —», never the raw type', () => {
    const summary = ruleSummary(t, { type: 'user_birthday', condition: '>', value: 1 }, formatDate)
    expect(summary).toMatchObject({ label: 'Rule', text: '—' })
    expect(JSON.stringify(summary)).not.toContain('user_birthday')
    ;[null, undefined, {}, 'orders_count'].forEach(condition => expect(ruleSummary(t, condition, formatDate)).toMatchObject({ label: 'Rule', text: '—' }))
  })

  it('without a date formatter a date rule is «—», never the ISO text', () => {
    const summary = ruleSummary(t, { type: 'user_created_at', date_condition: '<', date: '2026-08-01 00:00:00' }, undefined)
    expect(summary).toMatchObject({ label: 'Sign-up date', text: '—' })
    expect(JSON.stringify(summary)).not.toContain('2026-08-01')
  })
})

describe('filterOptions · Channel and Audience for the pills (no Status: auditor #8)', () => {
  it('Channel lists the three creatable channels first, then whatsapp, webhook and popup, as { id, name }', () => {
    expect(filterOptions(t).channel).toEqual([
      { id: 'email', name: 'Email' },
      { id: 'sms', name: 'SMS' },
      { id: 'notification', name: 'Push notification' },
      { id: 'whatsapp', name: 'WhatsApp' },
      { id: 'webhook', name: 'Webhook' },
      { id: 'popup', name: 'Popup' }
    ])
  })

  it('Audience lists fixed and dynamic', () => {
    expect(filterOptions(t).audience).toEqual([
      { id: 'fixed', name: 'Fixed' },
      { id: 'dynamic', name: 'Dynamic' }
    ])
  })

  it('has exactly the two groups (no status)', () => {
    expect(Object.keys(filterOptions(t))).toEqual(['channel', 'audience'])
  })
})

describe('hasOrderStats', () => {
  it.each(['email', 'notification'])('is true for %s', (type) => {
    expect(hasOrderStats({ contact_type: type })).toBe(true)
  })

  it.each(['sms', 'push', 'whatsapp', 'webhook', 'popup'])('is false for %s', (type) => {
    expect(hasOrderStats({ contact_type: type })).toBe(false)
  })

  it('is false without a campaign or a channel', () => {
    expect(hasOrderStats(undefined)).toBe(false)
    expect(hasOrderStats(null)).toBe(false)
    expect(hasOrderStats({})).toBe(false)
  })
})
