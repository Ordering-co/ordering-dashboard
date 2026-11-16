// redesign stores 2.D: P/ListPopover, the pill whose popover is a single-choice list with search and «All».
// The rows are listbox options: the arrows move the focus and never the selection; Enter, Space and a click pick and close.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ListPopover } from '../ListPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

const ITEMS = [
  { id: 1, name: 'Restaurant' },
  { id: 2, name: 'Café' },
  { id: 3, name: 'Coffee & Smoothies', keywords: ['barista'] },
  { id: 4, name: 'Grocery' }
]
const LABELS = {
  allLabel: 'All',
  searchLabel: 'Search',
  clearSearchLabel: 'Clear search',
  noResultsLabel: 'No results found',
  loadingLabel: 'Loading...'
}

const list = (props = {}) => (
  <ListPopover label='Type' items={ITEMS} value={null} onChange={() => {}} {...LABELS} {...props} />
)

const pill = () => screen.getByRole('button', { name: /^Type/ })

const open = async (user, props = {}) => {
  const view = render(list(props))
  await user.click(pill())
  const popup = await screen.findByRole('dialog', { name: 'Type', hidden: true })
  const box = within(popup).getByRole('listbox', { name: 'Type', hidden: true })
  return { ...view, popup, box }
}

const options = box => within(box).getAllByRole('option', { hidden: true })
const optionOf = (box, name) => within(box).getByRole('option', { name, hidden: true })
const searchOf = popup => within(popup).getByRole('searchbox', { hidden: true })

describe('ListPopover · the pill', () => {
  it('is inactive with «All» (value null): the label only', () => {
    render(list())
    expect(pill()).not.toHaveAttribute('data-active')
    expect(pill()).toHaveAccessibleName('Type')
  })

  it('shows the name of the chosen option as the value, also when the value is the string of a numeric id', () => {
    const { rerender } = render(list({ value: 3 }))
    expect(pill()).toHaveAttribute('data-active')
    expect(pill()).toHaveAccessibleName('Type Coffee & Smoothies')
    rerender(list({ value: '2' }))
    expect(pill()).toHaveAccessibleName('Type Café')
  })

  it('is always active for a value that is not in the items yet: valueLabel, else the value itself', () => {
    const { rerender } = render(list({ value: 99, valueLabel: 'Bakery' }))
    expect(pill()).toHaveAttribute('data-active')
    expect(pill()).toHaveAccessibleName('Type Bakery')
    rerender(list({ value: 99 }))
    expect(pill()).toHaveAttribute('data-active')
    expect(pill()).toHaveAccessibleName('Type 99')
  })
})

describe('ListPopover · the list', () => {
  it('opens a listbox named by the label, «All» first, every item an option', async () => {
    const user = userEvent.setup()
    const { box } = await open(user)
    expect(options(box).map(option => option.textContent)).toEqual(['All', 'Restaurant', 'Café', 'Coffee & Smoothies', 'Grocery'])
    expect(pill()).toHaveAttribute('aria-expanded', 'true')
  })

  it('marks «All» when the value is null, and only the chosen option otherwise', async () => {
    const user = userEvent.setup()
    const first = await open(user)
    expect(options(first.box).filter(o => o.getAttribute('aria-selected') === 'true').map(o => o.textContent)).toEqual(['All'])
    first.unmount()
    document.getElementById('app-modals')?.remove()

    const second = await open(user, { value: 3 })
    expect(options(second.box).filter(o => o.getAttribute('aria-selected') === 'true').map(o => o.textContent)).toEqual(['Coffee & Smoothies'])
    expect(optionOf(second.box, 'All')).toHaveAttribute('aria-selected', 'false')
  })

  it('a value that is not in the items selects nothing yet', async () => {
    const user = userEvent.setup()
    const { box } = await open(user, { value: 99 })
    expect(options(box).filter(o => o.getAttribute('aria-selected') === 'true')).toHaveLength(0)
    expect(options(box).filter(o => o.tabIndex === 0)).toEqual([optionOf(box, 'All')])
  })

  it('each option is a native button with a decorative check slot and its name; only the chosen one draws the mark', async () => {
    const user = userEvent.setup()
    const { box } = await open(user, { value: 2 })
    const row = optionOf(box, 'Café')
    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveAttribute('type', 'button')
    expect(row.querySelector('.odc-orders-picker-name')).toHaveTextContent('Café')
    options(box).forEach((option) => {
      expect(option.querySelector('.odc-list-popover-check')).toHaveAttribute('aria-hidden', 'true')
      expect(option.querySelector('.odc-list-popover-check svg') !== null).toBe(option === row)
    })
  })

  it('writes aria-selected on every option, "true" or "false", and each name is exactly its text', async () => {
    const user = userEvent.setup()
    const { box } = await open(user, { value: 2 })
    options(box).forEach((option) => {
      expect(['true', 'false']).toContain(option.getAttribute('aria-selected'))
      expect(option).toHaveAccessibleName(option.textContent)
    })
    expect(options(box).map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false', 'false'])
    expect(box.querySelector('[role="checkbox"], [role="radio"]')).toBeNull()
  })

  // review R-3: two frames after the mount, once the positioner has capped the popup (a scroll at mount left it below the fold)
  it('brings the chosen option into view on open, after the popup is placed', async () => {
    const scrollIntoView = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      const user = userEvent.setup()
      const { box } = await open(user, { value: 4 })
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' }))
      expect(scrollIntoView.mock.contexts).toContain(optionOf(box, 'Grocery'))
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})

describe('ListPopover · search', () => {
  it('names the field «Search Type» and filters by name, keeping «All»', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    expect(within(popup).getByRole('searchbox', { name: 'Search Type', hidden: true })).toHaveAttribute('placeholder', 'Search')
    await user.type(searchOf(popup), 'gro')
    expect(options(box).map(option => option.textContent)).toEqual(['All', 'Grocery'])
  })

  it('does not tell capitals or accents apart, and also searches the keywords', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    await user.type(searchOf(popup), 'CAFE')
    expect(options(box).map(option => option.textContent)).toEqual(['All', 'Café'])
    await user.clear(searchOf(popup))
    await user.type(searchOf(popup), '  Barista ')
    expect(options(box).map(option => option.textContent)).toEqual(['All', 'Coffee & Smoothies'])
  })

  it('writes the no-results text in a status when nothing matches, with «All» above it', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    await user.type(searchOf(popup), 'zzz')
    expect(options(box).map(option => option.textContent)).toEqual(['All'])
    expect(within(popup).getByRole('status', { hidden: true })).toHaveTextContent('No results found')
  })

  it('has one status that is always in the page: empty while there is nothing to say', async () => {
    const user = userEvent.setup()
    const { popup } = await open(user)
    const status = within(popup).getByRole('status', { hidden: true })
    expect(status).toBeEmptyDOMElement()
    await user.type(searchOf(popup), 'zzz')
    expect(within(popup).getByRole('status', { hidden: true })).toBe(status)
    expect(status).toHaveTextContent('No results found')
    await user.clear(searchOf(popup))
    expect(status).toBeEmptyDOMElement()
  })

  it('an empty list without a search says nothing: only «All»', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user, { items: [], noResultsLabel: undefined })
    expect(options(box).map(option => option.textContent)).toEqual(['All'])
    expect(within(popup).getByRole('status', { hidden: true })).toBeEmptyDOMElement()
  })

  it('starts empty on every open', async () => {
    const user = userEvent.setup()
    const { popup } = await open(user)
    await user.type(searchOf(popup), 'gro')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type', hidden: true })).toBeNull(), { timeout: 4000 })
    await user.click(pill())
    const again = await screen.findByRole('dialog', { name: 'Type', hidden: true })
    expect(searchOf(again)).toHaveValue('')
    expect(options(within(again).getByRole('listbox', { hidden: true }))).toHaveLength(5)
  })
})

describe('ListPopover · keyboard', () => {
  it('starts in the search field; ArrowDown enters the list at its first option', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    await waitFor(() => expect(searchOf(popup)).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'All')).toHaveFocus()
  })

  it('the arrows, Home and End move the focus and never the selection nor onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { popup, box } = await open(user, { value: 2, onChange })
    const selected = () => options(box).filter(o => o.getAttribute('aria-selected') === 'true').map(o => o.textContent)
    await waitFor(() => expect(searchOf(popup)).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'All')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'Restaurant')).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(optionOf(box, 'Grocery')).toHaveFocus() // stops at the last one
    await user.keyboard('{ArrowUp}')
    expect(optionOf(box, 'Coffee & Smoothies')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(optionOf(box, 'All')).toHaveFocus()
    await user.keyboard('{End}')
    expect(optionOf(box, 'Grocery')).toHaveFocus()
    expect(selected()).toEqual(['Café'])
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Type', hidden: true })).toBeInTheDocument()
  })

  it('ArrowUp from the first option goes back to the search field', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'All')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(searchOf(popup)).toHaveFocus()
  })

  it('Home and End inside the search field keep moving the caret', async () => {
    const user = userEvent.setup()
    const { popup } = await open(user)
    await user.type(searchOf(popup), 'gr')
    await user.keyboard('{Home}')
    expect(searchOf(popup)).toHaveFocus()
    await user.keyboard('{End}')
    expect(searchOf(popup)).toHaveFocus()
  })

  it('keeps one option in the Tab order: the chosen one on open, then the last one that had the focus', async () => {
    const user = userEvent.setup()
    const { box } = await open(user, { value: 3 })
    const stops = () => options(box).filter(o => o.tabIndex === 0)
    expect(stops()).toEqual([optionOf(box, 'Coffee & Smoothies')])
    expect(options(box).filter(o => o.tabIndex === -1)).toHaveLength(4)
    await user.keyboard('{ArrowDown}')
    expect(stops()).toEqual([optionOf(box, 'All')])
    await user.keyboard('{End}')
    expect(stops()).toEqual([optionOf(box, 'Grocery')])
    expect(optionOf(box, 'Coffee & Smoothies').getAttribute('aria-selected')).toBe('true')
  })

  it('falls back to «All» as the Tab stop when the stop is filtered out', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user, { value: 3 })
    await user.type(searchOf(popup), 'gro')
    expect(options(box).filter(o => o.tabIndex === 0)).toEqual([optionOf(box, 'All')])
  })

  it('ignores the arrows with Alt, Ctrl or Meta held', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    await waitFor(() => expect(searchOf(popup)).toHaveFocus())
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(searchOf(popup)).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'All')).toHaveFocus()
    await user.keyboard('{Control>}{End}{/Control}')
    expect(optionOf(box, 'All')).toHaveFocus()
  })
})

describe('ListPopover · picking', () => {
  const expectPicked = async (onChange, id, item) => {
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(id, item)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type', hidden: true })).toBeNull(), { timeout: 4000 })
    expect(pill()).toHaveFocus()
  }

  it('Enter on an option picks it once, closes the popover and gives the focus back to the pill', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    await open(user, { onChange })
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    await user.keyboard('{Enter}')
    await expectPicked(onChange, 2, ITEMS[1])
  })

  it('Space does the same', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    await open(user, { onChange })
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    await user.keyboard(' ')
    await expectPicked(onChange, 3, ITEMS[2])
  })

  it('a click does the same', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { box } = await open(user, { onChange })
    await user.click(optionOf(box, 'Grocery'))
    await expectPicked(onChange, 4, ITEMS[3])
  })

  it('«All» picks null, with no item', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { box } = await open(user, { value: 3, onChange })
    await user.click(optionOf(box, 'All'))
    await expectPicked(onChange, null, null)
  })

  it('picks the filtered option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { popup } = await open(user, { onChange })
    await user.type(searchOf(popup), 'cafe')
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    await expectPicked(onChange, 2, ITEMS[1])
  })
})

describe('ListPopover · Tab out (usePopoverTabOut)', () => {
  it('Tab from the last tab stop closes the popover and goes on to the next control', async () => {
    const user = userEvent.setup()
    render(
      <>
        {list()}
        <button type='button'>After</button>
      </>
    )
    await user.click(pill())
    const popup = await screen.findByRole('dialog', { name: 'Type', hidden: true })
    await waitFor(() => expect(searchOf(popup)).toHaveFocus())
    await user.tab() // search -> the only option in the Tab order
    expect(within(popup).getByRole('option', { name: 'All', hidden: true })).toHaveFocus()
    await user.tab()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type', hidden: true })).toBeNull(), { timeout: 4000 })
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('Shift+Tab from the search field goes to the pill', async () => {
    const user = userEvent.setup()
    const { popup } = await open(user)
    await waitFor(() => expect(searchOf(popup)).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type', hidden: true })).toBeNull(), { timeout: 4000 })
    expect(pill()).toHaveFocus()
  })
})

describe('ListPopover · loading and labels', () => {
  it('an empty list that loads shows the loading text in a status, with «All» above it', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user, { items: [], loading: true })
    expect(options(box).map(option => option.textContent)).toEqual(['All'])
    expect(within(popup).getByRole('status', { hidden: true })).toHaveTextContent('Loading...')
  })

  it('does not show the loading text once there are items', async () => {
    const user = userEvent.setup()
    const { popup } = await open(user, { loading: true })
    expect(within(popup).getByRole('status', { hidden: true })).toBeEmptyDOMElement()
  })

  it('an empty text paints empty instead of throwing', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user, { allLabel: '', noResultsLabel: '' })
    expect(options(box)[0]).toHaveTextContent('')
    expect(options(box)).toHaveLength(5)
    await user.type(searchOf(popup), 'zzz')
    expect(within(popup).getByRole('status', { hidden: true })).toHaveTextContent('')
  })

  it.each([
    ['allLabel', 'ListPopover needs an allLabel'],
    ['searchLabel', 'ListPopover needs a searchLabel'],
    ['clearSearchLabel', 'ListPopover needs a clearSearchLabel']
  ])('throws without its %s, even closed', (name, message) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(list({ [name]: undefined }))).toThrow(message)
    error.mockRestore()
  })

  it('throws without a label (the pill needs one)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(list({ label: undefined }))).toThrow('FilterPill needs a label')
    error.mockRestore()
  })

  // the popup mounts on open, so a text the open case needs throws while it renders: an error boundary catches it
  class Boundary extends React.Component {
    state = { message: null }
    static getDerivedStateFromError (error) { return { message: error.message } }
    render () { return this.state.message ? <p data-testid='boundary'>{this.state.message}</p> : this.props.children }
  }
  const boundary = () => screen.getByTestId('boundary')

  it('throws without a noResultsLabel only when a search found nothing', async () => {
    const user = userEvent.setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Boundary>{list({ noResultsLabel: undefined, loadingLabel: undefined })}</Boundary>)
    await user.click(pill())
    const popup = await screen.findByRole('dialog', { name: 'Type', hidden: true })
    expect(screen.queryByTestId('boundary')).toBeNull() // a list with rows does not draw it
    await user.type(searchOf(popup), 'zzz')
    expect(boundary()).toHaveTextContent('ListPopover needs a noResultsLabel')
    error.mockRestore()
  })

  it('throws without a loadingLabel only when an empty list loads', async () => {
    const user = userEvent.setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Boundary>{list({ items: [], loading: true, loadingLabel: undefined })}</Boundary>)
    await user.click(pill())
    await waitFor(() => expect(boundary()).toHaveTextContent('ListPopover needs a loadingLabel'))
    error.mockRestore()
  })

  it.each([
    ['errorLabel', 'ListPopover needs an errorLabel', { retryLabel: 'Retry' }],
    ['retryLabel', 'ListPopover needs a retryLabel', { errorLabel: 'Failed' }]
  ])('throws without its %s only in the error case', async (name, message, rest) => {
    const user = userEvent.setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = await open(user, {}) // no error: neither text is asked for
    unmount()
    document.getElementById('app-modals')?.remove()
    render(<Boundary>{list({ error: true, ...rest })}</Boundary>)
    await user.click(pill())
    await waitFor(() => expect(boundary()).toHaveTextContent(message))
    error.mockRestore()
  })
})

describe('ListPopover · error', () => {
  const errorProps = { error: true, errorLabel: 'We could not load the types.', retryLabel: 'Retry' }

  it('keeps «All» pickable, draws no items nor «no results», and shows a notice with a retry button below the list', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onChange = vi.fn()
    const { popup, box } = await open(user, { ...errorProps, onRetry, onChange, noResultsLabel: undefined })
    expect(options(box).map(option => option.textContent)).toEqual(['All'])
    const notice = within(popup).getByText('We could not load the types.').closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(box.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    await user.click(within(notice).getByRole('button', { name: 'Retry', hidden: true }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Type', hidden: true })).toBeInTheDocument() // retry does not close it
    await user.type(searchOf(popup), 'zzz')
    expect(within(popup).queryByText('No results found')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  // review R-5: the error is announced by the one live region of the popup, also when it arrives with the popover open
  it('writes the error in the one status of the popup; the notice inside has no role of its own', async () => {
    const user = userEvent.setup()
    const view = await open(user, { items: [], loading: true })
    const status = within(view.popup).getByRole('status', { hidden: true })
    expect(status).toHaveTextContent('Loading...')
    view.rerender(list({ items: [], ...errorProps, onRetry: () => {} }))
    const statuses = within(view.popup).getAllByRole('status', { hidden: true })
    expect(statuses).toEqual([status])
    expect(status).toHaveTextContent('We could not load the types.')
    expect(status.querySelector('.odc-notice')).not.toHaveAttribute('role')
  })

  it('«All» still picks null in the error case', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { box } = await open(user, { ...errorProps, value: 3, valueLabel: 'Coffee & Smoothies', onChange })
    await user.click(optionOf(box, 'All'))
    expect(onChange).toHaveBeenCalledWith(null, null)
  })
})

describe('ListPopover · type-ahead and Enter in the search', () => {
  it('a printable key on an option goes on in the search field', async () => {
    const user = userEvent.setup()
    const { popup, box } = await open(user)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(optionOf(box, 'Restaurant')).toHaveFocus()
    await user.keyboard('g')
    expect(searchOf(popup)).toHaveFocus()
    expect(searchOf(popup)).toHaveValue('g')
    await user.keyboard('r')
    expect(searchOf(popup)).toHaveValue('gr')
    expect(options(box).map(option => option.textContent)).toEqual(['All', 'Grocery'])
  })

  it('Space on an option picks it (it is not type-ahead)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    await open(user, { onChange })
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith(1, ITEMS[0])
  })

  it('Enter in the search field does nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { popup } = await open(user, { onChange })
    await waitFor(() => expect(searchOf(popup)).toHaveFocus())
    await user.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Type', hidden: true })).toBeInTheDocument()
    expect(searchOf(popup)).toHaveFocus()
  })
})

describe('ListPopover · picking what is already chosen', () => {
  it('only closes: onChange is not called', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { box } = await open(user, { value: '3', onChange })
    await user.click(optionOf(box, 'Coffee & Smoothies'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type', hidden: true })).toBeNull(), { timeout: 4000 })
    expect(onChange).not.toHaveBeenCalled()
    expect(pill()).toHaveFocus()
  })

  it('«All» with no value only closes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { box } = await open(user, { onChange })
    await user.click(optionOf(box, 'All'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type', hidden: true })).toBeNull(), { timeout: 4000 })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ListPopover · stylesheet', () => {
  const css = readFileSync(resolve(__dirname, '../list-popover.css'), 'utf8')
  const mediaMark = '@media (pointer: coarse), (max-width: 767px)'
  const coarse = css.split(mediaMark).slice(1).join('\n')
  const outside = css.split(mediaMark)[0]

  it('options are 32px with a mouse and 44px below 768px or with a coarse pointer', () => {
    expect(outside).toMatch(/\.odc-list-popover-option\s*\{[^}]*min-block-size:\s*var\(--od-x-control-height\)/)
    expect(coarse).toMatch(/\.odc-list-popover-option\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })

  it('every row keeps a check slot; the chosen one is medium weight, driven by aria-selected', () => {
    expect(css).toMatch(/\.odc-list-popover-check\s*\{[^}]*inline-size:\s*var\(--od-x-icon-sm\)/)
    expect(css).toMatch(/\.odc-list-popover-option\[aria-selected='true'\] \.odc-orders-picker-name\s*\{[^}]*font-weight:\s*var\(--od-font-weight-medium\)/)
    expect(css).toMatch(/:focus-visible\s*\{[^}]*var\(--od-focus-ring-width\)/)
  })

  it('isolates the direction of a name, and collapses the empty status without dropping it', () => {
    expect(css).toMatch(/\.odc-list-popover-option \.odc-orders-picker-name\s*\{[^}]*unicode-bidi:\s*isolate/)
    expect(css).toMatch(/\.odc-list-popover-status:empty\s*\{[^}]*padding:\s*0/)
    expect(css).not.toMatch(/display:\s*none/)
  })

  // redesign stores 2.D, R-1: a height here won over the picker's cap and the list showed 17 rows, not eight
  it('leaves the height of the list to the picker (eight rows at a time, like the Driver checklist)', () => {
    expect(css).not.toMatch(/\.odc-list-popover-list\s*\{[^}]*max-block-size/)
  })

  // review R-4 and R-6: the bar's notice margins are taken back, and the status text starts where the names start
  it('lines the notice and the status text up with the rows', () => {
    expect(css).toMatch(/\.odc-list-popover-status \.odc-notice\s*\{[^}]*margin:\s*0/)
    expect(css).toMatch(/\.odc-list-popover-status \.odc-orders-picker-empty\s*\{[^}]*padding-inline:\s*calc\(var\(--od-x-space-1-5\) \+ var\(--od-x-icon-sm\) \+ var\(--od-space-2\)\)/)
  })

  it('uses no physical properties and never breaks words anywhere', () => {
    expect(css).not.toMatch(/(?<![-\w])(margin|padding)-(left|right|top|bottom)\b|(?<![-\w])(left|right|width|height)\s*:/)
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/)
  })
})
