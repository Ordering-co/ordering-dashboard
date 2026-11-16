/* eslint-disable import/first */
// redesign F6h-4 (A2): with chips, the field of a C18 multi-select has no interactive element inside another. The field is
// a plain container; the opener is its own button and every chip's X is a sibling of it, not a child. axe runs on the closed
// field (jsdom: structural rules only).
import React from 'react'
import { createRequire } from 'node:module'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }]
}))

import { MultiSelect } from './MultiSelect'
import { SelectOptionContent } from './SelectOption'
import { SelectSurfaceContext } from './selectPlacement'

const requireFrom = createRequire(import.meta.url)
const axe = createRequire(requireFrom.resolve('@axe-core/playwright'))('axe-core')

const audit = async root => {
  let result
  await act(async () => {
    result = await axe.run(root, { runOnly: { type: 'rule', values: ['nested-interactive', 'aria-allowed-role', 'aria-valid-attr-value', 'button-name'] }, resultTypes: ['violations'] })
  })
  return result.violations.map(violation => `${violation.id} (${violation.impact}) x${violation.nodes.length}`)
}

const people = ['Alba', 'Bruno', 'Berta', 'Carla'].map((name, index) => ({
  value: index + 1,
  name,
  content: <SelectOptionContent label={name} media={{ kind: 'business', name }} meta={`${index} orders`} />
}))

const wrap = ui => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>{ui}</SelectSurfaceContext.Provider>
  </ThemeProvider>
)
const setup = (props = {}) => render(wrap(
  <MultiSelect placeholder='Select business' options={people} defaultValue={[2, 3]} onChange={props.onChange || vi.fn()} {...props} />
))
const root = () => document.querySelector('.od-multi-select-root')
const opener = () => within(root()).getByRole('button', { name: /^Select business/ })
const removeButton = name => within(root()).getByRole('button', { name: `Remove ${name}` })

describe('MultiSelect with chips, no interactive inside another (A2)', () => {
  it('passes axe nested-interactive with two chips', async () => {
    setup()
    expect(await audit(root())).toEqual([])
  })

  it('has no button, role=button or tabindex element inside another interactive element', () => {
    setup()
    const interactive = [...root().querySelectorAll('button, [role="button"], [tabindex]')]
    expect(interactive.length).toBe(3)
    for (const node of interactive) expect(node.parentElement.closest('button, [role="button"]')).toBeNull()
  })

  it('keeps the chips, the text of each and «+N» in the field, and the opener first in the tab order', () => {
    setup()
    const field = document.querySelector('.od-multi-select-trigger')
    const chips = [...field.querySelectorAll('.od-multi-select-chip-content')].map(node => node.textContent)
    expect(chips).toHaveLength(2)
    expect(chips[0]).toContain('Bruno')
    expect(chips[1]).toContain('Berta')
    expect(field.querySelector('.od-multi-select-more')).toBeInTheDocument()
    expect(field.querySelector('.od-multi-select-chevron')).toBeInTheDocument()
    const order = [...root().querySelectorAll('button')].map(node => node.getAttribute('aria-label') || node.className)
    expect(order[0]).toMatch(/opener|Select business/)
    expect(order.slice(1)).toEqual(['Remove Bruno', 'Remove Berta'])
  })

  it('names the opener with the field label and the chosen values, and carries the popup attributes', () => {
    setup()
    expect(opener()).toHaveAccessibleName('Select business Bruno, Berta')
    expect(opener()).toHaveAttribute('aria-haspopup', 'listbox')
    expect(opener()).toHaveAttribute('aria-expanded', 'false')
  })

  it('takes the name of the label the consumer points to, plus the chosen values', () => {
    render(wrap(
      <>
        <span id='business-label'>Business</span>
        <MultiSelect placeholder='Select business' ariaLabelledBy='business-label' options={people} defaultValue={[2, 3]} onChange={vi.fn()} />
      </>
    ))
    expect(within(root()).getByRole('button', { name: 'Business Bruno, Berta' })).toBeInTheDocument()
  })

  it('opens from the opener, from the free area and from a chip text, and the second click closes', () => {
    setup()
    const field = document.querySelector('.od-multi-select-trigger')
    fireEvent.click(opener())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.click(opener())
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(field)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.click(field)
    fireEvent.click(field.querySelector('.od-multi-select-chip-content'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('a mouseup on the field while the list is open does not close it before the click toggles it', () => {
    setup()
    const field = document.querySelector('.od-multi-select-trigger')
    fireEvent.click(opener())
    fireEvent.mouseUp(field.querySelector('.od-multi-select-chip-content'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.mouseUp(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens with Enter, Space and ArrowDown on the opener, ArrowDown landing on the chosen row', async () => {
    const user = userEvent.setup()
    setup()
    opener().focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(opener()).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Bruno/ })).toHaveFocus()
  })

  it('Tab goes from the opener to each X', async () => {
    const user = userEvent.setup()
    setup()
    opener().focus()
    await user.tab()
    expect(removeButton('Bruno')).toHaveFocus()
    await user.tab()
    expect(removeButton('Berta')).toHaveFocus()
  })

  it('an X removes its value without opening the list, and the focus goes to the neighbour X, then to the opener', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setup({ onChange })
    await user.click(removeButton('Bruno'))
    expect(onChange).toHaveBeenCalledWith(2)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(removeButton('Berta')).toHaveFocus()
    await user.click(removeButton('Berta'))
    expect(onChange).toHaveBeenLastCalledWith(3)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(within(root()).queryByRole('button', { name: /^Remove / })).toBeNull()
    expect(document.activeElement).toBe(within(root()).getByRole('button', { name: /^Select business/ }))
  })

  it('an X pressed with the keyboard removes without opening', async () => {
    const user = userEvent.setup()
    setup()
    removeButton('Bruno').focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(within(root()).queryByRole('button', { name: 'Remove Bruno' })).toBeNull()
  })

  it('the open popup keeps passing axe with the chips in the field', async () => {
    setup()
    fireEvent.click(opener())
    expect(await audit(root())).toEqual([])
  })
})
