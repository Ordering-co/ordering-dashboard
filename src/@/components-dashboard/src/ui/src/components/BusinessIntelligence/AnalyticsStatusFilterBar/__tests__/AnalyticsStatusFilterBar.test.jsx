import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  DragScroll: ({ children }) => <div data-testid='drag-scroll'>{children}</div>
}))

import { AnalyticsStatusFilterBar } from '../index'

const TABS = [
  { name: 'Today', lapse: 'today' },
  { name: 'Yesterday', lapse: 'yesterday' },
  { name: 'Last 7 days', lapse: 'last_7_days' },
  { name: 'Last 30 days', lapse: 'last_30_days' }
]

const setup = (filterList = { lapse: 'yesterday', other: 'kept' }) => {
  const handleChangeFilterList = vi.fn()
  renderWithProviders(
    <AnalyticsStatusFilterBar
      filterList={filterList}
      handleChangeFilterList={handleChangeFilterList}
    />
  )
  return { handleChangeFilterList, user: userEvent.setup() }
}

describe('AnalyticsStatusFilterBar', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
  })

  it('renders every lapse as a real button that is reachable with Tab', async () => {
    const { user } = setup()

    for (const { name } of TABS) {
      const tab = screen.getByRole('button', { name })
      expect(tab.tagName).toBe('BUTTON')
      expect(tab).toHaveAttribute('type', 'button')
      expect(tab.tabIndex).toBe(0)
    }

    await user.tab()
    expect(screen.getByRole('button', { name: 'Today' })).toHaveFocus()
  })

  it('marks only the active lapse as pressed', () => {
    setup({ lapse: 'last_7_days' })

    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['Today', 'Yesterday', 'Last 30 days']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it.each(TABS)('Enter and Space on $name call the handler with its lapse', async ({ name, lapse }) => {
    const { handleChangeFilterList, user } = setup()
    const tab = screen.getByRole('button', { name })

    tab.focus()
    await user.keyboard('{Enter}')
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ lapse, other: 'kept' })

    handleChangeFilterList.mockClear()
    await user.keyboard(' ')
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenLastCalledWith({ lapse, other: 'kept' })
  })

  it('still reacts to a click and scrolls to the top', async () => {
    const { handleChangeFilterList, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Last 30 days' }))
    expect(handleChangeFilterList).toHaveBeenCalledWith({ lapse: 'last_30_days', other: 'kept' })
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
