/* eslint-disable import/first */
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// P12 (D-15): the session user's own profile on Product pieces. The UserFormDetails controller is a stand-in with its
// contract: `formState`, `userState`, `handleChangeInput(event | many, isMany)`, `handleButtonUpdateClick(changes)`.
const state = vi.hoisted(() => ({ save: null, controllerProps: null }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: null }]
}))
vi.mock('../../Shared/Product/PhoneField', () => ({
  PhoneField: ({ label, value }) => <label>{label}<input readOnly value={value} /></label>
}))
vi.mock('../../../../../components/UserFormDetails', () => ({
  UserFormDetails: (props) => {
    state.controllerProps = props
    const { UIComponent } = props
    const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
    const handleChangeInput = (event) => setFormState(current => ({ ...current, changes: { ...current.changes, [event.target.name]: event.target.value } }))
    const handleButtonUpdateClick = async (extra) => {
      setFormState(current => ({ ...current, loading: true }))
      const result = await state.save({ ...formState.changes, ...extra })
      setFormState(current => ({ loading: false, changes: result.error ? current.changes : {}, result }))
    }
    return (
      <UIComponent
        {...props}
        formState={formState}
        userState={{ result: { result: props.user } }}
        handleChangeInput={handleChangeInput}
        handleButtonUpdateClick={handleButtonUpdateClick}
        setCellphoneStartZero={() => {}}
      />
    )
  }
}))

import { ProfileEditForm } from '../ProfilePage/ProfileEditForm'

const OWNER = { id: 2, level: 2, name: 'Ana', lastname: 'Soto', email: 'ana@shop.test', cellphone: '5550100', country_phone_code: '1' }

describe('ProfileEditForm (P12)', () => {
  it('edits the session user, with the name, last name, email, phone and password, and no user type', () => {
    state.save = vi.fn()
    renderWithProviders(<ProfileEditForm user={OWNER} />)
    expect(state.controllerProps).toMatchObject({ user: OWNER, userData: OWNER, useSessionUser: true })
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ana')
    expect(screen.getByRole('textbox', { name: /Last name/ })).toHaveValue('Soto')
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ana@shop.test')
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toHaveValue('+1 5550100')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.queryByText('User type')).toBeNull()
  })

  it('saves only what changed and says «Saved»', async () => {
    const user = userEvent.setup()
    // a network answer comes after a render with `loading: true`, as the real request does
    state.save = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({ error: false, result: { id: 2 } }), 0)))
    renderWithProviders(<ProfileEditForm user={OWNER} />)
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Bea')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(state.save).toHaveBeenCalledWith({ name: 'Bea' })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('sends nothing without a change', async () => {
    const user = userEvent.setup()
    state.save = vi.fn()
    renderWithProviders(<ProfileEditForm user={OWNER} />)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(state.save).not.toHaveBeenCalled()
  })

  it('keeps what was typed and says the API error', async () => {
    const user = userEvent.setup()
    state.save = vi.fn(async () => ({ error: true, result: ['The email is already taken'] }))
    renderWithProviders(<ProfileEditForm user={OWNER} />)
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The email is already taken'))
    expect(screen.getByLabelText('Password')).toHaveValue('secret123')
  })
})
