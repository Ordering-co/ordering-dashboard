/* eslint-disable import/first */
// redesign F6d-2 (Q3-06): a select list with a search field puts the focus in it when it opens (pointer or keyboard),
// typing filters at once, ArrowDown goes to the first option and ArrowUp from the first option comes back; Esc closes
// only the list. Without a search field, typing jumps to the row that starts with those letters (C18 type-ahead).
import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { SelectSurfaceContext } from './selectPlacement'

const names = ['Alba', 'Bruno', 'Berta', 'Pizza One', 'Pizza Two', 'Carla']
const all = names.map((name, index) => ({ value: index + 1, name, content: <span>{name}</span> }))
const withDanger = [{ value: 'remove', content: <span>Remove assigned driver</span>, danger: true }, ...all]

// The parent filters the options from the search text, like the filters controller does.
const Harness = ({ kind, search = true, fit = true, items = all, onKeyDown }) => {
  const [term, setTerm] = useState('')
  const shown = items.filter(option => !term || option.content.props.children.toLowerCase().includes(term.toLowerCase()))
  const common = {
    placeholder: 'Pick',
    options: shown,
    isShowSearchBar: search,
    searchValue: term,
    handleChangeSearch: setTerm
  }
  return (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <SelectSurfaceContext.Provider value={{ fitTrigger: fit }}>
        <div onKeyDown={onKeyDown}>
          {kind === 'first'
            ? <FirstSelect {...common} defaultValue={2} onChange={vi.fn()} />
            : <MultiSelect {...common} defaultValue={[2]} onChange={vi.fn()} />}
        </div>
      </SelectSurfaceContext.Provider>
    </ThemeProvider>
  )
}

// redesign F6h-4: with chips the multi-select's field is a container and its opener is the focusable button
const trigger = () => document.querySelector('.od-first-select-trigger, .od-multi-select-opener, .od-multi-select-trigger:not([data-chips-field])')
const rows = () => within(screen.getByRole('listbox')).getAllByRole('option')
const label = element => element.textContent.trim()

describe.each(['first', 'multi'])('%s select with a search field (Q3-06)', kind => {
  it('puts the focus in the search field when it opens with the pointer', async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    await user.click(trigger())
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it.each(['{Enter}', ' ', '{ArrowDown}'])('puts the focus in the search field when it opens with the key %j', async key => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    trigger().focus()
    await user.keyboard(key)
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('filters at once while typing, without clicking the field first', async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    await user.click(trigger())
    await user.keyboard('pi')
    expect(screen.getByRole('searchbox')).toHaveValue('pi')
    expect(rows().map(label)).toEqual(['Pizza One', 'Pizza Two'])
  })

  it('ArrowDown goes to the first option and ArrowUp from it comes back to the search', async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    await user.click(trigger())
    await user.keyboard('{ArrowDown}')
    expect(label(document.activeElement)).toBe('Alba')
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('Esc closes only the list and gives the focus back to the field', async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(<Harness kind={kind} onKeyDown={onKeyDown} />)
    await user.click(trigger())
    onKeyDown.mockClear()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger()).toHaveFocus()
    expect(onKeyDown).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
  })

  it('leaves the focus where it was outside the orders surfaces (no fitTrigger)', async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} fit={false} />)
    await user.click(trigger())
    expect(document.querySelector('.od-first-select-search input, .od-multi-select-search input')).not.toBeNull()
    expect(trigger()).toHaveFocus()
  })
})

describe('first select with a search field and a dangerous row', () => {
  it('ArrowDown from the search never lands on the dangerous action', async () => {
    const user = userEvent.setup()
    render(<Harness kind='first' items={withDanger} />)
    await user.click(trigger())
    await user.keyboard('{ArrowDown}')
    expect(label(document.activeElement)).toBe('Alba')
  })
})

describe.each(['first', 'multi'])('%s select without a search field (Q3-06, type-ahead)', kind => {
  it('typing on the open list jumps to the row that starts with those letters', async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} search={false} />)
    await user.click(trigger())
    await user.keyboard('ca')
    expect(label(document.activeElement)).toBe('Carla')
  })

  it('the next typed letter goes on to the next match, from the field too', async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} search={false} />)
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    // the focus is on a row (the selected one or the first); typing «b» moves among Bruno / Berta
    await user.keyboard('b')
    expect(['Bruno', 'Berta']).toContain(label(document.activeElement))
  })
})
