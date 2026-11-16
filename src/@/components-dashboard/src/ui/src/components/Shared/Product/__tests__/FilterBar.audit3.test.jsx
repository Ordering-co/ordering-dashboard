import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterChips, FilterPill } from '../FilterBar'

// redesign 5.2 audit-3 (P2-2, P2-5, P3 «one Clear filters»). The stacking tests (P2-1) went with the stacked
// layout: redesign F1b (D-06) made the bar one row at every width above the phone, with the pills that do not fit
// in a «+N» menu (FilterBar.f1b.test.jsx).
const renderBar = ({ pills = ['Date', 'Business'], tools = <span>tools</span>, clear, ...props } = {}) => render(
  <FilterBar
    label='Order filters'
    search={<span>search</span>}
    filters={pills.map(name => <FilterPill key={name} label={name} />)}
    more={<Button>Filters</Button>}
    clear={clear}
    tools={tools}
    {...props}
  />
)
const bar = () => screen.getByRole('group', { name: 'Order filters' })

describe('FilterBar tools hide only on a phone (P2-2)', () => {
  it('does not hide the tools by container width, only by viewport width', () => {
    const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
    const phone = css.match(/@container\s*\(max-width:\s*599px\)\s*{([\s\S]*?)\n}\n/)
    expect(phone).not.toBeNull()
    expect(phone[1]).not.toMatch(/odc-filterbar-tools\s*{[^}]*display:\s*none/)
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)\s*{[^}]*\.odc-filterbar-tools\s*{[^}]*display:\s*none/)
  })

  // redesign F1b: a narrow list on a screen that is not a phone is the same one row, tools included (their cell
  // is the bar's own last grid column); the narrow-container rules belong to the phone only.
  it('keeps the tools in the one row when the screen is not a phone: the narrow container rules are phone-only', () => {
    const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
    const narrow = css.match(/@container\s*\(max-width:\s*599px\)\s*{([\s\S]*?)\n}\n/)[1]
    expect(narrow.trim()).toMatch(/^@media\s*\(max-width:\s*767px\)\s*{/)
    expect(narrow).not.toMatch(/min-width:\s*768px/)
    expect(narrow).not.toMatch(/grid-template-areas:[^;]*tools/)
  })

  it('marks the bar that has tools', () => {
    renderBar()
    expect(bar()).toHaveAttribute('data-tools', '')
    document.body.innerHTML = ''
    render(<FilterBar label='Order filters' search={<span>s</span>} />)
    expect(bar()).not.toHaveAttribute('data-tools')
  })
})

describe('FilterBar shows one «Clear filters» on desktop (P3)', () => {
  // redesign F1b: the chips «Clear all» steps aside wherever the bar's own button shows, which is everywhere but a phone.
  it('marks a bar that has its own clear button, and hides the chips «Clear all» except on a phone only for it', () => {
    renderBar({ clear: <Button variant='ghost'>Clear filters</Button> })
    expect(bar()).toHaveAttribute('data-clear', '')
    const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
    expect(css).toMatch(/\n\.odc-filterbar\[data-clear\]\s+\.odc-chips-clear\s*{[^}]*display:\s*none/)
    const phone = css.match(/@container\s*\(max-width:\s*599px\)\s*{([\s\S]*?)\n}\n/)[1]
    expect(phone).toMatch(/\.odc-filterbar\[data-clear\]\s+\.odc-chips-clear\s*{[^}]*display:\s*inline-flex/)
  })

  it('leaves the chips «Clear all» alone in a bar without a clear button', () => {
    renderBar()
    expect(bar()).not.toHaveAttribute('data-clear')
  })
})

const Harness = ({ initial = ['date', 'city'], withMore = true }) => {
  const [keys, setKeys] = useState(initial)
  const chips = keys.length
    ? (
      <FilterChips
        label='Active filters'
        clearAllLabel='Clear all'
        onClearAll={() => setKeys([])}
        chips={keys.map(key => ({
          key,
          label: `${key}: x`,
          removeLabel: `Remove ${key}`,
          onRemove: () => setKeys(current => current.filter(item => item !== key))
        }))}
      />
      )
    : undefined
  return (
    <>
      <button type='button' onClick={() => setKeys([])}>Drop chips</button>
      <FilterBar
        label='Order filters'
        search={<input aria-label='Search' />}
        more={withMore ? <Button>Filters</Button> : undefined}
        clear={keys.length ? <Button variant='ghost'>Clear filters</Button> : undefined}
        chips={chips}
      />
    </>
  )
}

describe('FilterBar keeps the focus when the last chip goes (P2-5)', () => {
  it('moves the focus to the «more» button when the last chip is removed with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['date']} />)
    screen.getByRole('button', { name: 'Remove date' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('also when the chips go through «Clear all»', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus()
  })

  it('keeps the old behaviour while a chip remains: the focus goes to the next chip', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Remove date' }))
    expect(screen.getByRole('button', { name: 'Remove city' })).toHaveFocus()
  })

  it('does not steal the focus when it is somewhere else as the chips go', async () => {
    render(<Harness />)
    const outside = screen.getByRole('button', { name: 'Drop chips' })
    outside.focus()
    // Dropping the chips from outside the bar: the focus stays where the user is.
    outside.click()
    await screen.findByRole('button', { name: 'Filters' })
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(outside).toHaveFocus()
  })

  it('falls back to the search field when the bar has no «more» button', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['date']} withMore={false} />)
    await user.click(screen.getByRole('button', { name: 'Remove date' }))
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()
  })

  it('does nothing on mount or when a bar never had chips', () => {
    render(<FilterBar label='Order filters' search={<input aria-label='Search' />} more={<Button>Filters</Button>} />)
    expect(document.body).toHaveFocus()
  })
})
