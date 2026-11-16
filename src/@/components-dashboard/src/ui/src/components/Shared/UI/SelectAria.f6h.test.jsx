/* eslint-disable import/first */
// redesign F6h-2 (A2-02): the popup of the C18 selects follows the ARIA listbox pattern. The search field and the
// buttons are NOT inside the `role=listbox`; the listbox only owns `role=option` rows and has a name; the options
// have no interactive children. axe runs on the open popups (jsdom: structural rules only, no layout or colour).
import React from 'react'
import { createRequire } from 'node:module'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }]
}))

import { FirstSelect } from './FirstSelect'
import { MultiSelect } from './MultiSelect'
import { SelectOptionContent } from './SelectOption'
import { SelectSurfaceContext } from './selectPlacement'

// axe-core is not a direct dependency: it comes with @axe-core/playwright.
const requireFrom = createRequire(import.meta.url)
const axe = createRequire(requireFrom.resolve('@axe-core/playwright'))('axe-core')

const RULES = ['aria-required-children', 'aria-required-parent', 'nested-interactive', 'aria-input-field-name', 'aria-valid-attr-value', 'aria-allowed-role', 'aria-allowed-attr']
const audit = async root => {
  let result
  await act(async () => {
    result = await axe.run(root, { runOnly: { type: 'rule', values: RULES }, resultTypes: ['violations'] })
  })
  return result.violations.map(violation => `${violation.id} (${violation.impact}) x${violation.nodes.length} ${violation.nodes[0].any.map(check => check.message).join('|')}`)
}

const text = value => <span>{value}</span>
const drivers = [
  { value: 'default', content: text('Select driver'), color: 'primary', disabled: true, showDisable: true },
  { value: 'remove', content: text('Remove assigned driver'), danger: true },
  { value: 'available', content: text('Available'), group: true, disabled: true },
  { value: 1, content: <SelectOptionContent label='Ana' media={{ kind: 'person', name: 'Ana' }} meta='3 orders' /> },
  { value: 2, content: text('Beto') },
  { value: 3, content: text('Berta') }
]
const people = ['Alba', 'Bruno', 'Berta', 'Carla'].map((name, index) => ({ value: index + 1, name, content: <SelectOptionContent label={name} media={{ kind: 'business', name }} meta={`${index} orders`} /> }))

const wrap = ui => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>{ui}</SelectSurfaceContext.Provider>
  </ThemeProvider>
)
const openFirst = (props = {}) => {
  render(wrap(<FirstSelect placeholder='Select driver' options={drivers} defaultValue={2} onChange={vi.fn()} isShowSearchBar searchValue='' handleChangeSearch={vi.fn()} {...props} />))
  fireEvent.click(document.querySelector('.od-first-select-trigger'))
}
const openMulti = (props = {}) => {
  render(wrap(<MultiSelect placeholder='Select business' options={people} defaultValue={[2, 3]} onChange={vi.fn()} isShowSearchBar searchValue='' handleChangeSearch={vi.fn()} {...props} />))
  fireEvent.click(document.querySelector('.od-multi-select-trigger'))
}

const INTERACTIVE = 'input, button, a[href], select, textarea, [tabindex]:not([role="option"]), [role="button"], [role="checkbox"], [role="searchbox"]'

const expectListboxShape = list => {
  expect(list.querySelector('input')).toBeNull()
  expect(list.querySelector('button')).toBeNull()
  const owned = [...list.children].filter(child => !child.hasAttribute('hidden'))
  for (const child of owned) expect(['option', 'presentation', 'none', 'group', null]).toContain(child.getAttribute('role'))
  for (const option of within(list).getAllByRole('option')) {
    expect(option.querySelector(INTERACTIVE)).toBeNull()
  }
}

describe('FirstSelect popup, ARIA listbox pattern (A2-02)', () => {
  it('has the search field outside the listbox, in the popup that holds both', () => {
    openFirst()
    const list = screen.getByRole('listbox')
    const search = screen.getByRole('searchbox')
    expect(list.contains(search)).toBe(false)
    const popup = list.parentElement
    expect(popup.contains(search)).toBe(true)
    expect(popup).not.toHaveAttribute('role', 'listbox')
    expectListboxShape(list)
  })

  it('names the listbox from the field label, the placeholder or the field itself', () => {
    openFirst({ ariaLabelledBy: 'driver-label' })
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-labelledby', 'driver-label')
  })

  it('names the listbox with the placeholder when no label is given', () => {
    openFirst()
    expect(screen.getByRole('listbox', { name: 'Select driver' })).toBeInTheDocument()
  })

  it('keeps the dangerous action as an option of the listbox, with the rest of the rows', () => {
    openFirst()
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Remove assigned driver')
    expect(options[0]).toHaveAttribute('data-danger')
  })

  it('passes axe on the open popup (search + danger action)', async () => {
    openFirst()
    expect(await audit(document.body)).toEqual([])
  })

  it('passes axe while the rows are loading', async () => {
    openFirst({ isLoading: true })
    expect(await audit(document.body)).toEqual([])
  })

  it('keeps the keyboard: the search takes the focus, ArrowDown enters the rows, ArrowUp goes back', () => {
    openFirst()
    const search = screen.getByRole('searchbox')
    expect(document.activeElement).toBe(search)
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(document.activeElement).toBe(options[1])
    fireEvent.keyDown(options[1], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(options[0])
    fireEvent.keyDown(options[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search)
  })
})

describe('MultiSelect popup, ARIA listbox pattern (A2-02)', () => {
  it('has the search field and «Clear» outside the listbox', () => {
    openMulti()
    const list = screen.getByRole('listbox')
    expect(list.contains(screen.getByRole('searchbox'))).toBe(false)
    const clear = screen.getByRole('button', { name: 'Clear' })
    expect(list.contains(clear)).toBe(false)
    expect(list.parentElement.contains(clear)).toBe(true)
    expect(list).toHaveAttribute('aria-multiselectable', 'true')
    expectListboxShape(list)
  })

  it('names the listbox and exposes the checked state on every row, without a checkbox inside', () => {
    openMulti()
    const list = screen.getByRole('listbox', { name: 'Select business' })
    const states = within(list).getAllByRole('option').map(option => option.getAttribute('aria-selected'))
    expect(states).toEqual(['false', 'true', 'true', 'false'])
    expect(list.querySelector('[role="checkbox"]')).toBeNull()
  })

  it('keeps the chips (and their X) in the field, never in a row', () => {
    openMulti()
    const list = screen.getByRole('listbox')
    expect(document.querySelectorAll('.od-multi-select-chip .od-multi-select-remove')).toHaveLength(2)
    expect(list.querySelector('.od-multi-select-remove')).toBeNull()
  })

  it('passes axe on the open popup (search + Clear + chips)', async () => {
    openMulti()
    const popup = screen.getByRole('listbox').parentElement
    expect(await audit(popup)).toEqual([])
  })

  it('passes axe on the open popup with 80 rows', async () => {
    const many = Array.from({ length: 80 }, (_, index) => ({ value: index + 1, name: `Business ${index}`, content: <SelectOptionContent label={`Business ${index}`} media={{ kind: 'business', name: `Business ${index}` }} meta={`${index}`} /> }))
    openMulti({ options: many, defaultValue: [] })
    const popup = screen.getByRole('listbox').parentElement
    expect(await audit(popup)).toEqual([])
  })

  it('keeps the keyboard: search first, ArrowDown to the first row, ArrowUp back, Esc closes only the popup', () => {
    openMulti()
    const search = screen.getByRole('searchbox')
    expect(document.activeElement).toBe(search)
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(document.activeElement).toBe(options[0])
    fireEvent.keyDown(options[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search)
    act(() => { fireEvent.keyDown(search, { key: 'Escape' }) })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
