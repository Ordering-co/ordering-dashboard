import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const removeQueryToUrl = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ languageList: [] }, (_key, fallback) => fallback],
  LanguageManager: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../../utils', () => ({
  removeQueryToUrl: (...args) => removeQueryToUrl(...args),
  addQueryToUrl: vi.fn()
}))

vi.mock('../../../Shared', () => ({ SearchBar: () => null }))
vi.mock('../../LanguageSelector', () => ({ LanguageSelector: () => null }))
vi.mock('../../LanguageTransTable', () => ({
  LanguageTransTable: () => <div data-testid='trans-table' />
}))
vi.mock('../../LanguageTransSpread', () => ({
  LanguageTransSpread: () => <div data-testid='trans-spread' />
}))
vi.mock('../../../styles/Select', () => ({ Select: () => null }))

import { LanguageManager } from '../index'

const renderLanguageManager = () =>
  renderWithProviders(
    <LanguageManager
      translationList={{ loading: false }}
      searchValue=''
      onSearch={vi.fn()}
    />
  )

// The table / spreadsheet switch is two icon-only controls. They used to be `span`s with
// an `onClick`: no tab stop, no name, no pressed state.
describe('LanguageManager view-mode switch', () => {
  it('renders both views as named native buttons, with the table view pressed first', () => {
    renderLanguageManager()
    const table = screen.getByRole('button', { name: 'List view' })
    const spread = screen.getByRole('button', { name: 'Spreadsheet' })

    expect(table.tagName).toBe('BUTTON')
    expect(table).toHaveAttribute('type', 'button')
    expect(table).toHaveAttribute('aria-pressed', 'true')
    expect(spread.tagName).toBe('BUTTON')
    expect(spread).toHaveAttribute('type', 'button')
    expect(spread).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('trans-table')).toBeInTheDocument()
    expect(table.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(spread.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('switches to the spreadsheet view with Space and back with Enter', async () => {
    const user = userEvent.setup()
    renderLanguageManager()
    const table = screen.getByRole('button', { name: 'List view' })
    const spread = screen.getByRole('button', { name: 'Spreadsheet' })

    await user.tab()
    expect(table).toHaveFocus()
    await user.tab()
    expect(spread).toHaveFocus()
    await user.keyboard(' ')

    expect(screen.getByTestId('trans-spread')).toBeInTheDocument()
    expect(screen.queryByTestId('trans-table')).not.toBeInTheDocument()
    expect(spread).toHaveAttribute('aria-pressed', 'true')
    expect(table).toHaveAttribute('aria-pressed', 'false')
    expect(removeQueryToUrl).toHaveBeenCalledWith(['page', 'pageSize'])

    table.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('trans-table')).toBeInTheDocument()
    expect(table).toHaveAttribute('aria-pressed', 'true')
    expect(spread).toHaveAttribute('aria-pressed', 'false')
  })
})
