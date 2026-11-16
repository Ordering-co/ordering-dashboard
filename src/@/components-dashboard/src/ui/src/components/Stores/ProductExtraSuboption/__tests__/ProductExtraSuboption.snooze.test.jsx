/* eslint-disable import/first */
// redesign bugs F row 25 (S-4 / N-2): the modifier's Snooze opens in the Product Dialog with a title (it was an untitled
// legacy Modal at 85 %). The legacy Modal / Alert / Confirm / ImageCrop, the drop-down and the Snooze body are stand-ins.
import React from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const mocks = vi.hoisted(() => ({ snoozeProps: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  DragAndDrop: ({ children }) => children,
  ExamineClick: ({ children }) => children
}))
vi.mock('../../../Shared', async () => {
  const React = await import('react')
  return {
    Alert: () => null,
    Confirm: () => null,
    ImageCrop: () => null,
    Modal: ({ open, children }) => open ? React.createElement('div', { 'data-testid': 'legacy-modal' }, children) : null
  }
})
vi.mock('react-bootstrap', async () => {
  const React = await import('react')
  return {
    Dropdown: {
      Item: ({ children, onClick }) => React.createElement('button', { type: 'button', onClick }, children)
    },
    DropdownButton: ({ children }) => React.createElement('div', null, children)
  }
})
vi.mock('../../ProductOptionExternalId', () => ({ ProductOptionExternalId: () => null }))
vi.mock('../../SnoozeComponent', () => ({
  SnoozeComponent: (props) => {
    mocks.snoozeProps.push(props)
    return <div data-testid='snooze' />
  }
}))

import { ProductExtraSuboption } from '../index'

const SUBOPTION = { id: 31, name: 'Large', price: 2, enabled: true }

const draw = (over = {}) => {
  const props = {
    subOption: SUBOPTION,
    optionState: { loading: false, option: { id: 9, suboptions: [SUBOPTION] } },
    settingChangeState: { changes: {} },
    changesState: { changes: {} },
    setSelectedSubOptionId: vi.fn(),
    openModal: {},
    setOpenModal: vi.fn(),
    handleChangeDefaultSuboption: vi.fn(),
    handleDeteteSubOption: vi.fn(),
    handleUpdateSubOption: vi.fn(),
    handleDuplicateSubOption: vi.fn(),
    setIsDraggingExtraOption: vi.fn(),
    ...over
  }
  renderWithProviders(<ProductExtraSuboption {...props} />, { initialEntries: ['/stores/list'], theme: { ...themeJson, images: {} } })
  return props
}

afterEach(() => {
  cleanup()
  mocks.snoozeProps.length = 0
})

describe('ProductExtraSuboption · Snooze', () => {
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

  it('keeps hiding the Snooze buttons, writes the change into the row and saves it through the row, and its own close closes the dialog', async () => {
    const user = userEvent.setup()
    const props = draw()
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    await screen.findByRole('dialog', { name: 'Snooze' })
    const snooze = mocks.snoozeProps.at(-1)
    expect(snooze.hideButtons).toBe(true)
    expect(snooze.dataState).toBe(SUBOPTION)
    act(() => { snooze.handleChangeFormState({ snooze_until: '2026-10-11 18:50:00' }) })
    await waitFor(() => expect(props.handleUpdateSubOption).toHaveBeenCalledWith({ id: 31, snooze_until: '2026-10-11 18:50:00' }))
    act(() => { mocks.snoozeProps.at(-1).onClose() })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })
})
