/* eslint-disable import/first */
// redesign F6a (D-12): Esc closes only the innermost open layer. A select inside the Filters sheet is a
// layer of its own: Esc with its list open, or right after choosing an option, must not close the sheet.
import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { Sheet } from '../Product/Sheet'
import { FirstSelect } from './FirstSelect'
import { MultiSelect } from './MultiSelect'
import { SelectSurfaceContext } from './selectPlacement'

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const text = value => <span>{value}</span>
const items = [
  { value: 1, content: text('Ana') },
  { value: 2, content: text('Beto') },
  { value: 3, content: text('Berta') }
]

const Harness = ({ kind, onOpenChange }) => {
  const [open, setOpen] = useState(true)
  const [one, setOne] = useState(1)
  const [many, setMany] = useState([1])
  return (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
        <Sheet
          open={open}
          onOpenChange={next => { onOpenChange?.(next); setOpen(next) }}
          title='Filters'
          closeLabel='Close'
        >
          {kind === 'first'
            ? <FirstSelect placeholder='Pick one' options={items} defaultValue={one} onChange={setOne} />
            : <MultiSelect placeholder='Pick people' options={items} defaultValue={many} onChange={v => setMany(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v])} />}
        </Sheet>
      </SelectSurfaceContext.Provider>
    </ThemeProvider>
  )
}

// redesign F6h-4: with chips the multi-select's field is a container and its opener is the focusable button
const trigger = () => document.querySelector('.od-first-select-trigger, .od-multi-select-opener, .od-multi-select-trigger:not([data-chips-field])')
const sheetOpen = () => screen.queryByRole('dialog', { name: 'Filters' })

describe.each(['first', 'multi'])('Esc inside the Filters sheet, %s select', kind => {
  it('with the list open, Esc closes only the list; the focus is on the trigger and the sheet stays', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness kind={kind} onOpenChange={onOpenChange} />)
    await waitFor(() => expect(sheetOpen()).not.toBeNull())
    await user.click(trigger())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(sheetOpen()).not.toBeNull()
  })

  it('choosing with the pointer, the list closes and the focus is on the trigger; the sheet stays', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness kind={kind} onOpenChange={onOpenChange} />)
    await waitFor(() => expect(sheetOpen()).not.toBeNull())
    await user.click(trigger())
    await user.click(screen.getByRole('option', { name: 'Beto' }))
    if (kind === 'first') expect(screen.queryByRole('listbox')).toBeNull()
    else await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(trigger())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(sheetOpen()).not.toBeNull()
  })

  it('choosing with the keyboard and pressing Esc at once: the first Esc after it closes the sheet only if nothing is open', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness kind={kind} onOpenChange={onOpenChange} />)
    await waitFor(() => expect(sheetOpen()).not.toBeNull())
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    if (kind === 'multi') {
      await user.keyboard('{Escape}')
      expect(onOpenChange).not.toHaveBeenCalled()
    }
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(sheetOpen()).not.toBeNull()
    // a subsequent Esc, with nothing open, closes the sheet
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
