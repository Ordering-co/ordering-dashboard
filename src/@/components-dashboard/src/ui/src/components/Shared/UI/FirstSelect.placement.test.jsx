/* eslint-disable import/first */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { FirstSelect } from './FirstSelect'

// redesign F6h: the placement attributes live on the popup. With the C18 surface (fitTrigger) it is a group that holds
// the search field, the listbox and the footer; the legacy popup is itself the listbox (opt-in per surface, L2-09).
const popup = () => screen.getByRole('listbox').closest('.od-first-select-list')

// Geometry per element class: the select opens a list that is taller than the room under the trigger.
const geometry = { trigger: { top: 740, bottom: 780 }, list: 500, inner: 440, viewport: 800 }

const rect = (top, height) => ({ top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) })

const options = Array.from({ length: 30 }, (_, index) => ({ value: index, content: <span>{`Status ${index}`}</span> }))

const renderSelect = (props = {}) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <FirstSelect placeholder='Change status' options={options} defaultValue={0} onChange={vi.fn()} {...props} />
  </ThemeProvider>
)

const open = () => fireEvent.keyDown(screen.getByRole('button', { name: /Status 0|Change status/ }), { key: 'Enter' })

describe('FirstSelect placement (opt-in, used by the order panel footer)', () => {
  beforeEach(() => {
    window.innerHeight = geometry.viewport
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList?.contains('od-first-select-trigger')) return rect(geometry.trigger.top, geometry.trigger.bottom - geometry.trigger.top)
      if (this.classList?.contains('od-first-select-list')) return rect(0, geometry.list)
      if (this.classList?.contains('od-first-select-options-inner')) return rect(0, geometry.inner)
      return rect(0, 0)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    geometry.trigger = { top: 740, bottom: 780 }
    geometry.list = 500
    geometry.inner = 440
    geometry.viewport = 800
  })

  it('without the prop nothing changes: no placement attribute, no forced height, no scroll', () => {
    renderSelect({ optionInnerMaxHeight: '50vh' })
    open()
    const list = popup()
    expect(list).not.toHaveAttribute('data-placement')
    const inner = list.querySelector('.od-first-select-options-inner')
    expect(inner.style.maxHeight).toBe('50vh')
    expect(inner.style.overflowY).toBe('')
  })

  it("'auto' near the bottom of the viewport opens upward, uncapped when it fits above", () => {
    renderSelect({ placement: 'auto' })
    open()
    const list = popup()
    expect(list).toHaveAttribute('data-placement', 'top')
    expect(list.querySelector('.od-first-select-options-inner').style.overflowY).toBe('')
  })

  it("'auto' with room below keeps the default downward list", () => {
    geometry.trigger = { top: 100, bottom: 140 }
    renderSelect({ placement: 'auto' })
    open()
    expect(popup()).toHaveAttribute('data-placement', 'bottom')
  })

  it("'auto' with too little room on both sides picks the larger one and scrolls inside it", () => {
    geometry.viewport = 500
    window.innerHeight = 500
    geometry.trigger = { top: 300, bottom: 340 }
    geometry.list = 600
    geometry.inner = 540
    renderSelect({ placement: 'auto', optionInnerMaxHeight: '50vh' })
    open()
    const list = popup()
    expect(list).toHaveAttribute('data-placement', 'top')
    const inner = list.querySelector('.od-first-select-options-inner')
    // room above = 300 - 8 (gap) - 8 (edge); the search/chrome around the options takes 60px.
    expect(inner.style.maxHeight).toBe('min(50vh, 224px)')
    expect(inner.style.overflowY).toBe('auto')
  })

  it("'top' prefers upward but flips down when the room above is smaller than below and the list does not fit", () => {
    geometry.viewport = 900
    window.innerHeight = 900
    geometry.trigger = { top: 60, bottom: 100 }
    renderSelect({ placement: 'top' })
    open()
    expect(popup()).toHaveAttribute('data-placement', 'bottom')
  })

  it('Escape closes the list and returns focus to the trigger', () => {
    renderSelect({ placement: 'auto' })
    open()
    expect(popup()).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Status 0|Change status/ }))
  })

  it('measures again when the window is resized while open', () => {
    renderSelect({ placement: 'auto' })
    open()
    expect(popup()).toHaveAttribute('data-placement', 'top')
    geometry.trigger = { top: 100, bottom: 140 }
    fireEvent(window, new Event('resize'))
    expect(popup()).toHaveAttribute('data-placement', 'bottom')
  })
})
