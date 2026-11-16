// redesign stores 5.9: the rules of the shared payment gateway panel, as pure functions.
import { describe, expect, it } from 'vitest'
import { applyDraftPatch, countChanges, getChanges, initDraft, missingRequired, needsLiveConfirm, needsSandboxConfirm } from '../providerPanelModel'

const FIELDS = [
  { key: 'client_id', label: 'Client ID', mode: 'live', required: true },
  { key: 'secret', label: 'Secret', mode: 'live', secret: true },
  { key: 'client_id', label: 'Client ID', mode: 'sandbox', required: true },
  { key: 'secret', label: 'Secret', mode: 'sandbox', secret: true }
]

const record = (extra = {}) => ({
  id: 5,
  enabled: true,
  sandbox: false,
  data: { client_id: 'live-id', secret: 'live-secret' },
  data_sandbox: { client_id: 'test-id', secret: 'test-secret' },
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const pair = (bp = record(), options = { defaultOrderTypes: [1, 2, 3, 4, 5] }) => ({
  baseline: initDraft(bp, options),
  draft: initDraft(bp, options)
})

describe('initDraft', () => {
  it('copies the record into a draft', () => {
    const bp = record()
    const draft = initDraft(bp, { defaultOrderTypes: [1, 2, 3, 4, 5] })
    expect(draft).toEqual({
      sandbox: false,
      data: { client_id: 'live-id', secret: 'live-secret' },
      data_sandbox: { client_id: 'test-id', secret: 'test-secret' },
      allowed_order_types: [1, 2],
      sites: [],
      devices: []
    })
    draft.data.client_id = 'changed'
    expect(bp.data.client_id).toBe('live-id')
  })

  it('falls back to the defaults when there is no record', () => {
    expect(initDraft(undefined, { defaultOrderTypes: [1, 2, 3, 4, 5] })).toEqual({
      sandbox: false,
      data: {},
      data_sandbox: {},
      allowed_order_types: [1, 2, 3, 4, 5],
      sites: [],
      devices: []
    })
  })

  it('puts the default order types when the record has none', () => {
    expect(initDraft({ allowed_order_types: null }, { defaultOrderTypes: [1, 2, 3] }).allowed_order_types).toEqual([1, 2, 3])
    expect(initDraft({ allowed_order_types: [] }, { defaultOrderTypes: [1, 2, 3] }).allowed_order_types).toEqual([])
  })

  it('G4-21: sites and devices that arrive as objects become ids', () => {
    const draft = initDraft(record({ sites: [{ id: 3, name: 'Web' }, 4], devices: [{ id: 9 }] }), { defaultOrderTypes: [] })
    expect(draft.sites).toEqual([3, 4])
    expect(draft.devices).toEqual([9])
  })

  it('keeps sandbox as a boolean', () => {
    expect(initDraft({ sandbox: 1 }, { defaultOrderTypes: [] }).sandbox).toBe(true)
    expect(initDraft({}, { defaultOrderTypes: [] }).sandbox).toBe(false)
  })
})

describe('getChanges', () => {
  it('has nothing when nothing changed', () => {
    const { baseline, draft } = pair()
    expect(getChanges(baseline, draft, FIELDS)).toEqual({})
  })

  it('sends sandbox alone when only the mode changed', () => {
    const { baseline, draft } = pair()
    draft.sandbox = true
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ sandbox: true })
  })

  it('sends the FULL data object when one live field changed', () => {
    const { baseline, draft } = pair()
    draft.data.secret = 'new'
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ data: { client_id: 'live-id', secret: 'new' } })
  })

  it('G4-23: the edits of the sandbox credentials are sent even when the mode shown is live', () => {
    const { baseline, draft } = pair()
    draft.data_sandbox.client_id = 'test-new'
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ data_sandbox: { client_id: 'test-new', secret: 'test-secret' } })
  })

  it('sends both objects when both modes changed', () => {
    const { baseline, draft } = pair()
    draft.data.client_id = 'a'
    draft.data_sandbox.client_id = 'b'
    const changes = getChanges(baseline, draft, FIELDS)
    expect(Object.keys(changes).sort()).toEqual(['data', 'data_sandbox'])
  })

  it('G4-23: an emptied field is sent as an empty string and stays empty', () => {
    const { baseline, draft } = pair()
    draft.data.secret = ''
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ data: { client_id: 'live-id', secret: '' } })
  })

  it('treats undefined, null and an empty string as the same value', () => {
    const { baseline, draft } = pair(record({ data: {}, data_sandbox: { secret: null } }))
    draft.data.client_id = ''
    draft.data_sandbox.secret = undefined
    expect(getChanges(baseline, draft, FIELDS)).toEqual({})
  })

  it('compares a field as a string', () => {
    const { baseline, draft } = pair(record({ data: { client_id: 12, secret: 's' } }))
    draft.data.client_id = '12'
    expect(getChanges(baseline, draft, FIELDS)).toEqual({})
  })

  it('does not look at keys that are not a field', () => {
    const { baseline, draft } = pair()
    draft.data.extra = 'x'
    expect(getChanges(baseline, draft, FIELDS)).toEqual({})
  })

  it('keeps the keys the draft does not touch (full object, never partial)', () => {
    const { baseline } = pair(record({ data: { client_id: 'a', secret: 'b', other: 'c' } }))
    const draft = { ...baseline, data: { ...baseline.data, secret: 'z' } }
    expect(getChanges(baseline, draft, FIELDS).data).toEqual({ client_id: 'a', secret: 'z', other: 'c' })
  })

  it.each([
    ['allowed_order_types', [2, 3]],
    ['sites', [7]],
    ['devices', [9, 10]]
  ])('sends %s when the set differs', (key, next) => {
    const { baseline, draft } = pair()
    draft[key] = next
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ [key]: next })
  })

  it.each([
    ['allowed_order_types', [1, 2], [2, 1]],
    ['sites', [3, 4], [4, 3]],
    ['devices', [5, 6], [6, 5]]
  ])('%s: the same set in another order is not a change', (key, before, after) => {
    const { baseline, draft } = pair(record({ [key]: before }))
    draft[key] = after
    expect(getChanges(baseline, draft, FIELDS)).toEqual({})
  })

  it('a set that is a subset or a superset is a change', () => {
    const { baseline, draft } = pair()
    draft.allowed_order_types = [1]
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ allowed_order_types: [1] })
    draft.allowed_order_types = [1, 2, 3]
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ allowed_order_types: [1, 2, 3] })
  })

  it('unticking every channel sends an empty list (all channels)', () => {
    const { baseline, draft } = pair(record({ sites: [{ id: 1 }] }))
    draft.sites = []
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ sites: [] })
  })
})

describe('countChanges', () => {
  it('is zero without changes', () => {
    const { baseline, draft } = pair()
    expect(countChanges(baseline, draft, FIELDS)).toBe(0)
  })

  it('counts one per changed field, in both modes', () => {
    const { baseline, draft } = pair()
    draft.data.client_id = 'a'
    draft.data.secret = 'b'
    draft.data_sandbox.secret = 'c'
    expect(countChanges(baseline, draft, FIELDS)).toBe(3)
  })

  it('adds one for the mode, the order types, the channels and the devices', () => {
    const { baseline, draft } = pair()
    draft.sandbox = true
    draft.allowed_order_types = [3]
    draft.sites = [1]
    draft.devices = [2]
    expect(countChanges(baseline, draft, FIELDS)).toBe(4)
  })

  it('adds fields and the rest', () => {
    const { baseline, draft } = pair()
    draft.data.secret = 'x'
    draft.sandbox = true
    expect(countChanges(baseline, draft, FIELDS)).toBe(2)
  })
})

describe('missingRequired', () => {
  it('is empty when the required fields of the active mode have a value', () => {
    expect(missingRequired(initDraft(record(), { defaultOrderTypes: [] }), FIELDS)).toEqual([])
  })

  it('lists the required fields of the live mode that are empty', () => {
    const draft = initDraft(record(), { defaultOrderTypes: [] })
    draft.data.client_id = ''
    expect(missingRequired(draft, FIELDS)).toEqual(['client_id'])
  })

  it('looks only at the active mode', () => {
    const draft = initDraft(record(), { defaultOrderTypes: [] })
    draft.data_sandbox.client_id = ''
    expect(missingRequired(draft, FIELDS)).toEqual([])
    draft.sandbox = true
    expect(missingRequired(draft, FIELDS)).toEqual(['client_id'])
    draft.data.client_id = ''
    expect(missingRequired(draft, FIELDS)).toEqual(['client_id'])
  })

  it('counts a missing key and a blank value as empty', () => {
    const draft = initDraft(record({ data: { client_id: '   ' } }), { defaultOrderTypes: [] })
    expect(missingRequired(draft, FIELDS)).toEqual(['client_id'])
    draft.data = {}
    expect(missingRequired(draft, FIELDS)).toEqual(['client_id'])
  })

  it('does not list the optional fields', () => {
    const draft = initDraft(record({ data: {} }), { defaultOrderTypes: [] })
    expect(missingRequired(draft, FIELDS)).toEqual(['client_id'])
  })
})

describe('needsSandboxConfirm', () => {
  it('is true for a gateway that is on and goes from live to sandbox', () => {
    const bp = record({ enabled: true, sandbox: false })
    const { baseline, draft } = pair(bp)
    draft.sandbox = true
    expect(needsSandboxConfirm(bp, baseline, draft)).toBe(true)
  })

  it('is false for a gateway that is off', () => {
    const bp = record({ enabled: false, sandbox: false })
    const { baseline, draft } = pair(bp)
    draft.sandbox = true
    expect(needsSandboxConfirm(bp, baseline, draft)).toBe(false)
  })

  it('is false when the draft stays live', () => {
    const bp = record()
    const { baseline, draft } = pair(bp)
    expect(needsSandboxConfirm(bp, baseline, draft)).toBe(false)
  })

  it('is false when it was already sandbox', () => {
    const bp = record({ sandbox: true })
    const { baseline, draft } = pair(bp)
    expect(needsSandboxConfirm(bp, baseline, draft)).toBe(false)
  })

  it('is false when it goes back to live (that direction has its own predicate)', () => {
    const bp = record({ sandbox: true })
    const { baseline, draft } = pair(bp)
    draft.sandbox = false
    expect(needsSandboxConfirm(bp, baseline, draft)).toBe(false)
  })

  it('reads the baseline, so a saved sandbox is not asked again', () => {
    const bp = record({ enabled: true, sandbox: false })
    const { baseline, draft } = pair(bp)
    draft.sandbox = true
    const saved = { ...baseline, sandbox: true }
    expect(needsSandboxConfirm(bp, saved, draft)).toBe(false)
  })

  it('is false without a record', () => {
    expect(needsSandboxConfirm(undefined, { sandbox: false }, { sandbox: true })).toBe(false)
  })
})

// redesign stores 5.11: `readOnly` fields, `extraFields` / `extraValues` and `applyDraftPatch`
describe('extra fields (5.11)', () => {
  const EXTRA = [{ key: 'fixed_fee', label: 'Fixed fee' }, { key: 'percentage_fee', label: 'Percentage fee' }]
  const extraPair = (extraValues = { fixed_fee: 1.5, percentage_fee: null }) => ({
    baseline: initDraft(record(), { defaultOrderTypes: [], extraValues }),
    draft: initDraft(record(), { defaultOrderTypes: [], extraValues })
  })

  it('initDraft keeps the extra values as text, empty when null or undefined, and copies them', () => {
    const values = { fixed_fee: 1.5, percentage_fee: null, other: undefined }
    const draft = initDraft(record(), { defaultOrderTypes: [], extraValues: values })
    expect(draft.extra).toEqual({ fixed_fee: '1.5', percentage_fee: '', other: '' })
    draft.extra.fixed_fee = '9'
    expect(values.fixed_fee).toBe(1.5)
  })

  it('initDraft without extraValues has no `extra` key at all', () => {
    expect('extra' in initDraft(record(), { defaultOrderTypes: [] })).toBe(false)
    expect('extra' in initDraft(record())).toBe(false)
  })

  it('getChanges: `extra` holds only the changed keys, as text', () => {
    const { baseline, draft } = extraPair()
    expect(getChanges(baseline, draft, FIELDS, EXTRA)).toEqual({})
    draft.extra.percentage_fee = '2.9'
    expect(getChanges(baseline, draft, FIELDS, EXTRA)).toEqual({ extra: { percentage_fee: '2.9' } })
    draft.extra.fixed_fee = ''
    expect(getChanges(baseline, draft, FIELDS, EXTRA)).toEqual({ extra: { fixed_fee: '', percentage_fee: '2.9' } })
  })

  it('getChanges: `extra` sits beside the other changes', () => {
    const { baseline, draft } = extraPair()
    draft.extra.fixed_fee = '2'
    draft.sandbox = true
    expect(getChanges(baseline, draft, FIELDS, EXTRA)).toEqual({ sandbox: true, extra: { fixed_fee: '2' } })
  })

  it('getChanges: an extra key that is not in extraFields is not looked at, and a missing 4th argument never reports `extra`', () => {
    const { baseline, draft } = extraPair()
    draft.extra.fixed_fee = '2'
    expect(getChanges(baseline, draft, FIELDS)).toEqual({})
    expect(getChanges(baseline, draft, FIELDS, [])).toEqual({})
    expect(getChanges(baseline, draft, FIELDS, [{ key: 'percentage_fee' }])).toEqual({})
  })

  it('getChanges: a null and an empty extra value are the same', () => {
    const { baseline, draft } = extraPair({ fixed_fee: null })
    draft.extra.fixed_fee = ''
    expect(getChanges(baseline, draft, FIELDS, EXTRA)).toEqual({})
  })

  it('countChanges: one per changed extra field, added to the rest', () => {
    const { baseline, draft } = extraPair()
    expect(countChanges(baseline, draft, FIELDS, EXTRA)).toBe(0)
    draft.extra.fixed_fee = '2'
    draft.extra.percentage_fee = '3'
    expect(countChanges(baseline, draft, FIELDS, EXTRA)).toBe(2)
    draft.data.secret = 'x'
    expect(countChanges(baseline, draft, FIELDS, EXTRA)).toBe(3)
    expect(countChanges(baseline, draft, FIELDS)).toBe(1)
  })

  it('the calls with three arguments give the same results as before', () => {
    const { baseline, draft } = pair()
    draft.data.secret = 'new'
    draft.sites = [3]
    expect(getChanges(baseline, draft, FIELDS)).toEqual({ data: { client_id: 'live-id', secret: 'new' }, sites: [3] })
    expect(countChanges(baseline, draft, FIELDS)).toBe(2)
    expect(Object.keys(getChanges(baseline, draft, FIELDS))).not.toContain('extra')
  })
})

describe('readOnly fields (5.11)', () => {
  it('missingRequired ignores a readOnly field even when it is required and empty', () => {
    const fields = [
      { key: 'client_id', label: 'Client ID', mode: 'live', required: true, readOnly: true },
      { key: 'secret', label: 'Secret', mode: 'live', required: true }
    ]
    const draft = initDraft(record({ data: {} }), { defaultOrderTypes: [] })
    expect(missingRequired(draft, fields)).toEqual(['secret'])
  })

  it('a readOnly field still counts and is sent when its value changes (OAuth fills it)', () => {
    const fields = [{ key: 'client_id', label: 'Client ID', mode: 'live', readOnly: true }]
    const { baseline, draft } = pair()
    draft.data.client_id = 'acct_1'
    expect(countChanges(baseline, draft, fields)).toBe(1)
    expect(getChanges(baseline, draft, fields)).toEqual({ data: { client_id: 'acct_1', secret: 'live-secret' } })
  })
})

describe('applyDraftPatch (5.11)', () => {
  it('replaces sandbox when it is a boolean and merges data / data_sandbox over the draft, without touching the original', () => {
    const { draft } = pair()
    const next = applyDraftPatch(draft, { sandbox: true, data: { client_id: 'acct' }, data_sandbox: { secret: 'tk' } })
    expect(next.sandbox).toBe(true)
    expect(next.data).toEqual({ client_id: 'acct', secret: 'live-secret' })
    expect(next.data_sandbox).toEqual({ client_id: 'test-id', secret: 'tk' })
    expect(draft.sandbox).toBe(false)
    expect(draft.data.client_id).toBe('live-id')
  })

  it('ignores a sandbox that is not a boolean, and a patch that is null, undefined or not an object', () => {
    const { draft } = pair()
    expect(applyDraftPatch(draft, { sandbox: 'yes' }).sandbox).toBe(false)
    expect(applyDraftPatch(draft, null)).toBe(draft)
    expect(applyDraftPatch(draft, undefined)).toBe(draft)
    expect(applyDraftPatch(draft, 'x')).toBe(draft)
  })

  it('a patch is a change against the baseline only through the fields of those keys', () => {
    const { baseline, draft } = pair()
    const next = applyDraftPatch(draft, { data: { client_id: 'acct', not_a_field: 'z' } })
    expect(countChanges(baseline, next, FIELDS)).toBe(1)
    expect(getChanges(baseline, next, FIELDS).data).toEqual({ client_id: 'acct', secret: 'live-secret', not_a_field: 'z' })
  })
})

// redesign D-84 (owner, 2026-10-19): the mirror of the sandbox confirmation, Sandbox -> Live starts taking real payments
describe('needsLiveConfirm', () => {
  it('is true for a gateway that is on and goes from sandbox to live', () => {
    const bp = record({ enabled: true, sandbox: true })
    const { baseline, draft } = pair(bp)
    draft.sandbox = false
    expect(needsLiveConfirm(bp, baseline, draft)).toBe(true)
  })

  it('is false for a gateway that is off', () => {
    const bp = record({ enabled: false, sandbox: true })
    const { baseline, draft } = pair(bp)
    draft.sandbox = false
    expect(needsLiveConfirm(bp, baseline, draft)).toBe(false)
  })

  it('is false when the draft stays sandbox', () => {
    const bp = record({ sandbox: true })
    const { baseline, draft } = pair(bp)
    expect(needsLiveConfirm(bp, baseline, draft)).toBe(false)
  })

  it('is false when it was already live', () => {
    const bp = record({ sandbox: false })
    const { baseline, draft } = pair(bp)
    expect(needsLiveConfirm(bp, baseline, draft)).toBe(false)
  })

  it('is false when it goes from live to sandbox (that direction has its own predicate)', () => {
    const bp = record({ sandbox: false })
    const { baseline, draft } = pair(bp)
    draft.sandbox = true
    expect(needsLiveConfirm(bp, baseline, draft)).toBe(false)
  })

  it('reads the baseline, so a saved live is not asked again', () => {
    const bp = record({ enabled: true, sandbox: true })
    const { baseline, draft } = pair(bp)
    draft.sandbox = false
    const saved = { ...baseline, sandbox: false }
    expect(needsLiveConfirm(bp, saved, draft)).toBe(false)
  })

  it('is false without a record', () => {
    expect(needsLiveConfirm(undefined, { sandbox: true }, { sandbox: false })).toBe(false)
  })
})
