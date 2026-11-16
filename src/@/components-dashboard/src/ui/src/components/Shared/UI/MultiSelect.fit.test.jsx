/* eslint-disable import/first */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }]
}))

import { MultiSelect } from './MultiSelect'
import { FirstSelect } from './FirstSelect'
import { SelectSurfaceContext } from './selectPlacement'

// redesign F6h: the placement attributes live on the popup. With the C18 surface (fitTrigger) it is a group that holds
// the search field, the listbox and the footer; the legacy popup is itself the listbox (opt-in per surface, L2-09).
const popup = () => screen.getByRole('listbox').closest('.od-first-select-list, .od-multi-select-options')

// redesign fix-qa E2: the filters sheet opts its pickers in to lists that start at the trigger, are as wide
// as it, flip up without room and stay inside the clipping body of the sheet. Everyone else is unchanged.
const geometry = { trigger: { top: 400, bottom: 430 }, body: { top: 64, bottom: 700 }, list: 400, inner: 340, viewport: 900 }

const rect = (top, height) => ({ top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) })

const options = Array.from({ length: 30 }, (_, index) => ({ value: index, content: <span>{`Currency ${index}`}</span> }))
const pagination = { currentPage: 1, pageSize: 5, totalItems: 30, totalPages: 6 }

const Body = ({ children }) => <div data-testid='body' style={{ overflowY: 'auto' }}>{children}</div>

const renderIn = (ui, { surface } = {}) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={surface ?? {}}>
      <Body>{ui}</Body>
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

const multi = (props = {}) => (
  <MultiSelect
    placeholder='Select a currency'
    options={options}
    defaultValue={[]}
    onChange={vi.fn()}
    pagination={pagination}
    handleChangePage={vi.fn()}
    handleChangePageSize={vi.fn()}
    optionInnerMaxHeight='200px'
    {...props}
  />
)

const openMulti = () => fireEvent.keyDown(screen.getByRole('button', { name: /Select a currency/ }), { key: 'Enter' })

describe('MultiSelect and FirstSelect, opt-in sheet surface', () => {
  beforeEach(() => {
    window.innerHeight = geometry.viewport
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const cls = this.classList
      if (cls?.contains('od-multi-select-trigger') || cls?.contains('od-first-select-trigger')) return rect(geometry.trigger.top, geometry.trigger.bottom - geometry.trigger.top)
      if (cls?.contains('od-multi-select-options') || cls?.contains('od-first-select-list')) return rect(0, geometry.list)
      if (cls?.contains('od-multi-select-options-inner') || cls?.contains('od-first-select-options-inner')) return rect(0, geometry.inner)
      if (this.dataset?.testid === 'body') return rect(geometry.body.top, geometry.body.bottom - geometry.body.top)
      return rect(0, 0)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    geometry.trigger = { top: 400, bottom: 430 }
    geometry.body = { top: 64, bottom: 700 }
    geometry.list = 400
    geometry.inner = 340
    geometry.viewport = 900
    window.innerHeight = 900
  })

  describe('MultiSelect without the opt-in (every other screen)', () => {
    it('keeps the end-aligned list, the consumer cap, the pager and the square check icons', () => {
      renderIn(multi())
      openMulti()
      const list = popup()
      expect(list).toHaveAttribute('data-position', 'right')
      expect(list).not.toHaveAttribute('data-fit')
      expect(list).not.toHaveAttribute('data-placement')
      expect(list.querySelector('.od-multi-select-options-inner').style.maxHeight).toBe('200px')
      expect(screen.getAllByRole('option')).toHaveLength(5)
      expect(list.querySelector('.od-multi-select-check')).not.toBeNull()
      expect(list.querySelector('.od-multi-select-picture')).toBeNull()
      expect(list.textContent).toMatch(/1/)
    })
  })

  describe('MultiSelect with fitTrigger', () => {
    it('drops the end alignment and the pager, draws every option as a brand row and scrolls instead', () => {
      renderIn(multi({ fitTrigger: true }))
      openMulti()
      const list = popup()
      expect(list).toHaveAttribute('data-fit', 'trigger')
      expect(list).not.toHaveAttribute('data-position')
      expect(screen.getAllByRole('option')).toHaveLength(30)
      expect(list.querySelector('.od-multi-select-check')).toBeNull()
      // redesign F2: the box of a row is the Product checkbox now (C18), not a box drawn by this select
      // redesign F6h: drawn as its picture (a span with the same box), not as the button
      expect(list.querySelectorAll('.od-multi-select-picture')).toHaveLength(30)
      expect(list.querySelector('.od-pagination, [class*=agination]')).toBeNull()
    })

    it('gets the same surface from the context the sheet provides', () => {
      renderIn(multi(), { surface: { fitTrigger: true } })
      openMulti()
      expect(popup()).toHaveAttribute('data-fit', 'trigger')
    })

    it('opens downward when the list fits under the trigger inside the clipping body', () => {
      // room below = 700 (body end) - 430 - 16 = 254 >= 240
      geometry.list = 240
      geometry.inner = 180
      renderIn(multi({ fitTrigger: true }))
      openMulti()
      const list = popup()
      expect(list).toHaveAttribute('data-placement', 'bottom')
      expect(list.querySelector('.od-multi-select-options-inner').style.maxHeight).toBe('')
    })

    it('flips up when the sheet footer, not the viewport, leaves no room below; the options scroll inside the room above', () => {
      // 900px viewport but the body ends at 700: the room below the trigger is 700 - 430 - 16 = 254 < 400.
      renderIn(multi({ fitTrigger: true }))
      openMulti()
      const list = popup()
      expect(list).toHaveAttribute('data-placement', 'top')
      // room above = 400 - 64 - 16 = 320 < 400: capped to 320 minus 60px of chrome (search box).
      expect(list.querySelector('.od-multi-select-options-inner').style.maxHeight).toBe('260px')
    })

    it('measures again when the window is resized while open', () => {
      renderIn(multi({ fitTrigger: true }))
      openMulti()
      expect(popup()).toHaveAttribute('data-placement', 'top')
      geometry.body = { top: 64, bottom: 900 }
      geometry.trigger = { top: 100, bottom: 130 }
      fireEvent(window, new Event('resize'))
      expect(popup()).toHaveAttribute('data-placement', 'bottom')
    })

    it('Escape closes only the list and returns focus to the trigger', () => {
      renderIn(multi({ fitTrigger: true }))
      openMulti()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Select a currency/ }))
    })

    it('still selects an option by its row', () => {
      const onChange = vi.fn()
      renderIn(multi({ fitTrigger: true, onChange }))
      openMulti()
      fireEvent.click(screen.getByRole('option', { name: 'Currency 3' }))
      expect(onChange).toHaveBeenCalledWith(3)
      expect(screen.getByRole('option', { name: 'Currency 3' })).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('FirstSelect', () => {
    const first = (props = {}) => <FirstSelect placeholder='Any' options={options.slice(0, 5)} onChange={vi.fn()} {...props} />
    const openFirst = () => fireEvent.keyDown(screen.getByRole('button', { name: /Any/ }), { key: 'Enter' })

    it('keeps its end-aligned list without the opt-in', () => {
      renderIn(first())
      openFirst()
      const list = popup()
      expect(list).toHaveAttribute('data-position', 'right')
      expect(list).not.toHaveAttribute('data-fit')
      expect(list).not.toHaveAttribute('data-placement')
    })

    it('with fitTrigger aligns to the trigger and flips up against the sheet body', () => {
      geometry.list = 400
      geometry.inner = 340
      renderIn(first({ fitTrigger: true }))
      openFirst()
      const list = popup()
      expect(list).toHaveAttribute('data-fit', 'trigger')
      expect(list).not.toHaveAttribute('data-position')
      expect(list).toHaveAttribute('data-placement', 'top')
    })

    it('a plain placement=auto (the order panel footer) keeps measuring against the viewport only', () => {
      renderIn(first({ placement: 'auto' }))
      openFirst()
      const list = popup()
      expect(list).toHaveAttribute('data-position', 'right')
      expect(list).not.toHaveAttribute('data-fit')
      // viewport room below = 900 - 430 - 16 = 454 >= 400: stays down even though the body would clip it.
      expect(list).toHaveAttribute('data-placement', 'bottom')
    })
  })
})
