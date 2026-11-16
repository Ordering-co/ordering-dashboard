/* eslint-disable import/first */
// redesign stores-devices: the device controller answers `{ ok }` or `{ ok: false, error }`, keeps the panel on a new
// device when the page asks for it (DV-06, D3) and closes it as in main when it does not, sends nothing when nothing changed
// (DV-05) and drops the owner of the previous store when the store changes (DV-03).
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn(),
  hideToast: vi.fn(),
  onClose: vi.fn(),
  onCreated: vi.fn(),
  update: vi.fn()
}))

const session = vi.hoisted(() => ({ user: { level: 1, id: 1 }, usersGet: null, usersWhere: null, businessId: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: session.user }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const sdk = {
    select: () => sdk,
    asDashboard: () => sdk,
    where: () => sdk,
    // a second page of stores (R-1) brings other stores only
    get: () => Promise.resolve({
      content: session.user.level === 0
        ? { error: false, result: { id: session.businessId, owners: session.businessId === 11 ? [] : [{ id: 39, name: 'Daniel', lastname: 'Morgan' }] } }
        : globalThis.__nextBusinesses
          ? { error: false, result: [{ id: 11, name: 'Subway', owners: [] }] }
          : { error: false, result: [{ id: 2, name: 'Fast Bite', owners: [{ id: 9, name: 'Ana' }] }, { id: 6, name: "Dono's Pizza", owners: [{ id: 39, name: 'Daniel', lastname: 'Morgan' }] }] }
    })
  }
  const users = {
    where: (conditions) => {
      session.usersWhere(conditions)
      return users
    },
    select: () => users,
    get: () => session.usersGet()
  }
  const businesses = (id) => {
    session.businessId = id
    return sdk
  }
  const ordering = { root: 'https://api.test', businesses, users: () => users, setAccessToken: () => ordering }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessDeviceDetail } from '../index'

const DEVICE = { id: 34, name: 'Kiosk', code: 'wdzuyd', business_id: 6, user_id: 39, business: { id: 6, name: "Dono's Pizza" }, user: { id: 39, name: 'Daniel' } }
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = (props = {}) => {
  const UI = (p) => {
    ui = p
    return null
  }
  return render(
    <BusinessDeviceDetail
      UIComponent={UI}
      devices={[DEVICE]}
      handleUpdateDeviceList={mocks.update}
      onClose={mocks.onClose}
      {...props}
    />
  )
}

const ADMINS = [{ id: 1, name: 'Rita', lastname: 'Root' }, { id: 7, name: 'Sam', lastname: 'Super' }]

beforeEach(() => {
  globalThis.__nextBusinesses = false
  session.user = { level: 1, id: 1 }
  session.usersWhere = vi.fn()
  session.usersGet = vi.fn(() => Promise.resolve({ content: { error: false, result: ADMINS } }))
  Object.values(mocks).forEach(mock => mock.mockReset())
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'POST') return json({ error: false, result: { id: 90, code: 'Qp7xZa', ...JSON.parse(options.body) } })
    if (options?.method === 'PUT') return json({ error: false, result: { ...DEVICE, ...JSON.parse(options.body) } })
    if (options?.method === 'DELETE') return json({ error: false, result: {} })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

const writes = () => mocks.fetch.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET')

describe('BusinessDeviceDetail controller', () => {
  it('keeps the panel on the new device when the page gives onCreated (D3)', async () => {
    draw({ selectedDevice: null, onCreated: mocks.onCreated })
    await waitFor(() => expect(ui.businessList.businesses.length).toBe(2))
    act(() => ui.handleChangeFormState({ name: 'Lobby' }))
    act(() => ui.handleChangeFormState({ business_id: 6 }))
    act(() => ui.handleChangeFormState({ user_id: 39 }))
    let answer
    await act(async () => { answer = await ui.addDevice() })
    expect(answer.ok).toBe(true)
    expect(JSON.parse(writes()[0][1].body)).toEqual({ name: 'Lobby', business_id: 6, user_id: 39 })
    expect(mocks.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 90, code: 'Qp7xZa', user: expect.objectContaining({ id: 39 }) }))
    expect(mocks.onClose).not.toHaveBeenCalled()
    expect(ui.formState.changes).toEqual({})
  })

  it('closes after creating, as in main, without onCreated', async () => {
    draw({ selectedDevice: null })
    await waitFor(() => expect(ui.businessList.businesses.length).toBe(2))
    act(() => ui.handleChangeFormState({ name: 'Lobby', business_id: 2 }))
    await act(async () => { await ui.addDevice() })
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
  })

  it('drops the owner chosen for the previous store (DV-03)', async () => {
    draw({ selectedDevice: null })
    act(() => ui.handleChangeFormState({ business_id: 2 }))
    act(() => ui.handleChangeFormState({ user_id: 9 }))
    act(() => ui.handleChangeFormState({ business_id: 6 }))
    expect(ui.formState.changes).toEqual({ business_id: 6 })
  })

  it('sends nothing when nothing changed (DV-05) and clears the draft after a save', async () => {
    draw({ selectedDevice: DEVICE })
    let answer
    await act(async () => { answer = await ui.updateDevice() })
    expect(answer).toEqual({ ok: true, unchanged: true })
    expect(writes()).toHaveLength(0)
    act(() => ui.handleChangeFormState({ name: 'Renamed' }))
    await act(async () => { answer = await ui.updateDevice() })
    expect(answer.ok).toBe(true)
    // main the device's own user goes with every edit, so the API accepts it
    expect(JSON.parse(writes()[0][1].body)).toEqual({ business_id: 6, user_id: 39, name: 'Renamed' })
    expect(ui.formState.changes).toEqual({})
  })

  it('sends nothing when a value is typed back to what the device has (R-2)', async () => {
    draw({ selectedDevice: DEVICE })
    act(() => ui.handleChangeFormState({ name: 'Kiosk X' }))
    act(() => ui.handleChangeFormState({ name: 'Kiosk' }))
    let answer
    await act(async () => { answer = await ui.updateDevice() })
    expect(answer).toEqual({ ok: true, unchanged: true })
    expect(writes()).toHaveLength(0)
    expect(ui.formState.changes).toEqual({})
  })

  it('keeps the chosen store when the store list moves to another page (R-1)', async () => {
    draw({ selectedDevice: null, onCreated: mocks.onCreated })
    await waitFor(() => expect(ui.businessList.businesses.length).toBe(2))
    act(() => ui.handleChangeFormState({ name: 'Lobby', business_id: 6 }))
    expect(ui.chosenBusiness).toEqual(expect.objectContaining({ id: 6, name: "Dono's Pizza" }))
    // another page of stores, without Dono's Pizza
    act(() => ui.handleChangeFormState({ user_id: 39 }))
    globalThis.__nextBusinesses = true
    await act(async () => { await ui.handleChangeBusinessPage(2) })
    expect(ui.chosenBusiness).toEqual(expect.objectContaining({ id: 6 }))
    await act(async () => { await ui.addDevice() })
    expect(mocks.onCreated).toHaveBeenCalledWith(expect.objectContaining({
      business: expect.objectContaining({ id: 6, name: "Dono's Pizza" }),
      user: expect.objectContaining({ id: 39 })
    }))
  })

  it('answers a failed delete without closing, and a good one closing', async () => {
    draw({ selectedDevice: DEVICE })
    mocks.fetch.mockImplementation((url, options) => options?.method === 'DELETE' ? json({ error: true, result: ['Not allowed'] }) : json({ error: false, result: [] }))
    let answer
    await act(async () => { answer = await ui.deleteDevice() })
    expect(answer).toEqual({ ok: false, error: ['Not allowed'] })
    expect(mocks.onClose).not.toHaveBeenCalled()
    mocks.fetch.mockImplementation(() => json({ error: false, result: {} }))
    await act(async () => { answer = await ui.deleteDevice() })
    expect(answer).toEqual({ ok: true })
    expect(mocks.update).toHaveBeenLastCalledWith([])
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
    // redesign bugs F row 19: only the failed delete hid the «Loading» toast, the good one did not
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  // redesign bugs F row 19: the panel's alert says the failure, so the «Loading» toast must not stay
  it('hides the Loading toast when adding a device fails (API error or thrown), and not when it succeeds', async () => {
    draw({ selectedDevice: null })
    await waitFor(() => expect(ui.businessList.businesses.length).toBe(2))
    act(() => ui.handleChangeFormState({ name: 'Lobby', business_id: 2 }))
    await act(async () => { await ui.addDevice() })
    expect(mocks.hideToast).not.toHaveBeenCalled()

    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Nope'] }))
    act(() => ui.handleChangeFormState({ name: 'Lobby 2', business_id: 2 }))
    await act(async () => { await ui.addDevice() })
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    await act(async () => { await ui.addDevice() })
    expect(mocks.hideToast).toHaveBeenCalledTimes(2)
  })

  it('hides the Loading toast when updating or deleting a device fails (API error or thrown), and not when update succeeds', async () => {
    draw({ selectedDevice: DEVICE })
    act(() => ui.handleChangeFormState({ name: 'Renamed' }))
    await act(async () => { await ui.updateDevice() })
    expect(mocks.hideToast).not.toHaveBeenCalled()

    act(() => ui.handleChangeFormState({ name: 'Renamed 2' }))
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Nope'] }))
    await act(async () => { await ui.updateDevice() })
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    await act(async () => { await ui.updateDevice() })
    expect(mocks.hideToast).toHaveBeenCalledTimes(2)
    await act(async () => { await ui.deleteDevice() })
    expect(mocks.hideToast).toHaveBeenCalledTimes(3)
  })

  it('does not hide the Loading toast when logging out all devices fails: it is replaced by an Error toast', async () => {
    draw({ selectedDevice: DEVICE })
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Nope'] }))
    await act(async () => { await ui.logoutDevice() })
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'error'])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('logs the owner out with main request and answers ok', async () => {
    draw({ selectedDevice: DEVICE })
    let answer
    await act(async () => { answer = await ui.logoutDevice() })
    expect(answer).toEqual({ ok: true })
    expect(writes()[0][0]).toBe('https://api.test/users/39/sessions/all')
    expect(writes()[0][1].method).toBe('DELETE')
  })

  describe('administrators for a store with no owners', () => {
    const asAdmin = () => {
      session.user = { level: 0, id: 1 }
      const write = mocks.fetch.getMockImplementation()
      mocks.fetch.mockImplementation((url, options) => (
        String(url).includes('/backoffice/businesses')
          ? json({ error: false, result: [{ id: 11, name: 'Subway' }, { id: 6, name: "Dono's Pizza" }] })
          : write(url, options)
      ))
    }
    const pick = async (businessId) => {
      await waitFor(() => expect(ui.businessList.businesses.length).toBe(2))
      act(() => ui.handleChangeFormState({ business_id: businessId }))
      await waitFor(() => expect(ui.businessList.businesses.find(business => business.id === businessId).owners).toBeDefined())
    }

    it('an administrator gets the enabled administrators once, and the new device carries the one chosen', async () => {
      asAdmin()
      draw({ selectedDevice: null, onCreated: mocks.onCreated })
      expect(ui.adminList).toBeNull()
      await pick(11)
      await waitFor(() => expect(ui.adminList?.users).toEqual(ADMINS))
      expect(session.usersWhere).toHaveBeenCalledWith([{ attribute: 'level', value: 0 }, { attribute: 'enabled', value: true }])
      act(() => ui.handleChangeFormState({ name: 'Lobby' }))
      act(() => ui.handleChangeFormState({ user_id: 7 }))
      await act(async () => { await ui.addDevice() })
      expect(JSON.parse(writes()[0][1].body)).toEqual({ business_id: 11, name: 'Lobby', user_id: 7 })
      expect(mocks.onCreated).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: 7, name: 'Sam' }) }))
      expect(session.usersGet).toHaveBeenCalledTimes(1)
    })

    it('does not ask for them when the store has owners', async () => {
      asAdmin()
      draw({ selectedDevice: null })
      await pick(6)
      expect(ui.adminList).toBeNull()
      expect(session.usersGet).not.toHaveBeenCalled()
    })

    it('does not ask for them for a user who is not an administrator', async () => {
      globalThis.__nextBusinesses = true
      draw({ selectedDevice: null })
      await waitFor(() => expect(ui.businessList.businesses.map(business => business.id)).toEqual([11]))
      act(() => ui.handleChangeFormState({ business_id: 11 }))
      expect(ui.adminList).toBeNull()
      expect(session.usersGet).not.toHaveBeenCalled()
    })

    it('a failed request is handed as an error and not asked again', async () => {
      asAdmin()
      session.usersGet = vi.fn(() => Promise.resolve({ content: { error: true, result: ['Forbidden'] } }))
      draw({ selectedDevice: null })
      await pick(11)
      await waitFor(() => expect(ui.adminList?.error).toEqual(['Forbidden']))
      expect(ui.adminList.users).toBeNull()
      act(() => ui.handleChangeFormState({ name: 'Lobby' }))
      expect(session.usersGet).toHaveBeenCalledTimes(1)
    })
  })
})
