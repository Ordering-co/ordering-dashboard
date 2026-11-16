/* eslint-disable import/first */
// redesign bugs F row 25 (S-4 / N-2): the category's Snooze opens in the Product Dialog with a title (it was an untitled
// legacy Modal at 85 %). The controller, the tabs, the legacy Modal / Alert / Confirm and the Snooze body are stand-ins.
import React from 'react'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const mocks = vi.hoisted(() => ({ snoozeProps: [] }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('~ui', async () => {
  const React = await import('react')
  return {
    Alert: () => null,
    Confirm: () => null,
    Button: ({ children, ...props }) => React.createElement('button', { type: 'button', onClick: props.onClick }, children),
    Modal: ({ open, children }) => open ? React.createElement('div', { 'data-testid': 'legacy-modal' }, children) : null
  }
})
vi.mock('../../../../../../components/BusinessProductsCategoyDetails', () => ({
  BusinessProductsCategoyDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../SeoOptions', () => ({ SeoOptions: () => null }))
vi.mock('../../BusinessCategoryInfoSettingList', () => ({ BusinessCategoryInfoSettingList: () => null }))
vi.mock('../../BusinessProductsCategoyInfo', () => ({ BusinessProductsCategoyInfo: () => null }))
vi.mock('../../SnoozeComponent', () => ({
  SnoozeComponent: (props) => {
    mocks.snoozeProps.push(props)
    return <div data-testid='snooze' />
  }
}))

import { BusinessProductsCategoyDetails } from '../index'

const CATEGORY = { id: 5, name: 'Pizzas' }

const draw = () => renderWithProviders(
  <BusinessProductsCategoyDetails
    businessState={{ loading: false, business: {} }}
    formState={{ changes: { name: 'Pizzas', enabled: true } }}
    categorySelected={CATEGORY}
    handleChangeItem={vi.fn()}
    handleChangeCheckBox={vi.fn()}
    handleUpdateClick={vi.fn()}
  />,
  { initialEntries: ['/stores/list'], theme: themeJson }
)

afterEach(() => {
  cleanup()
  mocks.snoozeProps.length = 0
})

describe('BusinessProductsCategoyDetails · Snooze', () => {
  it('opens the Snooze body in a Dialog named Snooze, and its X closes it', async () => {
    const user = userEvent.setup()
    draw()
    expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    const dialog = await screen.findByRole('dialog', { name: 'Snooze' })
    expect(within(dialog).getByTestId('snooze')).toBeTruthy()
    expect(screen.queryByTestId('legacy-modal')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })

  it('still hands the category, the form and the save to the Snooze body, and its own close closes the dialog', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    await screen.findByRole('dialog', { name: 'Snooze' })
    const props = mocks.snoozeProps.at(-1)
    expect(props.dataState).toBe(CATEGORY)
    expect(typeof props.handleUpdate).toBe('function')
    expect(typeof props.handleChangeFormState).toBe('function')
    expect(props.formState).toEqual({ changes: { name: 'Pizzas', enabled: true } })
    props.onClose()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })
})
