/* eslint-disable import/first */
// the groups section of a driver adds or removes only that user in each group (POST/DELETE
// drivergroups/{id}/drivers/{user_id}) instead of rewriting the group's whole list from this page's copy. A drivers
// manager's section: DriverGroupSetting.saveAdministrators.test.jsx.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const ROOT = 'http://api/v400/en/development'
const groups = () => ([
  { id: 1, name: 'North', drivers: [{ id: 5 }], administrators: [{ id: USER_ID }] },
  { id: 2, name: 'South', drivers: [{ id: USER_ID }, { id: 5 }], administrators: [{ id: 99 }] }
])

let calls = []
const reply = (body) => Promise.resolve({ ok: true, json: async () => body })
const fakeFetch = (url, options = {}) => {
  const method = options.method || 'GET'
  calls.push([method, url, options.body ? JSON.parse(options.body) : undefined])
  if (method === 'GET') return reply({ error: false, result: groups() })
  return reply({ error: false, result: { drivers: [], administrators: [] } })
}

const mount = async (props) => {
  await act(async () => {
    render(<DriverGroupSetting userId={USER_ID} UIComponent={UI} {...props} />)
  })
  await act(async () => {})
}
const writes = () => calls.filter(([method]) => method !== 'GET')

beforeEach(() => {
  ui = null
  calls = []
  toast.showToast.mockClear()
  global.fetch = vi.fn(fakeFetch)
})

describe('DriverGroupSetting · per item membership', () => {
  it('adds the driver to a group and removes it from another, one request each', async () => {
    await mount({})
    await act(async () => { await ui.handleCheckboxClick(1) })
    await act(async () => { await ui.handleCheckboxClick(2) })
    expect(writes()).toEqual([
      ['POST', `${ROOT}/drivergroups/1/drivers/${USER_ID}`, undefined],
      ['DELETE', `${ROOT}/drivergroups/2/drivers/${USER_ID}`, undefined]
    ])
  })
})
