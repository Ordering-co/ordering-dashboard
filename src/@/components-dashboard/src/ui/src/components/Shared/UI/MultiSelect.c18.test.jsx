/* eslint-disable import/first */
// redesign F2 (C18): the multi-select inside the orders surfaces. Product checkboxes, the count in the
// field, «Clear» in the footer of the list, and the keyboard of a listbox.
import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }]
}))

import { MultiSelect } from './MultiSelect'
import { SelectSurfaceContext } from './selectPlacement'

const options = ['Alba', 'Bruno', 'Berta', 'Carla', 'Dani'].map((name, index) => ({ value: index + 1, content: <span>{name}</span> }))

const wrap = ui => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>{ui}</SelectSurfaceContext.Provider>
  </ThemeProvider>
)

// Same contract as the filters controller: a toggle that writes from the closure it was created in, so two
// calls in one tick lose the first one. «Clear» has to work with it.
const Controlled = ({ initial = [], onChange, ...props }) => {
  const [ids, setIds] = useState(initial)
  const toggle = id => {
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]
    setIds(next)
    onChange?.(id)
  }
  return <MultiSelect placeholder='Pick people' options={options} defaultValue={ids} onChange={toggle} {...props} />
}

const trigger = () => document.querySelector('.od-multi-select-trigger')
const open = () => fireEvent.click(trigger())
const rows = () => within(screen.getByRole('listbox')).getAllByRole('option')
const label = element => element.textContent.trim()

describe('MultiSelect, C18 anatomy inside the orders surfaces', () => {
  it('draws every row with the Product checkbox', () => {
    render(wrap(<Controlled initial={[2]} />))
    open()
    const list = screen.getByRole('listbox')
    expect(list.querySelectorAll('.od-multi-select-picture')).toHaveLength(5)
    expect(list.querySelector('.od-multi-select-box, .od-multi-select-check')).toBeNull()
    const checked = [...list.querySelectorAll('.od-multi-select-picture')].map(box => box.hasAttribute('data-checked'))
    expect(checked).toEqual([false, true, false, false, false])
    // the row is the control: the checkbox is its picture, outside the tab order and the accessibility tree
    // redesign F6h: a picture now (a span), not a button, so the option has no interactive child
    expect(list.querySelector('.od-multi-select-picture').tagName).toBe('SPAN')
    expect(list.querySelector('.od-multi-select-picture')).not.toHaveAttribute('tabindex')
    expect(list.querySelector('.od-multi-select-picture')).toHaveAttribute('aria-hidden', 'true')
  })

  it('clicking a row toggles it once', () => {
    const onChange = vi.fn()
    render(wrap(<Controlled onChange={onChange} />))
    open()
    fireEvent.click(rows()[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2)
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking the checkbox itself toggles the row once too', () => {
    const onChange = vi.fn()
    render(wrap(<Controlled onChange={onChange} />))
    open()
    fireEvent.click(screen.getByRole('listbox').querySelectorAll('.od-multi-select-picture')[2])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(3)
  })

  // redesign F6c (P3-01): the chosen values are back in the field as chips with an X each, as in `main`
  // (they were summed up as «3 selected»). The ones that do not fit give way to «+N».
  describe('the field', () => {
    const chips = () => [...trigger().querySelectorAll('.od-multi-select-chip')]
    const chipNames = () => chips().map(chip => chip.querySelector('.od-multi-select-chip-content').textContent)

    it('shows the placeholder, and one chip with its own X for every value', () => {
      const { unmount } = render(wrap(<Controlled />))
      expect(trigger()).toHaveTextContent('Pick people')
      expect(chips()).toHaveLength(0)
      unmount()
      const one = render(wrap(<Controlled initial={[4]} />))
      expect(chipNames()).toEqual(['Carla'])
      expect(within(trigger()).getByRole('button', { name: 'Remove Carla' })).toBeInTheDocument()
      one.unmount()
      render(wrap(<Controlled initial={[1, 2, 3]} />))
      expect(chipNames()).toEqual(['Alba', 'Bruno', 'Berta'])
      expect(trigger()).not.toHaveTextContent('selected')
      expect(within(trigger()).getAllByRole('button', { name: /^Remove / })).toHaveLength(3)
      // nothing is hidden or counted while there is room
      expect(chips().some(chip => chip.hasAttribute('data-overflowed'))).toBe(false)
    })

    // redesign F6e-2 (Q4-08): the sheet's selects draw their options as JSX (a styled row, a logo and a name), so the X cannot take
    // its name from a string. Its accessible name was already right through aria-labelledby, but `aria-label` and `title` (the tooltip
    // and anything that reads the attributes) said only «Remove»: both carry the chip's text now.
    it('names every X «Remove <value>» in aria-label and title, with the JSX options the sheet really has', () => {
      const Row = ({ children }) => <div className='styled-row'>{children}</div>
      const sheetOptions = [
        { value: 1, content: <Row>Delivery</Row> },
        { value: 2, content: <Row>Pickup</Row> },
        { value: 7, content: <span className='odc-so'><span aria-hidden='true' className='odc-avatar'>DP</span><span className='odc-so-label'>Dono&apos;s   Pizza</span><span className='odc-so-meta'>Food</span></span>, showOnSelected: <span className='odc-so'><span aria-hidden='true' className='odc-avatar'>DP</span><span className='odc-so-label'>Dono&apos;s   Pizza</span></span> }
      ]
      render(wrap(<Controlled initial={[1, 2, 7]} options={sheetOptions} />))
      const buttons = within(trigger()).getAllByRole('button', { name: /^Remove / })
      expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['Remove Delivery', 'Remove Pickup', "Remove Dono's Pizza"])
      expect(buttons.map(button => button.getAttribute('title'))).toEqual(['Remove Delivery', 'Remove Pickup', "Remove Dono's Pizza"])
      // one name each: the label is complete, nothing is added through aria-labelledby on top of it
      expect(buttons.every(button => !button.hasAttribute('aria-labelledby'))).toBe(true)
      expect(within(trigger()).getByRole('button', { name: "Remove Dono's Pizza" })).toBeInTheDocument()
    })

    it('keeps the names right after a value is added or removed', () => {
      const sheetOptions = options.map(option => ({ ...option, content: <div>{option.content.props.children}</div> }))
      render(wrap(<Controlled initial={[1]} options={sheetOptions} />))
      open()
      fireEvent.click(rows()[2])
      expect(within(trigger()).getAllByRole('button', { name: /^Remove / }).map(button => button.getAttribute('title'))).toEqual(['Remove Alba', 'Remove Berta'])
      fireEvent.click(within(trigger()).getByRole('button', { name: 'Remove Alba' }))
      expect(within(trigger()).getAllByRole('button', { name: /^Remove / }).map(button => button.getAttribute('title'))).toEqual(['Remove Berta'])
    })

    it('the X removes only its value and does not open the list', () => {
      const onChange = vi.fn()
      render(wrap(<Controlled initial={[1, 2, 3]} onChange={onChange} />))
      fireEvent.click(within(trigger()).getByRole('button', { name: 'Remove Bruno' }))
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(2)
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(chipNames()).toEqual(['Alba', 'Berta'])
    })

    it('the X works from the keyboard without opening the list and leaves the focus on a neighbour', () => {
      render(wrap(<Controlled initial={[1, 2, 3]} />))
      const x = within(trigger()).getByRole('button', { name: 'Remove Bruno' })
      x.focus()
      fireEvent.keyDown(x, { key: 'Enter' })
      expect(screen.queryByRole('listbox')).toBeNull()
      // a native button turns Enter into a click; fireEvent does not, so click it as the browser would
      fireEvent.click(x)
      expect(document.activeElement).toBe(within(trigger()).getByRole('button', { name: 'Remove Berta' }))
    })

    it('the focus goes back to the field when the last value is removed', () => {
      render(wrap(<Controlled initial={[2]} />))
      const x = within(trigger()).getByRole('button', { name: 'Remove Bruno' })
      x.focus()
      fireEvent.click(x)
      expect(trigger()).toHaveTextContent('Pick people')
      expect(document.activeElement).toBe(trigger())
    })

    it('updates the chips as rows are toggled', () => {
      render(wrap(<Controlled />))
      open()
      fireEvent.click(rows()[0])
      fireEvent.click(rows()[1])
      expect(chipNames()).toEqual(['Alba', 'Bruno'])
      fireEvent.click(rows()[0])
      expect(chipNames()).toEqual(['Bruno'])
    })

    it('uses the compact content of a value (showOnSelected) when it has one', () => {
      const rich = options.map(option => ({ ...option, content: <span>{`${option.content.props.children} · long detail`}</span>, showOnSelected: option.content }))
      render(wrap(<Controlled initial={[1]} options={rich} />))
      expect(chipNames()).toEqual(['Alba'])
    })

    describe('when they do not fit', () => {
      // jsdom has no layout: the field is 150px wide, a chip is 60px and «+N» is 24px.
      let clientWidth = 150
      beforeEach(() => {
        clientWidth = 150
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
          return this.classList.contains('od-multi-select-header') ? clientWidth : 0
        })
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
          const width = this.classList.contains('od-multi-select-chip') ? 60 : this.classList.contains('od-multi-select-more') ? 24 : 0
          return { width, height: 24, top: 0, left: 0, right: width, bottom: 24, x: 0, y: 0, toJSON: () => ({}) }
        })
      })
      afterEach(() => vi.restoreAllMocks())

      const more = () => trigger().querySelector('.od-multi-select-more')
      const hidden = () => chips().filter(chip => chip.hasAttribute('data-overflowed')).map(chip => chip.textContent)

      it('shows the first ones and «+N» for the rest', () => {
        render(wrap(<Controlled initial={[1, 2, 3, 4]} />))
        expect(hidden()).toEqual(['Berta', 'Carla'])
        expect(more()).not.toHaveAttribute('data-empty')
        expect(more()).toHaveTextContent('+2')
        expect(more()).toHaveAttribute('title', 'Berta, Carla')
      })

      // redesign F6e-2 (Q4-08): the tooltip of «+N» lists the names, not the initials of the avatars beside them
      it('names the hidden values in the «+N» tooltip without the decorative initials', () => {
        const withAvatar = options.map(option => ({ ...option, content: <span><span aria-hidden='true'>XX</span><span>{option.content.props.children}</span></span> }))
        render(wrap(<Controlled initial={[1, 2, 3, 4]} options={withAvatar} />))
        expect(more()).toHaveAttribute('title', 'Berta, Carla')
      })

      it('draws no «+N» when they all fit', () => {
        clientWidth = 300
        render(wrap(<Controlled initial={[1, 2, 3, 4]} />))
        expect(hidden()).toEqual([])
        expect(more()).toHaveAttribute('data-empty')
      })

      it('always keeps the first value, even when it alone is wider than the field', () => {
        clientWidth = 40
        render(wrap(<Controlled initial={[1, 2, 3]} />))
        expect(hidden()).toEqual(['Bruno', 'Berta'])
        expect(more()).toHaveTextContent('+2')
      })

      it('counts again when a value is removed with its X', () => {
        render(wrap(<Controlled initial={[1, 2, 3, 4]} />))
        fireEvent.click(within(trigger()).getByRole('button', { name: 'Remove Alba' }))
        expect(hidden()).toEqual(['Carla'])
        expect(more()).toHaveTextContent('+1')
        fireEvent.click(within(trigger()).getByRole('button', { name: 'Remove Bruno' }))
        expect(hidden()).toEqual([])
        expect(more()).toHaveAttribute('data-empty')
      })

      it('a value in «+N» is still removed from the list', () => {
        const onChange = vi.fn()
        render(wrap(<Controlled initial={[1, 2, 3, 4]} onChange={onChange} />))
        open()
        fireEvent.click(rows()[3])
        expect(onChange).toHaveBeenCalledWith(4)
        expect(chipNames()).toEqual(['Alba', 'Bruno', 'Berta'])
      })
    })
  })

  // redesign F6c (P3-03): as in `main`, the search field is there whenever the consumer asks for it.
  describe('search', () => {
    it('shows the search field with only a few options when the consumer asks for it', () => {
      render(wrap(<Controlled isShowSearchBar handleChangeSearch={vi.fn()} searchValue='' />))
      open()
      expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    })

    it('shows none when the consumer does not ask for it', () => {
      render(wrap(<Controlled />))
      open()
      expect(screen.queryByRole('searchbox')).toBeNull()
    })
  })

  describe('«Clear» in the footer of the list', () => {
    it('is there, and disabled while nothing is selected', () => {
      render(wrap(<Controlled />))
      open()
      expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
    })

    it('empties the selection even when the parent writes from a stale closure', async () => {
      const onChange = vi.fn()
      render(wrap(<Controlled initial={[1, 2, 3]} onChange={onChange} />))
      open()
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
      expect(await screen.findByText('Pick people')).toBeInTheDocument()
      expect(onChange.mock.calls.map(call => call[0]).sort()).toEqual([1, 2, 3])
      expect(rows().every(row => row.getAttribute('aria-selected') === 'false')).toBe(true)
      expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
    })

    it('keeps the list open', async () => {
      render(wrap(<Controlled initial={[1, 2]} />))
      open()
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
      await screen.findByText('Pick people')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  describe('keyboard', () => {
    it('ArrowDown on the closed field opens the list on the first row; arrows, Home and End move', () => {
      render(wrap(<Controlled />))
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      expect(label(document.activeElement)).toBe('Alba')
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(label(document.activeElement)).toBe('Bruno')
      fireEvent.keyDown(document.activeElement, { key: 'End' })
      expect(label(document.activeElement)).toBe('Dani')
      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      expect(label(document.activeElement)).toBe('Carla')
      fireEvent.keyDown(document.activeElement, { key: 'Home' })
      expect(label(document.activeElement)).toBe('Alba')
    })

    it('typing jumps to the next row with those letters', () => {
      render(wrap(<Controlled />))
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: 'b' })
      expect(label(document.activeElement)).toBe('Bruno')
      fireEvent.keyDown(document.activeElement, { key: 'b' })
      expect(label(document.activeElement)).toBe('Berta')
    })

    it('Space and Enter toggle the focused row and leave the list open on it', () => {
      const onChange = vi.fn()
      render(wrap(<Controlled onChange={onChange} />))
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: ' ' })
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: 'Enter' })
      expect(onChange.mock.calls.map(call => call[0])).toEqual([1, 2])
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(label(document.activeElement)).toBe('Bruno')
    })

    it('Escape closes only the list, returns the focus to the field and is not heard above', () => {
      const outer = vi.fn()
      render(wrap(<div onKeyDown={outer}><Controlled /></div>))
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(document.activeElement).toBe(trigger())
      expect(outer).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    })
  })

  describe('outside the orders surfaces', () => {
    it('keeps the chips, the square icons and no footer', () => {
      render(
        <ThemeProvider theme={createDashboardTheme(theme)}>
          <Controlled initial={[1, 2, 3]} />
        </ThemeProvider>
      )
      expect(trigger().querySelectorAll('.od-multi-select-chip')).toHaveLength(3)
      open()
      expect(screen.getByRole('listbox').querySelector('.od-multi-select-picture')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    })
  })
})
