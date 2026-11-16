/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign bugs-d row 60 (M-DL17): a failed schedule save keeps the pending edits, so the panel still sees them as dirty
const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  session: { token: 'token', user: { id: 1, level: 0 } }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.chain, { configurations: {} }] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { UserDetails } from '..'

const USER = { id: 7, name: 'Ana', lastname: 'Lopez', level: 4 }
const EDITS = [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }] }]

const makeChain = () => {
  const chain = { root: 'https://api.test' }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.save = vi.fn()
  return chain
}

const renderDetails = () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UserDetails UIComponent={UIComponent} userId={USER.id} user={{ ...USER }} />)
  return ui
}

const editAndSave = async (ui) => {
  await act(async () => { ui.current.handleScheduleState(EDITS) })
  expect(ui.current.scheduleState.change).toEqual(EDITS)
  await act(async () => { await ui.current.handleScheduleUpdateUser() })
}

describe('UserDetails · handleScheduleUpdateUser keeps the edits on failure (M-DL17)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
  })

  it('a successful save clears the pending edits', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { schedule: [] } } })
    const ui = renderDetails()

    await editAndSave(ui)

    expect(mocks.chain.save).toHaveBeenCalledWith({ schedule: JSON.stringify(EDITS) }, { accessToken: 'token' })
    expect(ui.current.scheduleState).toEqual({ loading: false, error: false, change: [] })
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Schedule Updated')
  })

  it('an API error keeps the pending edits and shows the API message', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Invalid lapse'] } })
    const ui = renderDetails()

    await editAndSave(ui)

    expect(ui.current.scheduleState).toEqual({ loading: false, error: true, change: EDITS })
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'Invalid lapse')
  })

  it('a plain string result is shown as is', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: 'Schedule overlaps' } })
    const ui = renderDetails()

    await editAndSave(ui)

    expect(ui.current.scheduleState.change).toEqual(EDITS)
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'Schedule overlaps')
  })

  it('a result that is not readable text keeps the current failure text', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: { code: 500 } } })
    const ui = renderDetails()

    await editAndSave(ui)

    expect(ui.current.scheduleState.change).toEqual(EDITS)
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'Schedule Update Failed')
  })

  it('a request that throws keeps the pending edits too', async () => {
    mocks.chain.save.mockRejectedValue(new Error('network down'))
    const ui = renderDetails()

    await editAndSave(ui)

    expect(ui.current.scheduleState).toEqual({ loading: false, error: true, change: EDITS })
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'network down')
  })
})
