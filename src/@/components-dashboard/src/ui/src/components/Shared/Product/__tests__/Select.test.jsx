// redesign (K-1, R-4): P/Select and P/SelectField, the form select of Product. A field-like combobox button opens a
// listbox of native option buttons; the arrows move the focus and never the selection; Enter, Space and a click pick and close.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Select, SelectField } from '../Select'

afterEach(() => document.getElementById('app-modals')?.remove())

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 1, label: 'Delivery' },
  { value: 2, label: 'Pickup' },
  { value: 3, label: 'Eat in', keywords: ['dine'] },
  { value: 4, label: 'Café', disabled: true },
  { value: 5, label: 'Curbside' }
]
const SEARCH = { searchable: true, searchLabel: 'Search', clearSearchLabel: 'Clear search', noResultsLabel: 'No results found' }

const field = (props = {}) => (
  <SelectField label='Delivery type' options={OPTIONS} value='all' onValueChange={() => {}} placeholder='Select delivery type' {...props} />
)

const trigger = () => screen.getByRole('combobox')
const listbox = () => screen.findByRole('listbox', { name: 'Delivery type', hidden: true })
const optionsOf = box => within(box).getAllByRole('option', { hidden: true })
const optionOf = (box, name) => within(box).getByRole('option', { name, hidden: true })

describe('Select · the trigger', () => {
  it('is a native button named by the visible label and the chosen option', () => {
    render(field({ value: 2 }))
    expect(trigger().tagName).toBe('BUTTON')
    expect(trigger()).toHaveAttribute('type', 'button')
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveAccessibleName('Delivery type Pickup')
    expect(document.querySelector('.odc-field-label')).toHaveTextContent('Delivery type')
    expect(document.querySelector('.odc-field-label')).toHaveAttribute('for', trigger().id)
  })

  it('matches the value as text and shows the placeholder (data-empty) without one', () => {
    const { rerender } = render(field({ value: '3' }))
    expect(trigger()).toHaveAccessibleName('Delivery type Eat in')
    rerender(field({ value: null }))
    expect(trigger()).toHaveAccessibleName('Delivery type Select delivery type')
    expect(trigger()).toHaveAttribute('data-empty')
  })

  it('shows valueLabel while the value is not among the options yet, else the placeholder (never the raw value)', () => {
    const { rerender } = render(field({ value: 99, valueLabel: 'Bakery' }))
    expect(trigger()).toHaveAccessibleName('Delivery type Bakery')
    expect(trigger()).not.toHaveAttribute('data-empty')
    rerender(field({ value: 99 }))
    expect(trigger()).toHaveAccessibleName('Delivery type Select delivery type')
    expect(trigger()).toHaveAttribute('data-empty')
  })

  it('is named by its own label outside a Field', () => {
    render(<Select label='Recipient' options={OPTIONS} value={1} onValueChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Recipient Delivery')
  })

  it('links the hint and the error, and is invalid with an error', () => {
    render(field({ hint: 'Applies to every order', error: 'Choose one' }))
    expect(trigger()).toHaveAccessibleDescription(/Applies to every order/)
    expect(trigger()).toHaveAccessibleDescription(/Choose one/)
    expect(trigger()).toHaveAttribute('aria-invalid', 'true')
    expect(trigger()).toHaveAttribute('data-invalid')
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    render(field({ disabled: true }))
    expect(trigger()).toBeDisabled()
    await user.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('throws when a name is missing and paints an empty one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Select options={OPTIONS} onValueChange={() => {}} />)).toThrow('Select needs a label')
    expect(() => render(<Select label='X' options={OPTIONS} searchable clearSearchLabel='c' />)).toThrow('Select needs a searchLabel')
    expect(() => render(<Select label='X' options={OPTIONS} searchable searchLabel='s' />)).toThrow('Select needs a clearSearchLabel')
    console.error.mockRestore()
    render(<Select label='' options={OPTIONS} value={1} onValueChange={() => {}} />)
    expect(trigger()).toHaveAccessibleName('Delivery')
  })
})

describe('Select · the list', () => {
  it('opens a listbox with every option, the chosen one selected and focused', async () => {
    const user = userEvent.setup()
    render(field({ value: 2 }))
    await user.click(trigger())
    const box = await listbox()
    expect(optionsOf(box).map(option => option.textContent)).toEqual(OPTIONS.map(option => option.label))
    expect(optionOf(box, 'Pickup')).toHaveAttribute('aria-selected', 'true')
    expect(optionsOf(box).filter(option => option.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(trigger()).toHaveAttribute('aria-controls', box.id)
    await waitFor(() => expect(optionOf(box, 'Pickup')).toHaveFocus())
  })

  it('hands back the option\'s own value on a click and closes with the focus on the trigger', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(field({ value: '2', onValueChange }))
    await user.click(trigger())
    await user.click(optionOf(await listbox(), 'Eat in'))
    expect(onValueChange).toHaveBeenCalledWith(3, OPTIONS[3])
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
    await waitFor(() => expect(trigger()).toHaveFocus())
  })

  it('only closes when the chosen option is picked again', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(field({ value: 2, onValueChange }))
    await user.click(trigger())
    await user.click(optionOf(await listbox(), 'Pickup'))
    expect(onValueChange).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })

  it('keeps a disabled option in the list, never chosen', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(field({ onValueChange }))
    await user.click(trigger())
    const cafe = optionOf(await listbox(), 'Café')
    expect(cafe).toBeDisabled()
    await user.click(cafe)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('closes with Escape, the focus back on the trigger, and the value unchanged', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(field({ onValueChange }))
    await user.click(trigger())
    await listbox()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
    await waitFor(() => expect(trigger()).toHaveFocus())
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe('Select · keyboard', () => {
  it('opens with ArrowDown (R-4), moves the focus without choosing, and picks with Enter', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(field({ value: 'all', onValueChange }))
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    const box = await listbox()
    await waitFor(() => expect(optionOf(box, 'All')).toHaveFocus())
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(optionOf(box, 'Pickup')).toHaveFocus()
    expect(optionOf(box, 'All')).toHaveAttribute('aria-selected', 'true')
    expect(onValueChange).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onValueChange).toHaveBeenCalledWith(2, OPTIONS[2])
  })

  it('opens with Enter and with Space, as a button does', async () => {
    const user = userEvent.setup()
    render(field())
    trigger().focus()
    await user.keyboard('{Enter}')
    await listbox()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
    await user.keyboard(' ')
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'true'))
  })

  it('skips disabled options with the arrows; Home and End go to the ends; one option is in the Tab order', async () => {
    const user = userEvent.setup()
    render(field({ value: 3 }))
    await user.click(trigger())
    const box = await listbox()
    await waitFor(() => expect(optionOf(box, 'Eat in')).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'Curbside')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(optionOf(box, 'All')).toHaveFocus()
    await user.keyboard('{End}')
    expect(optionOf(box, 'Curbside')).toHaveFocus()
    expect(optionsOf(box).filter(option => option.tabIndex === 0)).toEqual([optionOf(box, 'Curbside')])
  })

  it('jumps by the first letters typed when there is no search', async () => {
    const user = userEvent.setup()
    render(field({ value: 'all' }))
    await user.click(trigger())
    const box = await listbox()
    await waitFor(() => expect(optionOf(box, 'All')).toHaveFocus())
    await user.keyboard('p')
    expect(optionOf(box, 'Pickup')).toHaveFocus()
    // a second letter within half a second goes on with the same text: «cu» is Curbside, not the first «c»
    optionOf(box, 'All').focus()
    await new Promise(resolve => setTimeout(resolve, 520))
    await user.keyboard('cu')
    expect(optionOf(box, 'Curbside')).toHaveFocus()
  })

  it('Tab from the list closes it and goes on to the next control', async () => {
    const user = userEvent.setup()
    render(<>{field()}<button type='button'>Next</button></>)
    await user.click(trigger())
    await listbox()
    await user.tab()
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus())
  })
})

describe('Select · search', () => {
  it('opens with the focus on the search, filters by label and keywords without accents, and ArrowDown enters the list', async () => {
    const user = userEvent.setup()
    render(field(SEARCH))
    await user.click(trigger())
    const box = await listbox()
    const search = screen.getByRole('searchbox', { name: 'Search Delivery type', hidden: true })
    await waitFor(() => expect(search).toHaveFocus())
    await user.keyboard('cafe')
    expect(optionsOf(box).map(option => option.textContent)).toEqual(['Café'])
    await user.clear(search)
    await user.type(search, 'dine')
    expect(optionsOf(box).map(option => option.textContent)).toEqual(['Eat in'])
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'Eat in')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(search).toHaveFocus()
  })

  it('says «No results found» when a search finds nothing, in a live region', async () => {
    const user = userEvent.setup()
    render(field(SEARCH))
    await user.click(trigger())
    await listbox()
    await user.keyboard('zzz')
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('No results found')
  })

  it('typing on an option goes on in the search field', async () => {
    const user = userEvent.setup()
    render(field(SEARCH))
    await user.click(trigger())
    const box = await listbox()
    await user.keyboard('{ArrowDown}')
    expect(optionOf(box, 'All')).toHaveFocus()
    await user.keyboard('pi')
    const search = screen.getByRole('searchbox', { hidden: true })
    expect(search).toHaveFocus()
    expect(search).toHaveValue('pi')
  })

  it('remote: hands the text to onSearchChange and does not filter itself', async () => {
    const user = userEvent.setup()
    const Remote = () => {
      const [text, setText] = useState('')
      return field({ ...SEARCH, searchValue: text, onSearchChange: setText })
    }
    render(<Remote />)
    await user.click(trigger())
    const box = await listbox()
    await user.keyboard('zzz')
    expect(screen.getByRole('searchbox', { hidden: true })).toHaveValue('zzz')
    expect(optionsOf(box)).toHaveLength(OPTIONS.length)
  })

  it('remote with searchDelay: the owner hears once, after the pause; an emptied search at once; the text shows on reopen', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    const { rerender } = render(field({ ...SEARCH, onSearchChange, searchDelay: 200 }))
    await user.click(trigger())
    await listbox()
    await user.keyboard('pic')
    expect(screen.getByRole('searchbox', { hidden: true })).toHaveValue('pic')
    expect(onSearchChange).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith('pic'))
    expect(onSearchChange).toHaveBeenCalledTimes(1)
    await user.clear(screen.getByRole('searchbox', { hidden: true }))
    expect(onSearchChange).toHaveBeenLastCalledWith('')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
    rerender(field({ ...SEARCH, onSearchChange, searchDelay: 200, searchValue: 'pick' }))
    await user.click(trigger())
    await listbox()
    expect(screen.getByRole('searchbox', { hidden: true })).toHaveValue('pick')
  })

  it('shows «Loading» while an empty list loads, and the error with its retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(field({ options: [], loading: true, loadingLabel: 'Loading...' }))
    await user.click(trigger())
    const box = await listbox()
    expect(box).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Loading...')
    rerender(field({ options: [], loadError: true, errorLabel: 'Could not load', retryLabel: 'Retry', onRetry }))
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Could not load')
    await user.click(screen.getByRole('button', { name: 'Retry', hidden: true }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('draws the footer under the list, with close() when it is a function', async () => {
    const user = userEvent.setup()
    render(field({ footer: ({ close }) => <button type='button' onClick={close}>Page 2</button> }))
    await user.click(trigger())
    await listbox()
    await user.click(screen.getByRole('button', { name: 'Page 2', hidden: true }))
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })
})
