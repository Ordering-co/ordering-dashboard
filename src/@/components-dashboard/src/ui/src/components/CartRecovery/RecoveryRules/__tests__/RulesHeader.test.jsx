/* eslint-disable import/first */
// redesign RA-B2 (decision 2; M-RA1, M-RA2): the page header of the cart recovery rules list: title and count, the «N of M rules on» line,
// the help line (without the drag-and-drop sentence), Learn, «New rule» and the search. The Product wrappers are real; the language
// and the Learn menu (level 0 only, its own tests) are simulated.
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../../../../../../../../../../i18n/translations.json'

const mockState = vi.hoisted(() => ({
  catalog: {}, // what the runtime catalog of the API says for a key, over the default text
  locale: 'en',
  learn: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: mockState.locale } }, (key, text) => mockState.catalog[key] ?? text]
}))
vi.mock('../../../Shared/LearnDropDown', () => ({
  LearnDropDown: (props) => {
    mockState.learn(props)
    return <button type='button'>Learn</button>
  }
}))

import { RulesHeader } from '../RulesHeader'

const HELP = 'Each rule writes to customers a set time after they last opened their cart.'

const setup = (props = {}) => {
  const onNew = vi.fn()
  const onSearch = vi.fn()
  const view = render(<RulesHeader count={8} summary={{ on: 3, total: 8 }} onNew={onNew} onSearch={onSearch} search='' {...props} />)
  return { onNew, onSearch, ...view }
}

beforeEach(() => {
  mockState.catalog = {}
  mockState.locale = 'en'
  mockState.learn.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('title and count', () => {
  it('has the page title «Cart recovery rules» as the only h1', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Cart recovery rules' })).toBeInTheDocument()
  })

  it('names the count for a screen reader: «8 rules»', () => {
    const { container } = setup({ count: 8 })
    expect(screen.getByText('8 rules')).toBeInTheDocument()
    expect(container.querySelector('.odc-pagehead-count')).toHaveTextContent('8')
  })

  it('says «1 rule» for one and keeps a zero count', () => {
    setup({ count: 1 })
    expect(screen.getByText('1 rule')).toBeInTheDocument()
    cleanup()
    setup({ count: 0 })
    expect(screen.getByText('0 rules')).toBeInTheDocument()
  })

  it.each([[undefined], [null], [NaN], ['soon']])('draws no count while it is unknown (%j)', (count) => {
    const { container } = setup({ count })
    expect(container.querySelector('.odc-pagehead-count')).toBeNull()
    // no «NaN rules» or «null rules» label (the «New rule» button is the only other text that ends so)
    expect(screen.queryByText(/^(?!New )\S+ rules?$/)).toBeNull()
  })

  it('takes the title and the count words from the catalog', () => {
    mockState.catalog = { CART_RECOVERY_RULES: 'Reglas de recuperación', RECOVERY_RULES_COUNT_OTHER: '_count_ reglas' }
    setup({ count: 3 })
    expect(screen.getByRole('heading', { level: 1, name: 'Reglas de recuperación' })).toBeInTheDocument()
    expect(screen.getByText('3 reglas')).toBeInTheDocument()
  })
})

describe('the «on of total» line', () => {
  it('says «3 of 8 rules on» with both numbers as figures and a success dot', () => {
    const { container } = setup({ summary: { on: 3, total: 8 } })
    const line = container.querySelector('.odc-ra-summary')
    expect(line).toHaveTextContent('3 of 8 rules on')
    const figures = Array.from(line.querySelectorAll('.odc-figure')).map(node => node.textContent)
    expect(figures).toEqual(['3', '8'])
    expect(line).toHaveAttribute('data-state', 'on')
    expect(line.querySelector('.odc-ra-dot')).toHaveAttribute('aria-hidden', 'true')
  })

  it('is the attention state (never colour alone: the words stay) when none is on', () => {
    const { container } = setup({ summary: { on: 0, total: 8 } })
    const line = container.querySelector('.odc-ra-summary')
    expect(line).toHaveTextContent('0 of 8 rules on')
    expect(line).toHaveAttribute('data-state', 'off')
  })

  it('carries its whole text as title', () => {
    const { container } = setup({ summary: { on: 2, total: 5 } })
    expect(container.querySelector('.odc-ra-summary')).toHaveAttribute('title', '2 of 5 rules on')
  })

  // redesign R2-G1 (F1 of the mechanical measure): at 390 the line in the title's row left the h1 with an ellipsis in the 11 non-English
  // languages. The line is its own row under the page header, never in its status slot.
  it('is its own row under the page header, never inside the status slot of the title row (R2-G1 F1)', () => {
    const { container } = setup({ summary: { on: 3, total: 8 } })
    const line = container.querySelector('.odc-ra-summary')
    expect(line.closest('.odc-pagehead-status')).toBeNull()
    expect(line.closest('.odc-pagehead')).toBeNull()
    expect(line.closest('.odc-ra-summary-row')).not.toBeNull()
    // the slot of the page header is left empty
    const slot = container.querySelector('.odc-pagehead-status')
    expect(slot).toHaveAttribute('data-empty', '')
    expect(slot).toBeEmptyDOMElement()
    // the row comes right after the page header and before the search bar
    const row = line.closest('.odc-ra-summary-row')
    expect(container.querySelector('.odc-pagehead').compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(row.compareDocumentPosition(container.querySelector('.odc-filterbar')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('while it is unknown it holds its line with a skeleton and writes no text', () => {
    const { container } = setup({ summary: null })
    expect(container.querySelector('.odc-ra-summary')).toBeNull()
    expect(container.querySelector('.odc-ra-summary-row .odc-skeleton')).not.toBeNull()
    expect(container.querySelector('.odc-pagehead-status .odc-skeleton')).toBeNull()
    expect(screen.queryByText(/rules on/)).toBeNull()
    // the row is there while the line is unknown, so the header keeps its height when the line arrives
    expect(container.querySelector('.odc-ra-summary-row')).not.toBeNull()
  })

  // redesign RA-I1: `undefined` is a summary that could not be read; the line is left out, not held with a skeleton for ever
  it('draws neither the line nor a skeleton when the summary could not be read (undefined)', () => {
    const { container } = setup({ summary: undefined })
    expect(container.querySelector('.odc-ra-summary')).toBeNull()
    expect(container.querySelector('.odc-skeleton')).toBeNull()
    expect(screen.queryByText(/rules on/)).toBeNull()
    // the rest of the header stays: title, count and «New rule»
    expect(screen.getByRole('heading', { level: 1, name: 'Cart recovery rules' })).toBeInTheDocument()
    expect(screen.getByText('8 rules')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New rule' })).toBeInTheDocument()
    // the slot of the page header is still in the row, empty, and there is no row of the line (no gap left)
    const slot = container.querySelector('.odc-pagehead-status')
    expect(slot).not.toBeNull()
    expect(slot).toHaveAttribute('data-empty', '')
    expect(slot).toBeEmptyDOMElement()
    expect(container.querySelector('.odc-ra-summary-row')).toBeNull()
  })

  it('null and undefined are different: the skeleton comes and goes with the summary', () => {
    const { container, rerender } = setup({ summary: null })
    expect(container.querySelector('.odc-ra-summary-row .odc-skeleton')).not.toBeNull()
    rerender(<RulesHeader count={8} summary={undefined} onNew={() => {}} onSearch={() => {}} search='' />)
    expect(container.querySelector('.odc-skeleton')).toBeNull()
    rerender(<RulesHeader count={8} summary={{ on: 3, total: 8 }} onNew={() => {}} onSearch={() => {}} search='' />)
    expect(container.querySelector('.odc-ra-summary')).toHaveTextContent('3 of 8 rules on')
    expect(container.querySelector('.odc-skeleton')).toBeNull()
  })

  it('takes the sentence from the catalog and keeps the order of its parts', () => {
    mockState.catalog = { RECOVERY_RULES_ON_SUMMARY: '_total_ reglas, _on_ encendidas' }
    const { container } = setup({ summary: { on: 1, total: 4 } })
    expect(container.querySelector('.odc-ra-summary')).toHaveTextContent('4 reglas, 1 encendidas')
  })
})

describe('the help line', () => {
  it('is the description, always visible, and no longer tells to drag (M-RA1)', () => {
    const { container } = setup()
    const description = container.querySelector('.odc-pagehead-description')
    expect(description).toHaveTextContent(HELP)
    expect(description.textContent).not.toMatch(/drag/i)
    expect(screen.queryByRole('button', { name: /information/i })).toBeNull()
  })

  // (recovery-actions P-2): rules have no rank anyone can see or change, so the help no longer promises the
  // «highest-ranking» one wins (which rule wins is asked to backend in D-73).
  it('does not promise a rank the rules do not have', () => {
    const { container } = setup()
    const description = container.querySelector('.odc-pagehead-description')
    expect(description.textContent).toBe(HELP)
    expect(description.textContent).not.toMatch(/rank|priority|highest/i)
  })

  it.each(Object.entries(catalog.RECOVERY_RULES_HELP))('the %s text says nothing about a rank', (_code, text) => {
    expect(text).not.toMatch(/rank|rang\b|priorit|prioridad|Priorität|προτεραιότητα|приоритет|أولوية|sıradaki/i)
  })
})

describe('«New rule»', () => {
  it('is the primary action and calls onNew once', async () => {
    const user = userEvent.setup()
    const { onNew } = setup()
    const button = screen.getByRole('button', { name: 'New rule' })
    expect(button).toHaveAttribute('data-variant', 'primary')
    await user.click(button)
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('keeps its words and its title when the header is narrow (the label is marked to collapse)', () => {
    setup()
    const button = screen.getByRole('button', { name: 'New rule' })
    expect(button).toHaveAttribute('title', 'New rule')
    expect(button.querySelector('[data-collapse-label]')).toHaveTextContent('New rule')
  })

  it('has no «Add recovery action» button as the old header had', () => {
    setup()
    expect(screen.queryByRole('button', { name: /Add recovery action/i })).toBeNull()
  })
})

describe('Learn', () => {
  it('mounts the Learn menu with the options the host gives', () => {
    const learnOptions = [{ value: 'a', name: 'A', url: 'https://x' }]
    setup({ learnOptions })
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(mockState.learn).toHaveBeenCalledWith({ learnOptions })
  })

  it('draws nothing of Learn without options', () => {
    setup({ learnOptions: undefined })
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull()
  })
})

describe('menu button (the sidebar is collapsed)', () => {
  it('draws «Open menu» before the title only when the host gives onOpenMenu, and calls it', async () => {
    const user = userEvent.setup()
    const onOpenMenu = vi.fn()
    setup({ onOpenMenu })
    const menu = screen.getByRole('button', { name: 'Open menu' })
    expect(menu.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the opener is PageHeader's `leading`: the first child of the lead block
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    await user.click(menu)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })

  it('has no menu button by default', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

describe('search (as today: typed, sent after a wait, no URL)', () => {
  it('is a search field named «Search rules» inside a filter bar', () => {
    const { container } = setup()
    expect(screen.getByRole('searchbox', { name: 'Search rules' })).toBeInTheDocument()
    expect(container.querySelector('.odc-filterbar')).not.toBeNull()
  })

  it('sends the text once, 750 ms after the last key', async () => {
    vi.useFakeTimers()
    const { onSearch } = setup()
    const input = screen.getByRole('searchbox', { name: 'Search rules' })
    fireEvent.change(input, { target: { value: 'd' } })
    fireEvent.change(input, { target: { value: 'dis' } }) // the second key restarts the wait
    expect(input).toHaveValue('dis')
    expect(onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(749) })
    expect(onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('dis')
  })

  it('sends at once on Enter', async () => {
    const user = userEvent.setup()
    const { onSearch } = setup()
    await user.type(screen.getByRole('searchbox', { name: 'Search rules' }), 'cart{Enter}')
    expect(onSearch).toHaveBeenCalledWith('cart')
  })

  it('clearing sends the empty text at once and keeps the focus in the field', async () => {
    const user = userEvent.setup()
    const { onSearch } = setup({ search: 'cart' })
    const input = screen.getByRole('searchbox', { name: 'Search rules' })
    expect(input).toHaveValue('cart')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
    expect(input).toHaveFocus()
  })

  it('shows a search the host sets from outside', () => {
    const { rerender, onSearch } = setup({ search: '' })
    rerender(<RulesHeader count={8} summary={null} onNew={() => {}} onSearch={onSearch} search='coupon' />)
    expect(screen.getByRole('searchbox', { name: 'Search rules' })).toHaveValue('coupon')
  })
})
