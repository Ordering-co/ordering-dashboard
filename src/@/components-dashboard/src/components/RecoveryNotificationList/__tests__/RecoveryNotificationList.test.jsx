/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign RA-B1 (decision 5; M-RA16, M-RA17): the channels of a rule, outcomes instead of silence, no mutation
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

import { RecoveryNotificationList } from '..'
import { MAX_PAGES } from '../../../utils/recoveryRules'

const RULE = { id: 1, name: 'Rule 1' }
const makeChannels = () => [
  { id: 10, channel: 'email', title: 'Hi', body: '<p>Hello</p>', enabled: true, event_rule_id: 1 },
  { id: 11, channel: 'sms', title: 'Text', body: 'Hello', enabled: false, event_rule_id: 1 }
]
const json = (body) => ({ json: async () => body })
const ok = (result) => json({ error: false, result })
const fail = (result) => json({ error: true, result })
const lastCall = () => mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1]

const renderList = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const view = render(<RecoveryNotificationList UIComponent={UIComponent} action={RULE} {...props} />)
  await waitFor(() => expect(ui.current.notificationListState.loading).toBe(false))
  await waitFor(() => expect(ui.current.notificationListState.notifications.length + (ui.current.notificationListState.error ? 1 : 0)).toBeGreaterThan(0))
  return { ui, view }
}

// redesign R2-F1 (R1-02): the first read now tells the page too; the tests of the WRITES count only what the write tells it
const renderForWrites = async (onChannelsChange) => {
  const rendered = await renderList({ onChannelsChange })
  onChannelsChange.mockClear()
  return rendered
}

const answerAfterLoad = (answer) => {
  const base = mocks.fetch.getMockImplementation()
  mocks.fetch.mockImplementation(async (url, options = {}) => (options.method && options.method !== 'GET') ? answer(url, options) : base(url, options))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetch = vi.fn(async () => ok(makeChannels()))
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RecoveryNotificationList · loading (RA-B1 / M-RA16)', () => {
  it('GETs the channels of the rule', async () => {
    const { ui } = await renderList()
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/event_rules/1/channels?page=1&page_size=50')
    expect(ui.current.notificationListState).toEqual({ loading: false, notifications: makeChannels(), error: null })
  })

  // redesign R2-F1 (R1-02): the row of a rule that was just created hears its channels as soon as they are read, not only after a write
  it('tells the page the channels it read: onChannelsChange(ruleId, channels) after each good read', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderList({ onChannelsChange })
    expect(onChannelsChange).toHaveBeenCalledTimes(1)
    expect(onChannelsChange).toHaveBeenCalledWith(1, makeChannels())

    await act(async () => { await ui.current.reload() })
    expect(onChannelsChange).toHaveBeenCalledTimes(2)
  })

  it('does not tell the page about a read that failed', async () => {
    const onChannelsChange = vi.fn()
    mocks.fetch.mockImplementation(async () => fail(['No access']))
    await renderList({ onChannelsChange })
    expect(onChannelsChange).not.toHaveBeenCalled()
  })

  it('leaves the load error in notificationListState.error, for the panel to paint', async () => {
    mocks.fetch.mockImplementation(async () => fail(['No access']))
    const { ui } = await renderList()
    expect(ui.current.notificationListState.error).toEqual(['No access'])
    expect(ui.current.notificationListState.loading).toBe(false)
  })

  it('a request that throws leaves error [message]', async () => {
    mocks.fetch.mockImplementation(async () => { throw new Error('network down') })
    const { ui } = await renderList()
    expect(ui.current.notificationListState.error).toEqual(['network down'])
  })

  it('reload() asks again and clears the error', async () => {
    mocks.fetch.mockImplementationOnce(async () => fail(['No access']))
    const { ui } = await renderList()
    expect(ui.current.notificationListState.error).toEqual(['No access'])

    await act(async () => { await ui.current.reload() })

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(ui.current.notificationListState).toEqual({ loading: false, notifications: makeChannels(), error: null })
  })

  it('does not ask again when the same rule comes as a new object, and asks for another rule', async () => {
    const { ui, view } = await renderList()
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    view.rerender(<RecoveryNotificationList UIComponent={UIComponent} action={{ ...RULE, enabled: true }} />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(mocks.fetch).toHaveBeenCalledTimes(1)

    view.rerender(<RecoveryNotificationList UIComponent={UIComponent} action={{ id: 2, name: 'Rule 2' }} />)
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    expect(lastCall()[0]).toBe('https://api.test/event_rules/2/channels?page=1&page_size=50')
  })

  it('ignores the answer of a rule that is no longer open', async () => {
    let releaseFirst
    mocks.fetch
      .mockImplementationOnce(() => new Promise(resolve => { releaseFirst = () => resolve(ok([{ id: 99, channel: 'sms', title: 'Late', body: '', enabled: true }])) }))
      .mockImplementation(async () => ok([{ id: 20, channel: 'notification', title: 'Push', body: 'Hi', enabled: true }]))
    const ui = { current: null }
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    const view = render(<RecoveryNotificationList UIComponent={UIComponent} action={RULE} />)
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1))
    view.rerender(<RecoveryNotificationList UIComponent={UIComponent} action={{ id: 2 }} />)
    await waitFor(() => expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([20]))

    await act(async () => { releaseFirst() })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([20])
  })
})

describe('RecoveryNotificationList · every page of the channels', () => {
  const page = (current, totalPages, items) => json({
    error: false,
    result: items,
    pagination: { current_page: current, total_pages: totalPages, total: 3, page_size: 50, from: 1, to: items.length }
  })
  const channel = (id) => ({ id, channel: 'email', title: `T${id}`, body: '', enabled: true, event_rule_id: 1 })

  it('reads every page, concatenates them and tells the page once', async () => {
    const onChannelsChange = vi.fn()
    mocks.fetch.mockImplementation(async (url) => {
      const current = Number(/page=(\d+)/.exec(url)[1])
      return page(current, 2, current === 1 ? [channel(1), channel(2)] : [channel(3)])
    })
    const { ui } = await renderList({ onChannelsChange })
    expect(mocks.fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://api.test/event_rules/1/channels?page=1&page_size=50',
      'https://api.test/event_rules/1/channels?page=2&page_size=50'
    ])
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([1, 2, 3])
    expect(onChannelsChange).toHaveBeenCalledTimes(1)
    expect(onChannelsChange).toHaveBeenCalledWith(1, ui.current.notificationListState.notifications)
  })

  it('an answer without pagination is one page', async () => {
    const { ui } = await renderList()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(ui.current.notificationListState.notifications).toHaveLength(2)
  })

  it('a failing later page leaves the error and does not tell the page', async () => {
    const onChannelsChange = vi.fn()
    mocks.fetch.mockImplementation(async (url) => (url.includes('page=2') ? fail(['No access']) : page(1, 2, [channel(1)])))
    const { ui } = await renderList({ onChannelsChange })
    expect(ui.current.notificationListState.error).toEqual(['No access'])
    expect(onChannelsChange).not.toHaveBeenCalled()
  })

  it('stops at the page cap when total_pages is wrong', async () => {
    mocks.fetch.mockImplementation(async (url) => page(Number(/page=(\d+)/.exec(url)[1]), 9999, [channel(1)]))
    const { ui } = await renderList()
    expect(mocks.fetch).toHaveBeenCalledTimes(MAX_PAGES)
    expect(ui.current.notificationListState.notifications).toHaveLength(MAX_PAGES)
  })

  it('drops the pages of a rule that is no longer open', async () => {
    let releaseFirst
    mocks.fetch
      .mockImplementationOnce(() => new Promise(resolve => { releaseFirst = () => resolve(page(1, 2, [channel(99)])) }))
      .mockImplementation(async () => ok([{ id: 20, channel: 'sms', title: 'Push', body: 'Hi', enabled: true }]))
    const ui = { current: null }
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    const view = render(<RecoveryNotificationList UIComponent={UIComponent} action={RULE} />)
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1))
    view.rerender(<RecoveryNotificationList UIComponent={UIComponent} action={{ id: 2 }} />)
    await waitFor(() => expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([20]))
    await act(async () => { releaseFirst() })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([20])
  })
})

describe('RecoveryNotificationList · handleUpdateClick (RA-B1 / M-RA17)', () => {
  it('resolves { ok: true, error: null, channel }, updates by copy and tells the page the new list', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    const before = ui.current.notificationListState.notifications
    const firstChannel = before[0]
    answerAfterLoad(async () => ok({ id: 10, enabled: false }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateClick(10, { enabled: false }) })

    expect(outcome).toEqual({ ok: true, error: null, channel: { id: 10, enabled: false } })
    const [url, options] = lastCall()
    expect(url).toBe('https://api.test/event_rules/1/channels/10')
    expect(options.method).toBe('PUT')
    expect(options.body).toBe(JSON.stringify({ enabled: false }))
    const after = ui.current.notificationListState.notifications
    expect(after[0]).toMatchObject({ id: 10, enabled: false, title: 'Hi', channel: 'email' })
    expect(after[1]).toBe(before[1])
    expect(after).not.toBe(before)
    expect(firstChannel.enabled).toBe(true)
    expect(onChannelsChange).toHaveBeenCalledTimes(1)
    expect(onChannelsChange).toHaveBeenCalledWith(1, after)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Notification saved')
  })

  it('an API error resolves { ok: false, error } and changes nothing', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    const before = ui.current.notificationListState.notifications
    answerAfterLoad(async () => fail(['Not allowed']))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateClick(10, { enabled: false }) })

    expect(outcome).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.current.notificationListState.notifications).toBe(before)
    expect(ui.current.notificationListState.notifications[0].enabled).toBe(true)
    expect(onChannelsChange).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Notification saved')
  })

  it('a request that throws resolves { ok: false, error: [message] }', async () => {
    const { ui } = await renderList()
    answerAfterLoad(async () => { throw new Error('network down') })

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateClick(10, { enabled: false }) })

    expect(outcome).toEqual({ ok: false, error: ['network down'] })
    expect(ui.current.actionState.loading).toBe(false)
  })
})

describe('RecoveryNotificationList · add, save and delete (RA-B1 / decision 5)', () => {
  it('handleAddChannel POSTs an enabled channel, appends it and tells the page', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    answerAfterLoad(async (url, options) => ok({ id: 12, event_rule_id: 1, ...JSON.parse(options.body) }))

    let outcome
    await act(async () => {
      outcome = await ui.current.handleAddChannel({ channel: 'notification', title: 'Push', body: 'Hi', enabled: true })
    })

    const [url, options] = lastCall()
    expect(url).toBe('https://api.test/event_rules/1/channels')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ enabled: true, channel: 'notification', title: 'Push', body: 'Hi' })
    expect(outcome.ok).toBe(true)
    expect(outcome.error).toBeNull()
    expect(outcome.channel).toMatchObject({ id: 12, channel: 'notification' })
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([10, 11, 12])
    expect(onChannelsChange).toHaveBeenCalledWith(1, ui.current.notificationListState.notifications)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Notification added')
  })

  it('handleAddChannel allows a channel that already exists (duplicates are valid)', async () => {
    const { ui } = await renderList()
    answerAfterLoad(async (url, options) => ok({ id: 13, ...JSON.parse(options.body) }))

    await act(async () => { await ui.current.handleAddChannel({ channel: 'email', title: 'Again', body: 'x', enabled: true }) })

    expect(ui.current.notificationListState.notifications.filter(item => item.channel === 'email')).toHaveLength(2)
  })

  it('handleAddChannel resolves { ok: false, error } and leaves the list as it was', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    const before = ui.current.notificationListState.notifications
    answerAfterLoad(async () => fail(['Body is required']))

    let outcome
    await act(async () => { outcome = await ui.current.handleAddChannel({ channel: 'sms', title: 'x', body: '', enabled: true }) })

    expect(outcome).toEqual({ ok: false, error: ['Body is required'] })
    expect(ui.current.notificationListState.notifications).toBe(before)
    expect(onChannelsChange).not.toHaveBeenCalled()
  })

  it('handleSaveChannel PUTs title and body only, by copy, and tells the page', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    const before = ui.current.notificationListState.notifications
    answerAfterLoad(async (url, options) => ok({ id: 11, ...JSON.parse(options.body) }))

    let outcome
    await act(async () => { outcome = await ui.current.handleSaveChannel(11, { title: 'New title', body: 'New body' }) })

    const [url, options] = lastCall()
    expect(url).toBe('https://api.test/event_rules/1/channels/11')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ title: 'New title', body: 'New body' })
    expect(outcome.ok).toBe(true)
    expect(outcome.channel).toMatchObject({ id: 11, title: 'New title' })
    expect(ui.current.notificationListState.notifications[1]).toMatchObject({ id: 11, title: 'New title', body: 'New body', channel: 'sms', enabled: false })
    expect(before[1].title).toBe('Text')
    expect(onChannelsChange).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Notification saved')
  })

  it('handleSaveChannel resolves { ok: false, error } on failure', async () => {
    const { ui } = await renderList()
    const before = ui.current.notificationListState.notifications
    answerAfterLoad(async () => { throw new Error('network down') })

    let outcome
    await act(async () => { outcome = await ui.current.handleSaveChannel(11, { title: 'x', body: 'y' }) })

    expect(outcome).toEqual({ ok: false, error: ['network down'] })
    expect(ui.current.notificationListState.notifications).toBe(before)
  })

  it('handleDeleteChannel DELETEs, removes the channel and tells the page', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    answerAfterLoad(async () => ok({}))

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteChannel(10) })

    const [url, options] = lastCall()
    expect(url).toBe('https://api.test/event_rules/1/channels/10')
    expect(options.method).toBe('DELETE')
    expect(outcome).toEqual({ ok: true, error: null })
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([11])
    expect(onChannelsChange).toHaveBeenCalledWith(1, [expect.objectContaining({ id: 11 })])
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Notification deleted')
  })

  it('handleDeleteChannel resolves { ok: false, error } and keeps the channel', async () => {
    const onChannelsChange = vi.fn()
    const { ui } = await renderForWrites(onChannelsChange)
    answerAfterLoad(async () => fail(['Cannot delete']))

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteChannel(10) })

    expect(outcome).toEqual({ ok: false, error: ['Cannot delete'] })
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([10, 11])
    expect(onChannelsChange).not.toHaveBeenCalled()
  })

  it('two changes in a row both land (the second reads the list the first left)', async () => {
    const { ui } = await renderList()
    answerAfterLoad(async (url, options) => options.method === 'DELETE' ? ok({}) : ok({ id: 10, ...JSON.parse(options.body) }))

    await act(async () => {
      await ui.current.handleUpdateClick(10, { enabled: false })
      await ui.current.handleDeleteChannel(11)
    })

    expect(ui.current.notificationListState.notifications).toEqual([expect.objectContaining({ id: 10, enabled: false })])
  })
})

describe('RecoveryNotificationList · what main exposes keeps working', () => {
  it('still exposes the old handlers and actionState', async () => {
    const { ui } = await renderList()
    for (const name of ['actionState', 'notificationListState', 'handleAddNotifications', 'handleUpdateNotifications', 'handleDeleteNotifications', 'handleUpdateClick']) {
      expect(ui.current[name], name).not.toBeUndefined()
    }
    await act(async () => { ui.current.handleAddNotifications({ id: 50, channel: 'sms' }) })
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([10, 11, 50])
    await act(async () => { ui.current.handleDeleteNotifications({ id: 50 }) })
    expect(ui.current.notificationListState.notifications.map(item => item.id)).toEqual([10, 11])
  })

  it('handleUpdateNotifications no longer mutates the previous item', async () => {
    const { ui } = await renderList()
    const first = ui.current.notificationListState.notifications[0]
    await act(async () => { ui.current.handleUpdateNotifications({ id: 10, title: 'Changed' }) })
    expect(first.title).toBe('Hi')
    expect(ui.current.notificationListState.notifications[0].title).toBe('Changed')
  })
})
