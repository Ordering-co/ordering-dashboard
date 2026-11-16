// redesign stores 5.9: the rules of the shared payment gateway panel (ProviderPanel) as pure functions (no React), so the
// panel and its tests read the same truth. A `draft` is what `initDraft` returns; the `baseline` is the draft as last saved.
//
// `fields` is `[{ key, label, mode: 'live' | 'sandbox', required?, secret?, type?, hint? }]`: the keys of the credentials a provider
// form asks for, in `data` (live) or `data_sandbox` (sandbox).
//
// redesign stores 5.11: three opt-in additions, none of which moves a result when it is not used.
//  - a field with `readOnly: true` is never required (`missingRequired` skips it);
//  - `initDraft(…, { extraValues })` keeps values that are NOT the gateway record's under `draft.extra` (as text), and `getChanges` /
//    `countChanges` take an optional 4th argument `extraFields` `[{ key }]` to report them as `changes.extra`;
//  - `applyDraftPatch(draft, patch)` merges an outside result (Stripe Connect's OAuth) into a draft.
import { normalizeIds } from '../paymethodModel'

const ARRAY_KEYS = ['allowed_order_types', 'sites', 'devices']

// a field compares as a string: `undefined` and `null` are the same as an empty one
const text = (value) => (value === undefined || value === null ? '' : String(value))

const dataKey = (mode) => (mode === 'sandbox' ? 'data_sandbox' : 'data')

const fieldsOf = (fields, mode) => (fields || []).filter(field => (field.mode === 'sandbox' ? 'sandbox' : 'live') === mode)

const changedFields = (baseline, draft, fields, mode) => {
  const key = dataKey(mode)
  return fieldsOf(fields, mode).filter(field => text(baseline?.[key]?.[field.key]) !== text(draft?.[key]?.[field.key]))
}

// order does not matter: two lists are the same when they hold the same values
const sameSet = (a, b) => {
  const left = new Set(a || [])
  const right = new Set(b || [])
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

const changedExtra = (baseline, draft, extraFields) => (
  (extraFields || []).filter(field => text(baseline?.extra?.[field.key]) !== text(draft?.extra?.[field.key]))
)

/**
 * The editable copy of a store's payment method. G4-21: the API gives `sites` and `devices` as objects, the save wants ids (`main`
 * compared objects with ids and showed every site unticked), so both become ids here.
 */
export const initDraft = (businessPaymethod, { defaultOrderTypes = [], extraValues } = {}) => ({
  sandbox: !!businessPaymethod?.sandbox,
  data: { ...(businessPaymethod?.data || {}) },
  data_sandbox: { ...(businessPaymethod?.data_sandbox || {}) },
  allowed_order_types: [...(businessPaymethod?.allowed_order_types ?? defaultOrderTypes)],
  sites: normalizeIds(businessPaymethod?.sites),
  devices: normalizeIds(businessPaymethod?.devices),
  // redesign stores 5.11: values that live outside the record, kept as text. No `extraValues`, no `extra` key.
  ...(extraValues ? { extra: Object.fromEntries(Object.entries(extraValues).map(([key, value]) => [key, text(value)])) } : {})
})

/**
 * redesign stores 5.11: a copy of the draft with an outside patch merged in: `sandbox` is replaced when it is a boolean;
 * `data` / `data_sandbox` are shallow-merged over the draft's. Returns the same draft when there is nothing to apply.
 */
export const applyDraftPatch = (draft, patch) => {
  if (!patch || typeof patch !== 'object') return draft
  const next = { ...draft }
  if (typeof patch.sandbox === 'boolean') next.sandbox = patch.sandbox
  for (const key of ['data', 'data_sandbox']) {
    if (patch[key] && typeof patch[key] === 'object') next[key] = { ...(draft?.[key] || {}), ...patch[key] }
  }
  return next
}

/**
 * Only what changed, ready for `onSave`:
 *  - `sandbox` when it differs;
 *  - `data` / `data_sandbox`: when any field of that mode differs, the FULL object (never a partial one). The edits of both modes
 *    are sent even when only the active mode is displayed (G4-23). An emptied field is `''` and stays `''`;
 *  - `allowed_order_types`, `sites`, `devices`: when the SET differs (order-insensitive), the draft array;
 *  - redesign stores 5.11: with `extraFields`, `extra` holds ONLY the changed extra keys (as text); absent when none changed.
 */
export const getChanges = (baseline, draft, fields, extraFields) => {
  const changes = {}
  if (!!baseline?.sandbox !== !!draft?.sandbox) changes.sandbox = !!draft?.sandbox
  for (const mode of ['live', 'sandbox']) {
    if (changedFields(baseline, draft, fields, mode).length === 0) continue
    const key = dataKey(mode)
    changes[key] = { ...(baseline?.[key] || {}), ...(draft?.[key] || {}) }
  }
  for (const key of ARRAY_KEYS) {
    if (!sameSet(baseline?.[key], draft?.[key])) changes[key] = draft?.[key] || []
  }
  const extra = changedExtra(baseline, draft, extraFields)
  if (extra.length > 0) changes.extra = Object.fromEntries(extra.map(field => [field.key, text(draft?.extra?.[field.key])]))
  return changes
}

/** What the save bar counts: one per changed field (and, 5.11, per changed extra field), plus the mode, the order types, the channels and the devices. */
export const countChanges = (baseline, draft, fields, extraFields) => {
  let count = changedFields(baseline, draft, fields, 'live').length + changedFields(baseline, draft, fields, 'sandbox').length +
    changedExtra(baseline, draft, extraFields).length
  if (!!baseline?.sandbox !== !!draft?.sandbox) count += 1
  for (const key of ARRAY_KEYS) if (!sameSet(baseline?.[key], draft?.[key])) count += 1
  return count
}

/** Keys of the `required` fields of the ACTIVE mode that are empty (`main` validated only the active mode). A `readOnly` field is never required. */
export const missingRequired = (draft, fields) => {
  const mode = draft?.sandbox ? 'sandbox' : 'live'
  const values = draft?.[dataKey(mode)] || {}
  return fieldsOf(fields, mode)
    .filter(field => field.required && !field.readOnly && text(values[field.key]).trim() === '')
    .map(field => field.key)
}

/** Decision 6: a gateway that is ON and goes from Live to Sandbox asks before it is saved. */
export const needsSandboxConfirm = (businessPaymethod, baseline, draft) => (
  !!businessPaymethod?.enabled && !baseline?.sandbox && !!draft?.sandbox
)

/** redesign D-84 (owner, 2026-10-19): the mirror of decision 6: a gateway that is ON and goes from Sandbox to Live (it starts taking real payments) asks too. */
export const needsLiveConfirm = (businessPaymethod, baseline, draft) => (
  !!businessPaymethod?.enabled && !!baseline?.sandbox && !draft?.sandbox
)
