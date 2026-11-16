/* eslint-disable import/first */
// A driver's «Select all» / «Select none» write the user's group membership. A drivers manager's section edits
// administrators and saves with a bar: DriverGroupSetting.saveAdministrators.test.jsx ().
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stable values, as the real providers give: a new object per render would refetch forever.
const sessionValue = vi.hoisted(() => [{ token: 'tok' }])
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => sessionValue
}))
const apiValue = vi.hoisted(() => [{ root: 'http://api/v400/en/development' }])
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => apiValue
}))
const toast = vi.hoisted(() => ({ showToast: vi.fn() }))
const toastValue = vi.hoisted(() => [null, toast])
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => toastValue,
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
const languageValue = vi.hoisted(() => [null, (_key, fallback) => fallback])
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => languageValue
}))

import { DriverGroupSetting } from '../index'

let ui = null
const UI = (props) => { ui = props; return null }

const USER_ID = 7
const initialGroups = () => ([
  { id: 1, name: 'North', drivers: [{ id: 5 }], administrators: [{ id: USER_ID }] },
  { id: 2, name: 'South', drivers: [{ id: USER_ID }], administrators: [{ id: 99 }] },
  { id: 3, name: 'East', drivers: [], administrators: [{ id: USER_ID }, { id: 99 }] }
])

let calls = []

const reply = (body) => Promise.resolve({ ok: true, json: async () => body })

const fakeFetch = (url, options = {}) => {
  const method = options.method || 'GET'
  const body = options.body ? JSON.parse(options.body) : null
  calls.push({ url, method, body })
  if (method === 'GET' && url.includes('/drivergroups?')) {
    return reply({ error: false, result: initialGroups() })
  }
  if (method === 'POST' && url.endsWith(`/users/${USER_ID}/drivergroups`)) {
    return reply({ error: false, result: {} })
  }
  return reply({ error: false, result: [] })
}

const mount = async (props = {}) => {
  await act(async () => { render(<DriverGroupSetting userId={USER_ID} UIComponent={UI} {...props} />) })
  await act(async () => {})
}

const selectAll = async (isSelectAll) => {
  await act(async () => { await ui.handleSelectAllDriver(isSelectAll) })
}

const writes = () => calls.filter(call => call.method !== 'GET')

beforeEach(() => {
  ui = null
  calls = []
  toast.showToast.mockClear()
  global.fetch = vi.fn(fakeFetch)
})

describe('DriverGroupSetting · a driver\'s select all / none', () => {
  it('driver (not manager) + Select all keeps the membership POST with every group id', async () => {
    await mount({ isDriverManager: false })
    await selectAll(true)

    const sent = writes()
    expect(sent).toHaveLength(1)
    expect(sent[0].method).toBe('POST')
    expect(sent[0].url).toBe(`http://api/v400/en/development/users/${USER_ID}/drivergroups`)
    expect(sent[0].body).toEqual({ driver_group_ids: [1, 2, 3] })
  })

  it('driver (not manager) + Select none keeps the membership POST with an empty list', async () => {
    await mount({ isDriverManager: false })
    await selectAll(false)

    const sent = writes()
    expect(sent).toHaveLength(1)
    expect(sent[0].method).toBe('POST')
    expect(sent[0].body).toEqual({ driver_group_ids: [] })
  })
})
