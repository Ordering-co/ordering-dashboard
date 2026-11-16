/* eslint-disable import/first */
// the DELETE /orders the controller sends carries the ConfirmAdmin confirmation_token (the API
// checked the password or the OTP server-side before handing it over), and carries nothing extra when
// ConfirmAdmin was given no token (a legacy caller with no `action`). Both callers (the bulk selection and
// the detail header) go through handleDeleteMultiOrders(token, ids). The request is counted at fetch; the
// controller is the real one.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stable values: the controller keeps some of these in an effect's dependencies.
const stable = vi.hoisted(() => ({
  // loading: true keeps the controller from asking for drivers, controls and user settings: only the delete runs.
  session: [{ token: 'test-token', auth: true, loading: true, user: { id: 1, level: 0 } }],
  api: [{ root: 'https://api.test/v400/demo' }],
  config: [{ loading: true, configs: {} }],
  language: [{ language: { id: 1 } }, (_key, text) => text],
  toast: [{}, { showToast: () => {} }],
  socket: { on: () => {}, off: () => {}, join: () => {}, leave: () => {} }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => stable.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => stable.api }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => stable.config }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => stable.language }))
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => stable.toast, ToastType: { Info: 'info', Success: 'success' } }))
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => stable.socket }))

import { OrdersManage } from '../index'

const RealFetch = global.fetch
let calls
let ui

beforeEach(() => {
  calls = []
  ui = null
  global.fetch = vi.fn(async (url, options) => {
    calls.push({ url, options })
    return { json: async () => ({ error: false, result: [] }) }
  })
})

afterEach(() => { global.fetch = RealFetch })

const mount = async () => {
  render(<OrdersManage UIComponent={(props) => { ui = props; return null }} />)
  await waitFor(() => expect(ui).not.toBeNull())
}

const deletes = () => calls.filter(({ options }) => options?.method === 'DELETE')
const bodyOf = (call) => JSON.parse(call.options.body)

describe('OrdersManage · handleDeleteMultiOrders and the confirmation_token', () => {
  it('bulk selection with a token: the DELETE carries confirmation_token and the selected ids', async () => {
    await mount()
    act(() => ui.setSelectedOrderIds([7, 8]))
    await act(async () => { await ui.handleDeleteMultiOrders('482915') })

    expect(deletes()).toHaveLength(1)
    expect(deletes()[0].url).toBe('https://api.test/v400/demo/orders')
    expect(deletes()[0].options.headers.Authorization).toBe('Bearer test-token')
    expect(bodyOf(deletes()[0])).toEqual({ orders_id: [7, 8], confirmation_token: '482915' })
  })

  it('detail header with a token: (token, [id]) sends that one id with confirmation_token', async () => {
    await mount()
    await act(async () => { await ui.handleDeleteMultiOrders('482915', [42]) })

    expect(deletes()).toHaveLength(1)
    expect(deletes()[0].options.headers.Authorization).toBe('Bearer test-token')
    expect(bodyOf(deletes()[0])).toEqual({ orders_id: [42], confirmation_token: '482915' })
  })

  it('with no token the DELETE has no confirmation_token, selection and header', async () => {
    await mount()
    act(() => ui.setSelectedOrderIds([7, 8]))
    await act(async () => { await ui.handleDeleteMultiOrders() })
    await act(async () => { await ui.handleDeleteMultiOrders(null, [42]) })

    expect(deletes()).toHaveLength(2)
    for (const call of deletes()) {
      expect(call.options.headers.Authorization).toBe('Bearer test-token')
    }
    expect(bodyOf(deletes()[0])).toEqual({ orders_id: [7, 8] })
    expect(bodyOf(deletes()[1])).toEqual({ orders_id: [42] })
    expect(Object.keys(bodyOf(deletes()[0]))).not.toContain('confirmation_token')
    expect(Object.keys(bodyOf(deletes()[1]))).not.toContain('confirmation_token')
  })
})
