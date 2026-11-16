/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign (row 90, I#23): handleUpdateClick merged the incoming `changes` into `formState.changes`
// by assigning to the state object. It now builds a local object; what is saved and what is kept stays the same.
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  ordering: null
}))

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
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UserFormDetails UIComponent={UIComponent} useDefualtSessionManager user={USER} {...props} />)
  return ui
}

describe('UserFormDetails controller · handleButtonUpdateClick (row 90, I#23)', () => {
  beforeEach(() => {
    mocks.save.mockReset()
    mocks.ordering = { root: 'https://api.test', users: () => ({ save: mocks.save }) }
  })

  it('does not mutate the formState object it was rendered with', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, name: 'Bea' } } })
    const ui = mountController()
    const rendered = ui.current.formState
    const renderedChanges = rendered.changes

    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Bea' }) })

    expect(rendered.changes).toBe(renderedChanges)
    expect(rendered.changes).toEqual({})
    // behaviour: the merged changes are what was saved
    expect(mocks.save).toHaveBeenCalledWith({ name: 'Bea' }, { accessToken: 'token' })
  })

  it('merges the incoming changes over the pending ones and adds the cellphone typed with a leading zero', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
    const ui = mountController()
    await act(async () => {
      ui.current.handleChangeInput({ target: { name: 'lastname', value: 'Soto' } })
      ui.current.setCellphoneStartZero('0555')
    })
    const rendered = ui.current.formState
    const renderedChanges = rendered.changes

    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Bea' }) })

    expect(rendered.changes).toBe(renderedChanges)
    expect(rendered.changes).toEqual({ lastname: 'Soto' })
    expect(mocks.save).toHaveBeenCalledWith({ lastname: 'Soto', name: 'Bea', cellphone: '0555' }, { accessToken: 'token' })
  })

  it('keeps the merged changes in the form when the save fails', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['nope'] } })
    const ui = mountController()

    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Bea' }) })

    expect(ui.current.formState.changes).toEqual({ name: 'Bea' })
    expect(ui.current.formState.result.error).toBe(true)
  })

  it('keeps the merged changes in the form when the request throws', async () => {
    mocks.save.mockRejectedValue(new Error('boom'))
    const ui = mountController()

    await act(async () => { await ui.current.handleButtonUpdateClick({ name: 'Bea' }) })

    expect(ui.current.formState.changes).toEqual({ name: 'Bea' })
    expect(ui.current.formState.result).toEqual({ error: true, result: 'boom' })
  })
})
