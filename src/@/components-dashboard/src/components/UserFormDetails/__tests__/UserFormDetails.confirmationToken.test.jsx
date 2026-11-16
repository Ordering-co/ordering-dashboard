/* eslint-disable import/first */
// `handleButtonUpdateClick`'s 4th argument (the ConfirmAdmin confirmation_token, action
// `user_admin_level`) rides on the save request as `confirmation_token`, and never lands in `formState.changes`
// (a failed save must not leave it in the draft the person can still edit, nor resend a used-up token on retry).
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ save: vi.fn(), ordering: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ loading: false, token: 'token', user: { id: 1, level: 0 } }, { changeUser: vi.fn() }]
}))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ValidationsFieldsContext', () => ({
  useValidationFields: () => [{ loading: false, fields: {} }]
}))

import { UserFormDetails } from '..'

const USER = { id: 7, name: 'Ana', level: 3 }

const mountController = (props) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<UserFormDetails UIComponent={UIComponent} useDefualtSessionManager user={USER} {...props} />)
  return ui
}

describe('UserFormDetails controller · confirmation_token on handleButtonUpdateClick', () => {
  beforeEach(() => {
    mocks.save.mockReset()
    mocks.ordering = { root: 'https://api.test', users: () => ({ save: mocks.save }) }
  })

  it('a confirmed level-0 change sends confirmation_token with the level change', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, level: 0 } } })
    const ui = mountController()

    await act(async () => { await ui.current.handleButtonUpdateClick({ level: 0 }, undefined, undefined, 'tok-admin-1') })

    expect(mocks.save).toHaveBeenCalledWith({ level: 0, confirmation_token: 'tok-admin-1' }, { accessToken: 'token' })
  })

  it('without a token (no level-0 change), the save carries no confirmation_token, as before', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, name: 'Bea' } } })
    const ui = mountController()

    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Bea' }) })

    expect(mocks.save).toHaveBeenCalledWith({ name: 'Bea' }, { accessToken: 'token' })
  })

  it('a failed confirmed save keeps the field changes in the draft but never the token', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['nope'] } })
    const ui = mountController()

    await act(async () => { await ui.current.handleButtonUpdateClick({ level: 0 }, undefined, undefined, 'tok-admin-1') })

    expect(ui.current.formState.changes).toEqual({ level: 0 })
    expect(ui.current.formState.changes.confirmation_token).toBeUndefined()
  })
})
