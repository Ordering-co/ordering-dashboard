/* eslint-disable import/first */
// redesign stores 5.16 (; G2-39, G2-40): the webhooks controller of Store details › Webhooks. Adding, changing a delay
// and deleting say how they went (`{ ok: true, result }` or `{ ok: false, error: [messages] }`), and each has its own busy state
// (`adding`, `savingId`, `deletingId`) so one row's request never flags the others. Same requests as before: POST
// /business/:id/webhooks { hook, url, delay? }, PUT /business/:id/webhooks/:wid with the whole webhook and the new delay,
// DELETE /business/:id/webhooks/:wid. A failed request merges nothing into the store.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text ?? key]
}))

import { BusinessWebhooks } from '../index'

const STORE = {
  id: 2,
  webhooks: [
    { id: 11, hook: 'orders_register', url: 'https://a.test/hook', delay: '0' },
    { id: 12, hook: 'orders_pending', url: 'https://b.test/hook', delay: '300' }
  ]
}

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  return render(<BusinessWebhooks UIComponent={UI} business={STORE} {...props} />)
}

const answer = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) })
const deferred = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, resolve: release }
}

beforeEach(() => {
  mocks.showToast.mockReset()
  global.fetch = vi.fn()
})
afterEach(() => {
  delete global.fetch
})

describe('BusinessWebhooks controller › add', () => {
  it('posts { hook, url } without a delay when none was chosen, and clears the form', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 13, hook: 'orders_rejected', url: 'https://c.test/h' } }))
    draw({ handleSuccessUpdate: onUpdate })
    act(() => { ui.handleChangeSelect('orders_rejected', 'hook') })
    act(() => { ui.handleChangeSelect('https://c.test/h', 'url') })
    let result
    await act(async () => { result = await ui.handleUpdateAddClick() })
    expect(result).toEqual({ ok: true, result: { id: 13, hook: 'orders_rejected', url: 'https://c.test/h' } })
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/2/webhooks')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ hook: 'orders_rejected', url: 'https://c.test/h' })
    expect(onUpdate.mock.calls[0][0].webhooks.map(w => w.id)).toEqual([11, 12, 13])
    expect(ui.hookFormState.changes).toEqual({})
    expect(ui.adding).toBe(false)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Webhook added')
  })

  it('posts { hook, url, delay } when a delay was chosen', async () => {
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 13 } }))
    draw()
    act(() => { ui.handleChangeSelect('orders_rejected', 'hook') })
    act(() => { ui.handleChangeSelect('https://c.test/h', 'url') })
    act(() => { ui.handleChangeSelect('900', 'delay') })
    await act(async () => { await ui.handleUpdateAddClick() })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ hook: 'orders_rejected', url: 'https://c.test/h', delay: '900' })
  })

  it('does not send a delay that was chosen and then cleared', async () => {
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 13 } }))
    draw()
    act(() => { ui.handleChangeSelect('orders_rejected', 'hook') })
    act(() => { ui.handleChangeSelect('https://c.test/h', 'url') })
    act(() => { ui.handleChangeSelect('900', 'delay') })
    act(() => { ui.handleChangeSelect('', 'delay') })
    await act(async () => { await ui.handleUpdateAddClick() })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ hook: 'orders_rejected', url: 'https://c.test/h' })
  })

  it('answers { ok: false } on an error body, keeps what was typed and merges nothing', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: true, result: ['Invalid url'] }))
    draw({ handleSuccessUpdate: onUpdate })
    act(() => { ui.handleChangeSelect('orders_rejected', 'hook') })
    act(() => { ui.handleChangeSelect('nope', 'url') })
    let result
    await act(async () => { result = await ui.handleUpdateAddClick() })
    expect(result).toEqual({ ok: false, error: ['Invalid url'] })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(ui.hookFormState.changes).toEqual({ hook: 'orders_rejected', url: 'nope' })
    expect(ui.adding).toBe(false)
  })

  it('answers { ok: false } when the request throws', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'))
    draw()
    act(() => { ui.handleChangeSelect('orders_rejected', 'hook') })
    act(() => { ui.handleChangeSelect('https://c.test/h', 'url') })
    let result
    await act(async () => { result = await ui.handleUpdateAddClick() })
    expect(result).toEqual({ ok: false, error: ['Failed to fetch'] })
    expect(ui.adding).toBe(false)
  })

  it('is busy (`adding`) only while the request is out', async () => {
    const gate = deferred()
    global.fetch.mockReturnValue(gate.promise)
    draw()
    act(() => { ui.handleChangeSelect('orders_rejected', 'hook') })
    act(() => { ui.handleChangeSelect('https://c.test/h', 'url') })
    let pending
    act(() => { pending = ui.handleUpdateAddClick() })
    expect(ui.adding).toBe(true)
    expect(ui.savingId).toBeNull()
    expect(ui.deletingId).toBeNull()
    await act(async () => { gate.resolve({ ok: true, json: () => Promise.resolve({ error: false, result: { id: 13 } }) }); await pending })
    expect(ui.adding).toBe(false)
  })
})

describe('BusinessWebhooks controller › delay', () => {
  it('puts the whole webhook with the new delay and merges only that delay', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 12, delay: 'pickup_time' } }))
    draw({ handleSuccessUpdate: onUpdate })
    let result
    await act(async () => { result = await ui.handleChangeDelay('pickup_time', STORE.webhooks[1]) })
    expect(result).toEqual({ ok: true, result: { id: 12, delay: 'pickup_time' } })
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/2/webhooks/12')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ id: 12, hook: 'orders_pending', url: 'https://b.test/hook', delay: 'pickup_time' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0][0].webhooks).toEqual([
      STORE.webhooks[0],
      { id: 12, hook: 'orders_pending', url: 'https://b.test/hook', delay: 'pickup_time' }
    ])
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Webhook updated')
  })

  it('does not mutate the webhooks it was given', async () => {
    const frozen = { id: 2, webhooks: Object.freeze([Object.freeze({ id: 12, hook: 'orders_pending', url: 'https://b.test/hook', delay: '300' })]) }
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 12, delay: '600' } }))
    draw({ business: frozen, handleSuccessUpdate: vi.fn() })
    await act(async () => { await ui.handleChangeDelay('600', frozen.webhooks[0]) })
    expect(frozen.webhooks[0].delay).toBe('300')
  })

  it('flags only the row that is saving', async () => {
    const gate = deferred()
    global.fetch.mockReturnValue(gate.promise)
    draw({ handleSuccessUpdate: vi.fn() })
    let pending
    act(() => { pending = ui.handleChangeDelay('900', STORE.webhooks[1]) })
    expect(ui.savingId).toBe(12)
    expect(ui.deletingId).toBeNull()
    expect(ui.adding).toBe(false)
    await act(async () => { gate.resolve({ ok: true, json: () => Promise.resolve({ error: false, result: { id: 12, delay: '900' } }) }); await pending })
    expect(ui.savingId).toBeNull()
  })

  it('keeps EVERY row that is saving flagged (savingIds) until its own request answers', async () => {
    const gateA = deferred()
    const gateB = deferred()
    global.fetch
      .mockReturnValueOnce(gateA.promise)
      .mockReturnValueOnce(gateB.promise)
    draw({ handleSuccessUpdate: vi.fn() })
    let pendingA
    let pendingB
    act(() => { pendingA = ui.handleChangeDelay('900', STORE.webhooks[1]) })
    act(() => { pendingB = ui.handleChangeDelay('600', STORE.webhooks[0]) })
    expect(ui.savingIds).toEqual([12, 11])
    // row B answers first: row A is still busy, it is not unlocked by B's start or end
    await act(async () => { gateB.resolve({ ok: true, json: () => Promise.resolve({ error: false, result: { id: 11, delay: '600' } }) }); await pendingB })
    expect(ui.savingIds).toEqual([12])
    await act(async () => { gateA.resolve({ ok: true, json: () => Promise.resolve({ error: false, result: { id: 12, delay: '900' } }) }); await pendingA })
    expect(ui.savingIds).toEqual([])
    expect(ui.savingId).toBeNull()
  })

  it('keeps `savingId` as the most recent row still saving', async () => {
    const gateA = deferred()
    const gateB = deferred()
    global.fetch
      .mockReturnValueOnce(gateA.promise)
      .mockReturnValueOnce(gateB.promise)
    draw({ handleSuccessUpdate: vi.fn() })
    let pendingA
    let pendingB
    act(() => { pendingA = ui.handleChangeDelay('900', STORE.webhooks[1]) })
    act(() => { pendingB = ui.handleChangeDelay('600', STORE.webhooks[0]) })
    expect(ui.savingId).toBe(11)
    await act(async () => { gateB.resolve({ ok: true, json: () => Promise.resolve({ error: false, result: { id: 11, delay: '600' } }) }); await pendingB })
    expect(ui.savingId).toBe(12)
    await act(async () => { gateA.resolve({ ok: true, json: () => Promise.resolve({ error: true, result: ['Not allowed'] }) }); await pendingA })
    expect(ui.savingId).toBeNull()
  })

  it('answers { ok: false } on an error body and keeps the old delay (nothing is merged)', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: true, result: ['Not allowed'] }))
    draw({ handleSuccessUpdate: onUpdate })
    let result
    await act(async () => { result = await ui.handleChangeDelay('900', STORE.webhooks[1]) })
    expect(result).toEqual({ ok: false, error: ['Not allowed'] })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(ui.savingId).toBeNull()
    expect(STORE.webhooks[1].delay).toBe('300')
  })

  it('answers { ok: false } when the request throws', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockRejectedValue(new Error('Failed to fetch'))
    draw({ handleSuccessUpdate: onUpdate })
    let result
    await act(async () => { result = await ui.handleChangeDelay('900', STORE.webhooks[1]) })
    expect(result).toEqual({ ok: false, error: ['Failed to fetch'] })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(ui.savingId).toBeNull()
  })
})

describe('BusinessWebhooks controller › delete', () => {
  it('deletes one webhook and hands the rest to the shell', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: false, result: 'ok' }))
    draw({ handleSuccessUpdate: onUpdate })
    let result
    await act(async () => { result = await ui.handleDeleteWebhook(11) })
    expect(result.ok).toBe(true)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/2/webhooks/11')
    expect(options.method).toBe('DELETE')
    expect(onUpdate.mock.calls[0][0].webhooks.map(w => w.id)).toEqual([12])
    expect(STORE.webhooks).toHaveLength(2)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Webhook deleted')
  })

  it('flags only the webhook being deleted', async () => {
    const gate = deferred()
    global.fetch.mockReturnValue(gate.promise)
    draw({ handleSuccessUpdate: vi.fn() })
    let pending
    act(() => { pending = ui.handleDeleteWebhook(11) })
    expect(ui.deletingId).toBe(11)
    expect(ui.savingId).toBeNull()
    await act(async () => { gate.resolve({ ok: true, json: () => Promise.resolve({ error: false }) }); await pending })
    expect(ui.deletingId).toBeNull()
  })

  it('answers { ok: false } on an error body and leaves the list', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: true, result: ['Not allowed'] }))
    draw({ handleSuccessUpdate: onUpdate })
    let result
    await act(async () => { result = await ui.handleDeleteWebhook(11) })
    expect(result).toEqual({ ok: false, error: ['Not allowed'] })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(ui.deletingId).toBeNull()
  })

  it('answers { ok: false } when the request throws, and leaves the list', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockRejectedValue(new Error('Failed to fetch'))
    draw({ handleSuccessUpdate: onUpdate })
    let result
    await act(async () => { result = await ui.handleDeleteWebhook(11) })
    expect(result).toEqual({ ok: false, error: ['Failed to fetch'] })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('copes with a store that has no webhooks yet', async () => {
    const onUpdate = vi.fn()
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 1, hook: 'orders_register', url: 'https://a.test' } }))
    draw({ business: { id: 2 }, handleSuccessUpdate: onUpdate })
    act(() => { ui.handleChangeSelect('orders_register', 'hook') })
    act(() => { ui.handleChangeSelect('https://a.test', 'url') })
    await act(async () => { await ui.handleUpdateAddClick() })
    expect(onUpdate.mock.calls[0][0].webhooks.map(w => w.id)).toEqual([1])
  })
})
