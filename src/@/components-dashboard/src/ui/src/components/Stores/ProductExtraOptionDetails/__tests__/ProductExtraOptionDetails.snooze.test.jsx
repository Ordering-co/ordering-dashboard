/* eslint-disable import/first */
// redesign bugs F row 25 (S-4 / N-2): the option's Snooze opens in the Product Dialog with a title (it was an untitled
// legacy Modal at 85 %). The controller, the form, the suboptions, the legacy Modal / Alert / Confirm and the Snooze body are stand-ins.
import React from 'react'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const mocks = vi.hoisted(() => ({ snoozeProps: [] }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  DragAndDrop: ({ children }) => children,
  ExamineClick: ({ children }) => children
}))
vi.mock('~ui', async () => {
  const React = await import('react')
  return {
    Button: ({ children, onClick }) => React.createElement('button', { type: 'button', onClick }, children)
  }
})
vi.mock('../../../Shared', async () => {
  const React = await import('react')
  return {
    Alert: () => null,
    Confirm: () => null,
    ImageCrop: () => null,
    Modal: ({ open, children }) => open ? React.createElement('div', { 'data-testid': 'legacy-modal' }, children) : null
  }
})
vi.mock('../../../../../../components/ProductExtraOptionDetails', () => ({
  ProductExtraOptionDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../ProductExtraOptionMetaFields', () => ({ ProductExtraOptionMetaFields: () => null }))
vi.mock('../../ProductExtraSubOptionMetaFields', () => ({ ProductExtraSubOptionMetaFields: () => null }))
vi.mock('../../ProductExtraSuboption', () => ({ ProductExtraSuboption: () => null }))
vi.mock('../../ProductExtraOptionForm', () => ({ ProductExtraOptionForm: () => null }))
vi.mock('../../ProductOptionExternalId', () => ({ ProductOptionExternalId: () => null }))
vi.mock('../../SnoozeComponent', () => ({
  SnoozeComponent: (props) => {
    mocks.snoozeProps.push(props)
    return <div data-testid='snooze' />
  }
}))

import { ProductExtraOptionDetails } from '../index'

const OPTION = { id: 9, name: 'Size', suboptions: [] }

const draw = () => renderWithProviders(
  <ProductExtraOptionDetails
    optionState={{ loading: false, option: OPTION }}
    changesState={{ changes: {} }}
    settingChangeState={{ changes: { with_half_option: true }, loading: false }}
    handleUpdateOption={vi.fn()}
    handleChangeSettingsChangeState={vi.fn()}
    business={{ id: 3 }}
    extra={{ id: 4 }}
  />,
  { initialEntries: ['/stores/list'], theme: themeJson }
)

afterEach(() => {
  cleanup()
  mocks.snoozeProps.length = 0
})

describe('ProductExtraOptionDetails · Snooze', () => {
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

  it('still hands the option, the pending settings and the save to the Snooze body, and its own close closes the dialog', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    await screen.findByRole('dialog', { name: 'Snooze' })
    const props = mocks.snoozeProps.at(-1)
    expect(props.isAutomaticUpdate).toBe(true)
    expect(props.dataState).toBe(OPTION)
    expect(typeof props.handleUpdate).toBe('function')
    expect(typeof props.handleChangeFormState).toBe('function')
    expect(props.formState).toEqual({ changes: { with_half_option: true }, loading: false })
    props.onClose()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })
})
