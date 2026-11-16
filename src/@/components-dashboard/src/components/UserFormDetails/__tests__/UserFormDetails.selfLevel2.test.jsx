/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// P12 (D-15): a level 2 session saves other users through /professionals (api-core lets level 2 edit only
// professionals there), but its own profile must go through /users/{id}: /professionals only finds level 8 users.
const mocks = vi.hoisted(() => ({ save: vi.fn(), usersId: vi.fn(), changeUser: vi.fn(), ordering: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ loading: false, token: 'token', user: { id: 2, level: 2, name: 'Owner' } }, { changeUser: mocks.changeUser }]
}))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ValidationsFieldsContext', () => ({
  useValidationFields: () => [{ loading: false, fields: {} }]
}))

import { UserFormDetails } from '..'

const mountController = (user) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UserFormDetails UIComponent={UIComponent} useDefualtSessionManager user={user} userData={user} />)
  return ui
}

describe('UserFormDetails controller · a level 2 session (P12)', () => {
  beforeEach(() => {
    mocks.save.mockReset().mockResolvedValue({ content: { error: false, result: { id: 2, name: 'Bea' } } })
    mocks.usersId.mockReset()
    mocks.ordering = { root: 'https://api.test', users: (id) => { mocks.usersId(id); return { save: mocks.save } } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ error: false, result: { id: 8 } }) }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves its own profile through /users/{id}', async () => {
    const ui = mountController({ id: 2, level: 2 })
    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Bea' }) })
    expect(mocks.usersId).toHaveBeenCalledWith(2)
    expect(mocks.save).toHaveBeenCalledWith({ name: 'Bea' }, { accessToken: 'token' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('saves its own photo through /users/{id}', async () => {
    const ui = mountController({ id: 2, level: 2 })
    await act(async () => { await ui.current.handleButtonUpdateClick(null, true, 'data:image/png;base64,AA') })
    expect(mocks.save).toHaveBeenCalledWith({ photo: 'data:image/png;base64,AA' }, { accessToken: 'token' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('still saves another user through /professionals/{id}', async () => {
    const ui = mountController({ id: 8, level: 8 })
    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Pro' }) })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('https://api.test/professionals/8', expect.objectContaining({ method: 'POST' }))
  })
})
