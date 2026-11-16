/* eslint-disable import/first */
// a drivers manager's edited selection is stored in one go, with one request per group that changes, adding
// (POST) or removing (DELETE) only this user: drivergroups/{id}/administrators/{user_id} ().
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
const loadedGroups = () => ([
  { id: 1, name: 'North', drivers: [{ id: 5 }], administrators: [{ id: USER_ID }] },
  { id: 2, name: 'South', drivers: [{ id: USER_ID }], administrators: [{ id: 99 }] },
  { id: 3, name: 'East', drivers: [], administrators: [{ id: USER_ID }, { id: 99 }] }
])

let calls = []
let failFor = null
let failReads = false

const reply = (body) => Promise.resolve({ ok: true, json: async () => body })
const fakeFetch = (url, options = {}) => {
  const method = options.method || 'GET'
  calls.push({ url, method, body: options.body })
  if (method === 'GET') return reply(failReads ? { error: true, result: ['Read failed'] } : { error: false, result: loadedGroups() })
  const id = Number(url.match(/\/drivergroups\/(\d+)\/administrators\/\d+$/)[1])
  if (id === failFor) return reply({ error: true, result: ['Not allowed'] })
  // An answer without the administrators: what is drawn after a save must not depend on them
  return reply({ error: false, result: { id } })
}

const mount = async () => {
  await act(async () => { render(<DriverGroupSetting userId={USER_ID} isDriverManager UIComponent={UI} />) })
  await act(async () => {})
}
const save = async (ids) => {
  let answer
  await act(async () => { answer = await ui.handleSaveAdministrators(ids) })
  return answer
}
const writes = () => calls.filter(call => call.method !== 'GET').map(call => [call.method, call.url])
const adminUrl = (id) => `${ROOT}/drivergroups/${id}/administrators/${USER_ID}`

beforeEach(() => {
  ui = null
  calls = []
  failFor = null
  failReads = false
  toast.showToast.mockClear()
  global.fetch = vi.fn(fakeFetch)
})

describe('DriverGroupSetting · handleSaveAdministrators', () => {
  it('adds one group: one POST for this user, nothing else', async () => {
    await mount()
    const answer = await save([1, 2, 3])
    expect(writes()).toEqual([['POST', adminUrl(2)]])
    expect(answer.failed).toEqual([])
    expect(ui.includedGroupIds).toEqual([1, 2, 3])
    expect(toast.showToast).toHaveBeenCalledTimes(1)
    expect(toast.showToast).toHaveBeenCalledWith('success', 'Changes saved')
  })

  it('removes groups: one DELETE per group, and none sends a list of administrators', async () => {
    await mount()
    await save([])
    expect(writes()).toEqual([['DELETE', adminUrl(1)], ['DELETE', adminUrl(3)]])
    expect(calls.filter(call => call.method !== 'GET').every(call => call.body === undefined)).toBe(true)
    expect(ui.includedGroupIds).toEqual([])
  })

  it('mixes additions and removals, never the membership route', async () => {
    await mount()
    await save([2, 3])
    expect(writes()).toEqual([['DELETE', adminUrl(1)], ['POST', adminUrl(2)]])
    expect(ui.includedGroupIds).toEqual([2, 3])
    expect(calls.some(call => call.url.endsWith(`/users/${USER_ID}/drivergroups`))).toBe(false)
  })

  it('does not read the groups before writing', async () => {
    await mount()
    const reads = calls.length
    await save([1, 2, 3])
    expect(calls).toHaveLength(reads + 1)
  })

  it('writes nothing when the selection is what is stored', async () => {
    await mount()
    const reads = calls.length
    const answer = await save([1, 3])
    expect(calls).toHaveLength(reads)
    expect(answer.failed).toEqual([])
    expect(toast.showToast).not.toHaveBeenCalled()
  })

  it('a partial failure names the group, stores the rest and shows no success', async () => {
    await mount()
    failFor = 1
    const answer = await save([])
    expect(writes()).toHaveLength(2)
    expect(answer.failed).toEqual([{ id: 1, name: 'North', errors: ['Not allowed'] }])
    expect(ui.includedGroupIds).toEqual([1])
    expect(ui.actionState).toEqual({ loading: false, error: null })
    expect(toast.showToast).not.toHaveBeenCalled()
  })

  it('a failed first read reports the error, and reloadGroups clears it', async () => {
    failReads = true
    await mount()
    expect(ui.driversGroupsState).toMatchObject({ loading: false, loaded: false, error: ['Read failed'] })
    failReads = false
    await act(async () => { await ui.reloadGroups() })
    expect(ui.driversGroupsState).toMatchObject({ loading: false, loaded: true, error: null })
    expect(ui.includedGroupIds).toEqual([1, 3])
  })
})
