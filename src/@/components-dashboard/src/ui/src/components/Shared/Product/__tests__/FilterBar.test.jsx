import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Clock } from '../../Icon'
import { Button } from '../Button'
import { FilterBar, FilterChips, FilterPill, InlineNotice, SearchField } from '../FilterBar'

const Controlled = ({ initial = '', onClear, inputRef }) => {
  const [value, setValue] = useState(initial)
  return (
    <SearchField
      value={value}
      onChange={setValue}
      onClear={onClear}
      inputRef={inputRef}
      label='Search orders'
      placeholder='Search'
      clearLabel='Clear search'
    />
  )
}

const ChipsHarness = ({ initial, onRemoveSpy, onClearAll }) => {
  const [chips, setChips] = useState(initial)
  return (
    <FilterChips
      label='Active filters'
      clearAllLabel='Clear all'
      onClearAll={onClearAll}
      chips={chips.map(chip => ({
        ...chip,
        removeLabel: `Remove ${chip.label}`,
        onRemove: () => {
          onRemoveSpy(chip.key)
          setChips(current => current.filter(item => item.key !== chip.key))
        }
      }))}
    />
  )
}

const CHIPS = [
  { key: 'status', label: 'Status: Pending' },
  { key: 'city', label: 'City: Madrid' },
  { key: 'driver', label: 'Driver: Ana' }
]

describe('FilterBar (C7)', () => {
  it('is a named group that places each slot', () => {
    render(
      <FilterBar
        label='Order filters'
        search={<span>search slot</span>}
        filters={<span>pills slot</span>}
        more={<span>more slot</span>}
        clear={<span>clear slot</span>}
        tools={<span>tools slot</span>}
        chips={<span>chips slot</span>}
        notice={<span>notice slot</span>}
      />
    )
    const group = screen.getByRole('group', { name: 'Order filters' })
    ;['search', 'pills', 'more', 'clear', 'tools', 'chips', 'notice'].forEach(slot => {
      expect(within(group).getByText(`${slot} slot`)).toBeInTheDocument()
    })
  })

  it('omits the rows and slots that are not given', () => {
    const { container } = render(<FilterBar label='Order filters' search={<span>search slot</span>} />)
    expect(container.querySelector('.odc-filterbar-chips')).toBeNull()
    expect(container.querySelector('.odc-filterbar-tools')).toBeNull()
    expect(container.querySelector('.odc-filterbar-filters')).toBeNull()
  })

  it('refuses a bar without a name', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<FilterBar search={<span>x</span>} />)).toThrow('FilterBar needs a label')
  })

  // redesign 5.2: a narrow bar scrolls its pills sideways instead of hiding the secondary
  // ones — a hidden pill was a filter nobody could reach at 1024px or on a phone.
  // redesign 5.2: one row at every width above the phone; only the pills slot scrolls, so
  // search, «more» and «clear» never leave the view, and the search gives up width first.
  it('keeps one row without hiding a filter: it is a container, only the pills scroll, tools never wrap', () => {
    const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
    expect(css).toMatch(/container-type:\s*inline-size/)
    expect(css).toMatch(/\n\.odc-filterbar-start\s*{[^}]*flex-wrap:\s*nowrap/)
    expect(css).toMatch(/\n\.odc-filterbar-filters\s*{[^}]*overflow-x:\s*auto/)
    expect(css).toMatch(/\n\.odc-search\s*{[^}]*min-inline-size:\s*var\(--od-x-search-min\)/)
    expect(css).not.toMatch(/\.odc-pill\[data-priority='secondary'\]\s*{\s*display:\s*none/)
    expect(css).not.toMatch(/\.odc-filterbar-filters\s*{\s*display:\s*none/)
    expect(css).toMatch(/\.odc-filterbar-tools\s*{[^}]*flex-wrap:\s*nowrap/)
    expect(css).toMatch(/@container[^{]*\(max-width:\s*599px\)/)
  })

  // redesign audit-1: beside the detail panel the list is narrow.
  // redesign F1b (D-06): no pills row of their own any more: the list stays one row, with the pills that do not
  // fit in «+N» (FilterBar.f1b.test.jsx), so opening an order never changes the height of the bar.
  it('keeps one row in a narrow list and the tools on it: no grid area for the pills outside the phone', () => {
    const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
    expect(css).not.toMatch(/'pills pills pills pills'/)
    expect(css).not.toMatch(/@container\s*\(min-width:\s*600px\)/)
    expect(css).toMatch(/\n\.odc-filterbar-tools\s*{[^}]*display:\s*flex/)
  })
})

describe('SearchField', () => {
  it('is a searchbox with a name and no clear button while empty', () => {
    render(<Controlled />)
    expect(screen.getByRole('searchbox', { name: 'Search orders' })).toHaveAttribute('placeholder', 'Search')
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('reports what is typed', async () => {
    const onChange = vi.fn()
    render(<SearchField value='' onChange={onChange} label='Search orders' clearLabel='Clear search' />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search orders' }), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('clears the value, notifies onClear and returns the focus to the input', async () => {
    const onClear = vi.fn()
    render(<Controlled initial='burger' onClear={onClear} />)
    const input = screen.getByRole('searchbox', { name: 'Search orders' })
    expect(input).toHaveValue('burger')
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input).toHaveValue('')
    expect(onClear).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    expect(input).toHaveFocus()
  })

  it('hands the input to inputRef', () => {
    const inputRef = React.createRef()
    render(<Controlled inputRef={inputRef} />)
    expect(inputRef.current).toBe(screen.getByRole('searchbox'))
  })

  it('refuses a search without a name or without a clear label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SearchField value='' onChange={() => {}} clearLabel='Clear' />)).toThrow('SearchField needs a label')
    expect(() => render(<SearchField value='' onChange={() => {}} label='Search' />)).toThrow('SearchField needs a clearLabel')
  })
})

describe('FilterPill', () => {
  it('is a plain button when inactive, with its priority', () => {
    render(<FilterPill label='Status' priority='secondary' onClick={() => {}} />)
    const pill = screen.getByRole('button', { name: 'Status' })
    expect(pill).toHaveAttribute('type', 'button')
    expect(pill).toHaveAttribute('data-priority', 'secondary')
    expect(pill).not.toHaveAttribute('data-active')
  })

  it('is active with a value, and its name carries label and value', () => {
    render(<FilterPill icon={Clock} label='Status' value='Pending' onClick={() => {}} />)
    const pill = screen.getByRole('button', { name: 'Status Pending' })
    expect(pill).toHaveAttribute('data-active')
    expect(pill.querySelector('svg')).not.toBeNull()
  })

  it('exposes expanded and popup state and reports the click', async () => {
    const onClick = vi.fn()
    render(<FilterPill label='Status' expanded hasPopup='dialog' onClick={onClick} />)
    const pill = screen.getByRole('button', { name: 'Status' })
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    expect(pill).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(pill)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('leaves aria-expanded out when it opens nothing', () => {
    render(<FilterPill label='Status' onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Status' })).not.toHaveAttribute('aria-expanded')
  })

  it('refuses a pill without a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<FilterPill onClick={() => {}} />)).toThrow('FilterPill needs a label')
  })
})

describe('FilterChips', () => {
  it('is a named list with one chip per value and a remove button each', () => {
    render(<ChipsHarness initial={CHIPS} onRemoveSpy={() => {}} onClearAll={() => {}} />)
    const list = screen.getByRole('list', { name: 'Active filters' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    expect(within(list).getByText('City: Madrid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove City: Madrid' })).toBeInTheDocument()
  })

  it('removes only its own chip and moves the focus to the next one', async () => {
    const onRemoveSpy = vi.fn()
    render(<ChipsHarness initial={CHIPS} onRemoveSpy={onRemoveSpy} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove City: Madrid' }))
    expect(onRemoveSpy).toHaveBeenCalledTimes(1)
    expect(onRemoveSpy).toHaveBeenCalledWith('city')
    expect(screen.queryByText('City: Madrid')).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove Driver: Ana' })).toHaveFocus()
  })

  it('moves the focus to the previous chip when the last one goes', async () => {
    render(<ChipsHarness initial={CHIPS} onRemoveSpy={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Driver: Ana' }))
    expect(screen.getByRole('button', { name: 'Remove City: Madrid' })).toHaveFocus()
  })

  it('removes with the keyboard', async () => {
    const onRemoveSpy = vi.fn()
    render(<ChipsHarness initial={CHIPS} onRemoveSpy={onRemoveSpy} />)
    screen.getByRole('button', { name: 'Remove Status: Pending' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onRemoveSpy).toHaveBeenCalledWith('status')
    expect(screen.getByRole('button', { name: 'Remove City: Madrid' })).toHaveFocus()
  })

  it('clears everything through the link button', async () => {
    const onClearAll = vi.fn()
    render(<ChipsHarness initial={CHIPS} onRemoveSpy={() => {}} onClearAll={onClearAll} />)
    const clearAll = screen.getByRole('button', { name: 'Clear all' })
    expect(clearAll).toHaveAttribute('data-variant', 'link')
    await userEvent.click(clearAll)
    expect(onClearAll).toHaveBeenCalledOnce()
  })

  it('has no clear-all without its label and handler', () => {
    render(<ChipsHarness initial={CHIPS} onRemoveSpy={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
  })

  it('refuses a list without a name or a chip without a remove label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<FilterChips chips={[]} />)).toThrow('FilterChips needs a label')
    expect(() => render(
      <FilterChips label='Active filters' chips={[{ key: 'a', label: 'A', onRemove: () => {} }]} />
    )).toThrow('IconButton needs a label')
  })
})

describe('InlineNotice', () => {
  it('is an inline status with its tone and a dot when it has no icon', () => {
    const { container } = render(<InlineNotice tone='warning'>With filters you may miss new orders</InlineNotice>)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('With filters you may miss new orders')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(container.querySelector('.odc-notice-dot')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws the icon instead of the dot and keeps an action at the end', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <InlineNotice tone='info' icon={Clock} action={<Button size='sm' onClick={onClick}>Refresh</Button>}>
        Updated
      </InlineNotice>
    )
    expect(container.querySelector('.odc-notice-dot')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('rejects an unknown tone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<InlineNotice tone='loud'>x</InlineNotice>)).toThrow('InlineNotice tone must be')
  })
})

describe('FilterBar flush (FA-2)', () => {
  const bar = props => render(
    <FilterBar
      label='Order filters'
      search={<span>search slot</span>}
      chips={<span>chips slot</span>}
      notice={<InlineNotice tone='warning'>Filters are on</InlineNotice>}
      {...props}
    />
  )

  it('marks the bar flush only when asked, and leaves it as it was otherwise', () => {
    const { rerender } = bar()
    const group = screen.getByRole('group', { name: 'Order filters' })
    expect(group).not.toHaveAttribute('data-flush')
    rerender(
      <FilterBar label='Order filters' search={<span>search slot</span>} flush />
    )
    expect(screen.getByRole('group', { name: 'Order filters' })).toHaveAttribute('data-flush', '')
    rerender(<FilterBar label='Order filters' search={<span>search slot</span>} flush={false} />)
    expect(screen.getByRole('group', { name: 'Order filters' })).not.toHaveAttribute('data-flush')
  })

  it('does not leak flush to the DOM as an unknown attribute', () => {
    bar({ flush: true })
    expect(screen.getByRole('group', { name: 'Order filters' })).not.toHaveAttribute('flush')
  })

  it('drops the page gutter from the main row, the chips and the notice, at every width', () => {
    const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
    // Sits after the phone container block, so it wins over the mobile gutter too.
    const flushAt = css.indexOf('[data-flush]')
    expect(flushAt).toBeGreaterThan(css.indexOf('@container (max-width: 599px)'))
    expect(css).toMatch(/\.odc-filterbar\[data-flush\]\s+\.odc-filterbar-main[^{]*{[^}]*padding-inline:\s*0/)
    expect(css).toMatch(/\.odc-filterbar\[data-flush\]\s+\.odc-filterbar-chips[^{]*{[^}]*padding-inline:\s*0/)
    expect(css).toMatch(/\.odc-filterbar\[data-flush\]\s+\.odc-notice[^{]*{[^}]*margin-inline:\s*0/)
    // The default gutters stay for bars that do not opt in.
    expect(css).toMatch(/\n\.odc-filterbar-main\s*{[^}]*padding:\s*var\(--od-space-3\)\s+var\(--od-x-page-gutter\)/)
  })
})
