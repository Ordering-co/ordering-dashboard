/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign RA-B1 (decision 3, decision 6; M-RA5, M-RA6, M-RA15): outcomes of the panel controller, save and create-with-first-message
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token' },
  ordering: { root: 'https://api.test' },
  fetch: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { RecoveryActionDetail } from '..'

const RULE = { id: 1, name: 'Rule 1', description: 'First', times: [260], enabled: false }
const OTHER = { id: 2, name: 'Rule 2', description: 'Second', times: [5], enabled: true }
const json = (body) => ({ json: async () => body })
const ok = (result) => json({ error: false, result })
const fail = (result) => json({ error: true, result })

const lastCall = () => mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1]
const callsTo = (method, url) => mocks.fetch.mock.calls.filter(([callUrl, options]) => callUrl === url && (options?.method || 'GET') === method)

const renderDetail = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const view = render(<RecoveryActionDetail UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current).not.toBeNull())
  return { ui, view }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetch = vi.fn(async () => ok({}))
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RecoveryActionDetail · loading one rule (RA-B1 / M-RA15)', () => {
  it('a success leaves loading false and error null', async () => {
    mocks.fetch.mockImplementation(async () => ok(RULE))
    const { ui } = await renderDetail({ actionId: 1 })
    await waitFor(() => expect(ui.current.recoveryActionState.loading).toBe(false))
    expect(ui.current.recoveryActionState).toMatchObject({ action: RULE, error: null })
    expect(lastCall()[0]).toBe('https://api.test/event_rules/1')
  })

  it('a request that throws leaves loading false with error [message]', async () => {
    mocks.fetch.mockImplementation(async () => { throw new Error('network down') })
    const { ui } = await renderDetail({ actionId: 99 })
    await waitFor(() => expect(ui.current.recoveryActionState.error).toEqual(['network down']))
    expect(ui.current.recoveryActionState.loading).toBe(false)
  })

  it('an API error leaves loading false with the API messages', async () => {
    mocks.fetch.mockImplementation(async () => fail(['Not found']))
    const { ui } = await renderDetail({ actionId: 99 })
    await waitFor(() => expect(ui.current.recoveryActionState.error).toEqual(['Not found']))
    expect(ui.current.recoveryActionState.loading).toBe(false)
  })
})

describe('RecoveryActionDetail · delete (RA-B1 / M-RA6)', () => {
  it('resolves { ok: true } and does what main did on success', async () => {
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    mocks.fetch.mockImplementation(async () => ok({}))
    const { ui } = await renderDetail({ action: RULE, onClose, handleSuccessDeleteRecoveryAction: onDeleted })

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteRecoveryAction() })

    expect(outcome).toEqual({ ok: true, error: null })
    expect(lastCall()[0]).toBe('https://api.test/event_rules/1')
    expect(lastCall()[1].method).toBe('DELETE')
    expect(onDeleted).toHaveBeenCalledWith(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Recovery action deleted')
  })

  it('an API error resolves { ok: false, error } and leaves actionState { loading: false, error }', async () => {
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    mocks.fetch.mockImplementation(async () => fail(['In use']))
    const { ui } = await renderDetail({ action: RULE, onClose, handleSuccessDeleteRecoveryAction: onDeleted })

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteRecoveryAction() })

    expect(outcome).toEqual({ ok: false, error: ['In use'] })
    expect(ui.current.actionState).toEqual({ loading: false, error: ['In use'] })
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a request that throws resolves { ok: false, error: [message] } with loading false', async () => {
    mocks.fetch.mockImplementation(async () => { throw new Error('network down') })
    const { ui } = await renderDetail({ action: RULE })

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteRecoveryAction() })

    expect(outcome).toEqual({ ok: false, error: ['network down'] })
    expect(ui.current.actionState).toEqual({ loading: false, error: ['network down'] })
  })
})

describe('RecoveryActionDetail · handleSaveRule (RA-B1 / decision 3)', () => {
  it('PUTs the changes with arrays serialized like handleUpdateClick (times: "[260]")', async () => {
    mocks.fetch.mockImplementation(async () => ok({ id: 1, name: 'Renamed', times: [300] }))
    const { ui } = await renderDetail({ action: RULE, recoveryActionList: { actions: [RULE, OTHER] } })

    await act(async () => { await ui.current.handleSaveRule({ name: 'Renamed', times: [300] }) })

    const [url, options] = lastCall()
    expect(url).toBe('https://api.test/event_rules/1')
    expect(options.method).toBe('PUT')
    expect(options.headers.Authorization).toBe('Bearer token')
    expect(JSON.parse(options.body)).toEqual({ name: 'Renamed', times: '[300]' })
  })

  it('resolves { ok, error, rule }, updates the panel rule and tells the list with a copy', async () => {
    const onUpdated = vi.fn()
    const list = [RULE, OTHER]
    mocks.fetch.mockImplementation(async () => ok({ id: 1, name: 'Renamed', times: [300] }))
    const { ui } = await renderDetail({ action: RULE, recoveryActionList: { actions: list }, handleSuccessUpdateRecoveryAction: onUpdated })

    let outcome
    await act(async () => { outcome = await ui.current.handleSaveRule({ name: 'Renamed', times: [300] }) })

    expect(outcome.ok).toBe(true)
    expect(outcome.error).toBeNull()
    expect(outcome.rule).toMatchObject({ id: 1, name: 'Renamed', description: 'First', times: [300] })
    expect(ui.current.recoveryActionState.action).toMatchObject({ id: 1, name: 'Renamed', times: [300] })
    expect(ui.current.actionState).toEqual({ loading: false, error: null })
    expect(onUpdated).toHaveBeenCalledTimes(1)
    const updatedList = onUpdated.mock.calls[0][0]
    expect(updatedList).not.toBe(list)
    expect(updatedList[0]).toMatchObject({ id: 1, name: 'Renamed' })
    expect(updatedList[1]).toBe(OTHER)
    // the previous objects are never touched
    expect(RULE.name).toBe('Rule 1')
    expect(list[0]).toBe(RULE)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Recovery action saved')
  })

  it('an API error resolves { ok: false, error } and changes nothing', async () => {
    const onUpdated = vi.fn()
    mocks.fetch.mockImplementation(async () => fail(['Name is required']))
    const { ui } = await renderDetail({ action: RULE, recoveryActionList: { actions: [RULE] }, handleSuccessUpdateRecoveryAction: onUpdated })

    let outcome
    await act(async () => { outcome = await ui.current.handleSaveRule({ name: '' }) })

    expect(outcome).toEqual({ ok: false, error: ['Name is required'], rule: null })
    expect(onUpdated).not.toHaveBeenCalled()
    expect(ui.current.recoveryActionState.action).toBe(RULE)
    expect(ui.current.actionState.loading).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Recovery action saved')
  })

  it('a request that throws resolves { ok: false, error: [message] }', async () => {
    mocks.fetch.mockImplementation(async () => { throw new Error('network down') })
    const { ui } = await renderDetail({ action: RULE })

    let outcome
    await act(async () => { outcome = await ui.current.handleSaveRule({ name: 'x' }) })

    expect(outcome).toEqual({ ok: false, error: ['network down'], rule: null })
    expect(ui.current.actionState.loading).toBe(false)
  })

  it('works for a rule opened by id (no action prop)', async () => {
    mocks.fetch.mockImplementation(async (url, options = {}) => options.method === 'PUT' ? ok({ id: 7, name: 'B' }) : ok({ id: 7, name: 'A', times: [5] }))
    const { ui } = await renderDetail({ actionId: 7 })
    await waitFor(() => expect(ui.current.recoveryActionState.action?.id).toBe(7))

    await act(async () => { await ui.current.handleSaveRule({ name: 'B' }) })

    expect(lastCall()[0]).toBe('https://api.test/event_rules/7')
    expect(ui.current.recoveryActionState.action).toMatchObject({ id: 7, name: 'B', times: [5] })
  })
})

describe('RecoveryActionDetail · handleCreateRule (RA-B1 / decision 6)', () => {
  const NEW_RULE = { name: 'Fresh', description: 'Hello', times: [300] }
  const NEW_CHANNEL = { channel: 'email', title: 'Hi', body: '<p>Hello</p>' }

  // POST /event_rules answers the created rule; the channel answers per `channelAnswer`
  const installCreate = (channelAnswer) => {
    mocks.fetch.mockImplementation(async (url, options = {}) => {
      if (options.method === 'POST' && url === 'https://api.test/event_rules') return ok({ id: 21, ...JSON.parse(options.body) })
      if (options.method === 'POST' && url === 'https://api.test/event_rules/21/channels') return channelAnswer(options)
      throw new Error(`unexpected ${options.method} ${url}`)
    })
  }

  it('creates the rule on, then its channel on, and resolves { ok: true, rule, channel }', async () => {
    const onAdded = vi.fn()
    installCreate(async (options) => ok({ id: 5, event_rule_id: 21, ...JSON.parse(options.body) }))
    const { ui } = await renderDetail({ handleSuccessAddRecoveryAction: onAdded })
    expect(ui.current.isAddMode).toBe(true)

    let outcome
    await act(async () => { outcome = await ui.current.handleCreateRule({ rule: NEW_RULE, channel: NEW_CHANNEL }) })

    const [ruleCall] = callsTo('POST', 'https://api.test/event_rules')
    expect(JSON.parse(ruleCall[1].body)).toEqual({
      enabled: true, launch_type: 'times', type: 'abandoned_cart', name: 'Fresh', description: 'Hello', times: [300]
    })
    const [channelCall] = callsTo('POST', 'https://api.test/event_rules/21/channels')
    expect(JSON.parse(channelCall[1].body)).toEqual({ enabled: true, channel: 'email', title: 'Hi', body: '<p>Hello</p>' })
    expect(outcome.ok).toBe(true)
    expect(outcome.rule).toMatchObject({ id: 21, name: 'Fresh' })
    expect(outcome.channel).toMatchObject({ id: 5, channel: 'email' })
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onAdded.mock.calls[0][0]).toMatchObject({ id: 21 })
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Recovery action added')
  })

  it('a failing rule resolves stage "rule" and creates no channel', async () => {
    const onAdded = vi.fn()
    mocks.fetch.mockImplementation(async () => fail(['Name is required']))
    const { ui } = await renderDetail({ handleSuccessAddRecoveryAction: onAdded })

    let outcome
    await act(async () => { outcome = await ui.current.handleCreateRule({ rule: NEW_RULE, channel: NEW_CHANNEL }) })

    expect(outcome).toEqual({ ok: false, stage: 'rule', error: ['Name is required'] })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('a rule request that throws resolves stage "rule" with [message]', async () => {
    mocks.fetch.mockImplementation(async () => { throw new Error('network down') })
    const { ui } = await renderDetail()

    let outcome
    await act(async () => { outcome = await ui.current.handleCreateRule({ rule: NEW_RULE, channel: NEW_CHANNEL }) })

    expect(outcome).toEqual({ ok: false, stage: 'rule', error: ['network down'] })
  })

  it('a failing channel resolves stage "channel" with the rule, and the second call only retries the channel', async () => {
    const onAdded = vi.fn()
    let attempt = 0
    installCreate(async (options) => {
      attempt += 1
      return attempt === 1 ? fail(['Body is required']) : ok({ id: 6, event_rule_id: 21, ...JSON.parse(options.body) })
    })
    const { ui } = await renderDetail({ handleSuccessAddRecoveryAction: onAdded })

    let first
    await act(async () => { first = await ui.current.handleCreateRule({ rule: NEW_RULE, channel: { ...NEW_CHANNEL, body: '' } }) })
    expect(first).toMatchObject({ ok: false, stage: 'channel', error: ['Body is required'] })
    expect(first.rule).toMatchObject({ id: 21, name: 'Fresh' })
    expect(onAdded).toHaveBeenCalledTimes(1)

    let second
    await act(async () => { second = await ui.current.handleCreateRule({ rule: NEW_RULE, channel: NEW_CHANNEL }) })

    expect(second.ok).toBe(true)
    expect(second.rule).toMatchObject({ id: 21 })
    expect(callsTo('POST', 'https://api.test/event_rules')).toHaveLength(1)
    expect(callsTo('POST', 'https://api.test/event_rules/21/channels')).toHaveLength(2)
    expect(JSON.parse(callsTo('POST', 'https://api.test/event_rules/21/channels')[1][1].body).body).toBe('<p>Hello</p>')
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  it('a channel request that throws resolves stage "channel" with [message]', async () => {
    installCreate(async () => { throw new Error('network down') })
    const { ui } = await renderDetail()

    let outcome
    await act(async () => { outcome = await ui.current.handleCreateRule({ rule: NEW_RULE, channel: NEW_CHANNEL }) })

    expect(outcome).toMatchObject({ ok: false, stage: 'channel', error: ['network down'] })
    expect(outcome.rule).toMatchObject({ id: 21 })
  })
})

describe('RecoveryActionDetail · what main exposes keeps working', () => {
  it('exposes the old handlers and the add-mode state', async () => {
    const { ui } = await renderDetail()
    for (const name of [
      'isAddMode', 'recoveryActionState', 'formState', 'actionState', 'handleChangeItem', 'handleChangeInput',
      'handleAddRecoveryAction', 'handleDeleteRecoveryAction', 'handleUpdateClick', 'handleRemoveKey'
    ]) {
      expect(ui.current[name], name).not.toBeUndefined()
    }
    expect(ui.current.formState.changes).toEqual({ enabled: true, launch_type: 'times', name: '', type: 'abandoned_cart' })
  })

  it('handleUpdateClick still PUTs the draft of formState with serialized arrays', async () => {
    mocks.fetch.mockImplementation(async () => ok({ id: 1, name: 'Renamed' }))
    // main's handleUpdateClick mutates the row of the list: give it a private copy
    const row = { ...RULE }
    const { ui } = await renderDetail({ action: row, recoveryActionList: { actions: [row] } })
    await act(async () => { ui.current.handleChangeItem({ times: [30] }) })

    await act(async () => { await ui.current.handleUpdateClick() })

    expect(JSON.parse(lastCall()[1].body)).toEqual({ times: '[30]' })
  })
})
