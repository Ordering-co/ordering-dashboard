/* eslint-disable import/first */
// redesign bugs F row 25: S-4 / N-2 the product option's Snooze opens in the Product Dialog with a title (it was an
// untitled legacy Modal at 85 %), and S-5 the pencil next to each option has an accessible name («Edit <name>»).
// The controller, the option detail, the legacy Modal / Alert / Confirm and the Snooze body are stand-ins.
import React from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const mocks = vi.hoisted(() => ({ snoozeProps: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  ProductExtras: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../Shared', async () => {
  const React = await import('react')
  return {
    Alert: () => null,
    Confirm: () => null,
    Modal: ({ open, children }) => open ? React.createElement('div', { 'data-testid': 'legacy-modal' }, children) : null
  }
})
vi.mock('../../../../utils', () => ({
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn()
}))
vi.mock('../../ProductExtraOptions', () => ({ ProductExtraOptions: () => null }))
vi.mock('../../SnoozeComponent', () => ({
  SnoozeComponent: (props) => {
    mocks.snoozeProps.push(props)
    return <div data-testid='snooze' />
  }
}))

import { ProductExtras } from '../index'

const EXTRAS = [{ id: 1, name: 'Toppings', rank: 1 }, { id: 2, name: 'Sauces', rank: 2 }]

const draw = () => {
  const props = {
    productState: { product: { extras: [] } },
    extrasState: { loading: false, extras: EXTRAS.map(extra => ({ ...extra })) },
    setIsExtendExtraOpen: vi.fn(),
    handleProductExtraState: vi.fn(),
    handleUpdateExtraState: vi.fn().mockResolvedValue({ ok: true }),
    handleUpdateBusinessState: vi.fn(),
    handleChangeExtraInput: vi.fn(),
    handleOpenAddForm: vi.fn(),
    handleAddExtra: vi.fn(),
    handleDragStart: vi.fn(),
    hanldeDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleDragEnd: vi.fn(),
    setExtrasState: vi.fn(),
    business: { id: 3 }
  }
  renderWithProviders(<ProductExtras {...props} />, { initialEntries: ['/stores/list'], theme: { ...themeJson, images: {} } })
  return props
}

const openSnooze = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Edit Toppings' }))
  await user.click(within(screen.getByTestId('legacy-modal')).getByRole('button', { name: 'Snooze' }))
  return screen.findByRole('dialog', { name: 'Snooze' })
}

afterEach(() => {
  cleanup()
  mocks.snoozeProps.length = 0
})

describe('ProductExtras · pencil (S-5)', () => {
  it('names each pencil after its option', () => {
    draw()
    expect(screen.getByRole('button', { name: 'Edit Toppings' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit Sauces' })).toBeTruthy()
  })
})

describe('ProductExtras · Snooze', () => {
  it('opens the Snooze body in a Dialog named Snooze, and its X closes it, leaving the edit modal open', async () => {
    const user = userEvent.setup()
    draw()
    expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull()
    const dialog = await openSnooze(user)
    expect(within(dialog).getByTestId('snooze')).toBeTruthy()
    expect(within(dialog).queryByTestId('legacy-modal')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
    expect(screen.getByTestId('legacy-modal')).toBeTruthy()
  })

  it('still snoozes the selected option on its own and saves only snooze_until; its own close closes the dialog', async () => {
    const user = userEvent.setup()
    const props = draw()
    await openSnooze(user)
    const snooze = mocks.snoozeProps.at(-1)
    expect(snooze.isAutomaticUpdate).toBe(true)
    expect(snooze.dataState).toMatchObject({ id: 1, name: 'Toppings' })
    await act(async () => { await snooze.handleUpdate({ snooze_until: '2026-10-11 18:50:00' }) })
    expect(props.handleUpdateExtraState).toHaveBeenCalledWith(1, { snooze_until: '2026-10-11 18:50:00' })
    act(() => { mocks.snoozeProps.at(-1).onClose() })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })
})
