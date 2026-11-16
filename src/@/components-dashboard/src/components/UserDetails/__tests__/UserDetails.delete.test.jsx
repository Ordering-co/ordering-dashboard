/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign UC-B1 (B1-4): handleDeleteUser resolves its outcome
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

const USER = { id: 7, name: 'Ana', lastname: 'Lopez', level: 3 }

const makeChain = () => {
  const chain = { root: 'https://api.test' }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.delete = vi.fn()
  return chain
}

const renderDetails = (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const handlers = { onClose: vi.fn(), handleSuccessDeleteUser: vi.fn() }
  render(<UserDetails UIComponent={UIComponent} userId={USER.id} user={USER} {...handlers} {...props} />)
  return { ui, ...handlers }
}

describe('UserDetails · handleDeleteUser outcome (UC-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
  })

  it('resolves { ok: true, error: null } and keeps the side effects it had', async () => {
    mocks.chain.delete.mockResolvedValue({ content: { error: false, result: {} } })
    const { ui, onClose, handleSuccessDeleteUser } = renderDetails()

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteUser() })

    expect(outcome).toEqual({ ok: true, error: null })
    expect(mocks.chain.users).toHaveBeenCalledWith(7)
    expect(handleSuccessDeleteUser).toHaveBeenCalledWith(USER)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(ui.current.actionStatus).toEqual({ loading: false, error: null })
    expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'User deleted')
  })

  it('resolves { ok: false, error } with the API strings on an API error, and does not close nor notify', async () => {
    mocks.chain.delete.mockResolvedValue({ content: { error: true, result: ['User has orders'] } })
    const { ui, onClose, handleSuccessDeleteUser } = renderDetails()

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteUser() })

    expect(outcome).toEqual({ ok: false, error: ['User has orders'] })
    expect(handleSuccessDeleteUser).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['User has orders'] })
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'User deleted')
  })

  it('never returns an object as error: a result that is not an array of strings becomes null', async () => {
    const { ui } = renderDetails()

    for (const result of ['User has orders', { message: 'User has orders' }, [{ message: 'x' }], null]) {
      mocks.chain.delete.mockResolvedValueOnce({ content: { error: true, result } })
      let outcome
      await act(async () => { outcome = await ui.current.handleDeleteUser() })
      expect(outcome).toEqual({ ok: false, error: null })
    }
  })

  it('resolves { ok: false } when the request throws, and keeps recording the message in actionStatus', async () => {
    mocks.chain.delete.mockRejectedValue(new Error('network down'))
    const { ui, onClose } = renderDetails()

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteUser() })

    expect(outcome).toEqual({ ok: false, error: null })
    expect(onClose).not.toHaveBeenCalled()
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['network down'] })
  })
})
