/* eslint-disable import/first */
// redesign bugs E: a new product option was created 750 ms after the last key, so a pause while typing created
// «Siz» instead of «Size», and Enter before the pause closed the form without creating anything. Now the option is created
// with Enter or the «Add» button, with the whole name, once.
import React from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  ProductExtras: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../Shared', () => ({ Alert: () => null, Confirm: () => null, Modal: () => null }))
vi.mock('../../../../utils', () => ({ addQueryToUrl: vi.fn(), removeQueryToUrl: vi.fn() }))
vi.mock('../../ProductExtraOptions', () => ({ ProductExtraOptions: () => null }))
vi.mock('../../SnoozeComponent', () => ({ SnoozeComponent: () => null }))

import { ProductExtras } from '../index'

const draw = (over = {}) => {
  const props = {
    productState: { product: { extras: [] } },
    extrasState: { loading: false, extras: [] },
    isAddMode: true,
    setIsExtendExtraOpen: vi.fn(),
    handleProductExtraState: vi.fn(),
    handleUpdateExtraState: vi.fn(),
    handleChangeExtraInput: vi.fn(),
    handleOpenAddForm: vi.fn(),
    handleAddExtra: vi.fn(),
    setExtrasState: vi.fn(),
    business: { id: 3 },
    ...over
  }
  renderWithProviders(<ProductExtras {...props} />, { initialEntries: ['/stores/list'], theme: { ...themeJson, images: {} } })
  return props
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ProductExtras · new option', () => {
  it('a pause while typing creates nothing', () => {
    vi.useFakeTimers()
    const props = draw()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Siz' } })
    vi.advanceTimersByTime(2000)
    expect(props.handleAddExtra).not.toHaveBeenCalled()
  })

  it('Enter creates the option with the whole name, once', async () => {
    const user = userEvent.setup()
    const props = draw()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '  Size {Enter}')
    expect(props.handleAddExtra).toHaveBeenCalledTimes(1)
    expect(props.handleAddExtra).toHaveBeenCalledWith({ name: 'Size' })
  })

  it('the «Add» button creates it too, and is off while the name is empty or a request runs', async () => {
    const user = userEvent.setup()
    const props = draw()
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Size')
    await user.click(add)
    expect(props.handleAddExtra).toHaveBeenCalledWith({ name: 'Size' })
    cleanup()
    draw({ extrasState: { loading: true, extras: [] } })
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('Enter with nothing typed closes the form, as before', async () => {
    const user = userEvent.setup()
    const props = draw()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}')
    expect(props.handleAddExtra).toHaveBeenCalledWith()
  })
})
