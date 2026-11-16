/* eslint-disable import/first */
// redesign bi FB1 (D5, BI-15, BI-17, auditor 4): the channels (apps) of /intelligence/business as a row of chips at one click. The
// controller of main (`AnalyticsStatusSubFilter`, GET /reports/app_ids) is simulated; the row only reads `appIdList`.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  appIdList: { loading: false, ids: [], error: null },
  controllerProps: null,
  catalog: {}
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
  // the controller of main hands its UIComponent the props it received and `appIdList`
  AnalyticsStatusSubFilter: ({ UIComponent, ...props }) => {
    mockState.controllerProps = props
    return <UIComponent {...props} appIdList={mockState.appIdList} />
  }
}))

import { ReportChannels } from '../ReportChannels'

const FILTERS = { lapse: 'last_7_days', app_id: 'all', businessIds: [3], timeZone: 'America/New_York' }

const renderChannels = (filterList = FILTERS) => {
  const handleChangeFilterList = vi.fn()
  render(<ReportChannels filterList={filterList} handleChangeFilterList={handleChangeFilterList} />)
  return { handleChangeFilterList }
}

const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

beforeEach(() => {
  vi.clearAllMocks()
  mockState.appIdList = { loading: false, ids: ['web', 'ios', 'android'], error: null }
  mockState.controllerProps = null
  mockState.catalog = {}
})

describe('the row', () => {
  it('is a group named «Channel» with «All channels» first and one button per id, as the API sends it', () => {
    renderChannels()
    const group = screen.getByRole('group', { name: 'Channel' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['All channels', 'web', 'ios', 'android'])
    within(group).getAllByRole('button').forEach(button => {
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('aria-pressed')
      expect(button).toHaveAttribute('data-size', 'sm')
    })
  })

  // redesign bi R1 (M2, decision 12): `sm` chips are 28 visible; on a phone they are `md` (32 visible, 44 of area)
  describe('on a phone (< 768)', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    })
    afterEach(() => vi.unstubAllGlobals())

    it('the chips are medium: 32 px visible and a 44 px area, not 28', () => {
      renderChannels()
      const buttons = within(screen.getByRole('group', { name: 'Channel' })).getAllByRole('button')
      expect(buttons).toHaveLength(4)
      buttons.forEach(button => expect(button).toHaveAttribute('data-size', 'md'))
    })

    it('the skeletons while loading are the height of a medium chip, so the row does not change when the answer comes', () => {
      mockState.appIdList = { loading: true, ids: [], error: null }
      renderChannels()
      const skeletons = screen.getByRole('group', { name: 'Channel' }).querySelectorAll('.odc-skeleton')
      expect(skeletons).toHaveLength(5)
      skeletons.forEach(node => expect(node.style.blockSize).toBe('var(--od-x-control-height)'))
    })

    it('a click still reports the channel', async () => {
      const user = userEvent.setup()
      const { handleChangeFilterList } = renderChannels()
      await user.click(screen.getByRole('button', { name: 'ios' }))
      expect(handleChangeFilterList).toHaveBeenCalledWith({ ...FILTERS, app_id: 'ios' })
    })
  })

  it('passes filterList and handleChangeFilterList to the controller of main', () => {
    const { handleChangeFilterList } = renderChannels()
    expect(mockState.controllerProps.filterList).toBe(FILTERS)
    expect(mockState.controllerProps.handleChangeFilterList).toBe(handleChangeFilterList)
  })

  it('«All channels» is translated by its own key; an id is data and is never translated', () => {
    mockState.catalog = { BUSINESS_REPORTS_ALL_CHANNELS: 'Todos los canales', web: 'Web translated', CHANNEL: 'Canal' }
    renderChannels()
    expect(screen.getByRole('group', { name: 'Canal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos los canales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'web' })).toBeInTheDocument()
  })

  it('«All channels» is pressed when app_id is «all»; no id is', () => {
    renderChannels({ ...FILTERS, app_id: 'all' })
    expect(pressed('All channels')).toBe('true')
    ;['web', 'ios', 'android'].forEach(id => expect(pressed(id)).toBe('false'))
  })

  it('app_id null (what main leaves after a second click) is drawn as «All channels» pressed', () => {
    renderChannels({ ...FILTERS, app_id: null })
    expect(pressed('All channels')).toBe('true')
    ;['web', 'ios', 'android'].forEach(id => expect(pressed(id)).toBe('false'))
  })

  it('the active channel is the only one pressed', () => {
    renderChannels({ ...FILTERS, app_id: 'ios' })
    expect(pressed('ios')).toBe('true')
    expect(pressed('web')).toBe('false')
    expect(pressed('All channels')).toBe('false')
  })
})

describe('a click', () => {
  it('on a channel writes app_id once and keeps the rest of the filters', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = renderChannels()
    await user.click(screen.getByRole('button', { name: 'ios' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...FILTERS, app_id: 'ios' })
  })

  it('on the active channel goes back to «all», not to null (D5)', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = renderChannels({ ...FILTERS, app_id: 'ios' })
    await user.click(screen.getByRole('button', { name: 'ios' }))
    expect(handleChangeFilterList).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...FILTERS, app_id: 'all' })
  })

  it('on «All channels» from a channel writes «all»', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = renderChannels({ ...FILTERS, app_id: 'web' })
    await user.click(screen.getByRole('button', { name: 'All channels' }))
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...FILTERS, app_id: 'all' })
  })

  it('on «All channels» when it already is, asks for nothing (each change is 10 requests)', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = renderChannels({ ...FILTERS, app_id: 'all' })
    await user.click(screen.getByRole('button', { name: 'All channels' }))
    expect(handleChangeFilterList).not.toHaveBeenCalled()
  })

  it('on «All channels» when app_id is null, asks for nothing either: it already reads as all', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = renderChannels({ ...FILTERS, app_id: null })
    await user.click(screen.getByRole('button', { name: 'All channels' }))
    expect(handleChangeFilterList).not.toHaveBeenCalled()
  })

  it('works with the keyboard: a channel takes Enter', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterList } = renderChannels()
    screen.getByRole('button', { name: 'android' }).focus()
    await user.keyboard('{Enter}')
    expect(handleChangeFilterList).toHaveBeenCalledWith({ ...FILTERS, app_id: 'android' })
  })
})

describe('loading and failing', () => {
  it('while loading draws 5 skeletons the height of a button and no button; the group says it is busy', () => {
    mockState.appIdList = { loading: true, ids: [], error: null }
    renderChannels()
    const group = screen.getByRole('group', { name: 'Channel' })
    expect(group).toHaveAttribute('aria-busy', 'true')
    expect(group.querySelectorAll('.odc-skeleton')).toHaveLength(5)
    group.querySelectorAll('.odc-skeleton').forEach(node => expect(node.style.blockSize).toBe('var(--od-x-control-height-sm)'))
    expect(within(group).queryAllByRole('button')).toHaveLength(0)
  })

  it('without ids (an empty answer, or an error that did not hold the controller loading) draws only «All channels», pressed', () => {
    mockState.appIdList = { loading: false, ids: [], error: new Error('network') }
    renderChannels()
    const group = screen.getByRole('group', { name: 'Channel' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['All channels'])
    expect(pressed('All channels')).toBe('true')
    expect(group).not.toHaveAttribute('aria-busy', 'true')
  })

  it('tolerates a controller answer without ids', () => {
    mockState.appIdList = { loading: false, error: null }
    renderChannels()
    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['All channels'])
  })

  it('a long list goes on one scrolling line that fades its edges (useOverflowEdges)', () => {
    renderChannels()
    const group = screen.getByRole('group', { name: 'Channel' })
    expect(group.className).toContain('odc-fade-x')
    expect(group.className).toContain('odc-bi-channels')
  })
})

// redesign with 19 channels the row scrolls sideways with no scrollbar, so a wheel mouse could not reach the hidden ones.
// Previous / next arrows (real buttons) show only on the side that has more, and scroll by about a screen of chips. jsdom has no
// layout: the scroller's sizes and position are simulated through the prototype getters that useOverflowEdges reads.
describe('the scroll arrows', () => {
  const geometry = { scrollWidth: 2464, clientWidth: 1140, scrollLeft: 0 }
  const scrollByCalls = []
  const isScroller = (node) => node.classList?.contains('odc-bi-channels')
  const originals = {}

  beforeEach(() => {
    Object.assign(geometry, { scrollWidth: 2464, clientWidth: 1140, scrollLeft: 0 })
    scrollByCalls.length = 0
    ;['scrollWidth', 'clientWidth', 'scrollLeft'].forEach(name => {
      originals[name] = Object.getOwnPropertyDescriptor(Element.prototype, name)
      Object.defineProperty(Element.prototype, name, {
        configurable: true,
        get () { return isScroller(this) ? geometry[name] : (originals[name]?.get?.call(this) ?? 0) },
        set (value) { if (isScroller(this)) geometry[name] = value }
      })
    })
    originals.scrollBy = Element.prototype.scrollBy
    Element.prototype.scrollBy = function (options) {
      scrollByCalls.push(options)
      geometry.scrollLeft = Math.max(0, Math.min(geometry.scrollWidth - geometry.clientWidth, geometry.scrollLeft + options.left))
      this.dispatchEvent(new Event('scroll'))
    }
    mockState.appIdList = { loading: false, ids: Array.from({ length: 18 }, (_, index) => `app-${index}`), error: null }
  })

  afterEach(() => {
    ;['scrollWidth', 'clientWidth', 'scrollLeft'].forEach(name => {
      if (originals[name]) Object.defineProperty(Element.prototype, name, originals[name])
      else delete Element.prototype[name]
    })
    Element.prototype.scrollBy = originals.scrollBy
    vi.unstubAllGlobals()
  })

  const arrow = (name) => screen.queryByRole('button', { name })

  it('with room for every chip there is no arrow', async () => {
    geometry.scrollWidth = 900
    renderChannels()
    await act(async () => {})
    expect(arrow('Scroll left')).toBeNull()
    expect(arrow('Scroll right')).toBeNull()
  })

  it('at the start of an overflowing row only «Scroll right» shows; both are native buttons outside the channel group', async () => {
    renderChannels()
    const next = await screen.findByRole('button', { name: 'Scroll right' })
    expect(arrow('Scroll left')).toBeNull()
    expect(next.tagName).toBe('BUTTON')
    expect(screen.getByRole('group', { name: 'Channel' })).not.toContainElement(next)
    // the group still holds only the channels
    expect(within(screen.getByRole('group', { name: 'Channel' })).getAllByRole('button')).toHaveLength(19)
  })

  it('«Scroll right» scrolls by the visible width (a chip stays in view) and uses smooth scrolling', async () => {
    const user = userEvent.setup()
    renderChannels()
    await user.click(await screen.findByRole('button', { name: 'Scroll right' }))
    expect(scrollByCalls).toHaveLength(1)
    expect(scrollByCalls[0].left).toBeGreaterThan(0)
    expect(scrollByCalls[0].left).toBeLessThanOrEqual(1140)
    expect(scrollByCalls[0].behavior).toBe('smooth')
    // in the middle of the row both arrows show
    expect(await screen.findByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
    expect(arrow('Scroll right')).not.toBeNull()
  })

  it('«Scroll left» goes back by the same amount', async () => {
    const user = userEvent.setup()
    renderChannels()
    await user.click(await screen.findByRole('button', { name: 'Scroll right' }))
    await user.click(await screen.findByRole('button', { name: 'Scroll left' }))
    expect(scrollByCalls[1].left).toBe(-scrollByCalls[0].left)
  })

  it('reaching the end hides «Scroll right» and keeps the focus on a control of the row, not on the page', async () => {
    const user = userEvent.setup()
    renderChannels()
    const next = await screen.findByRole('button', { name: 'Scroll right' })
    await user.click(next)
    await user.click(await screen.findByRole('button', { name: 'Scroll right' }))
    await waitFor(() => expect(arrow('Scroll right')).toBeNull())
    expect(arrow('Scroll left')).not.toBeNull()
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('group', { name: 'Channel' }).parentElement).toContainElement(document.activeElement)
  })

  it('with reduced motion the scroll is not animated', async () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener: () => {}, removeEventListener: () => {} }))
    const user = userEvent.setup()
    renderChannels()
    await user.click(await screen.findByRole('button', { name: 'Scroll right' }))
    expect(scrollByCalls[0].behavior).toBe('auto')
  })

  it('in a right-to-left page the arrows are logical: the start arrow says «Scroll right» and moves toward the start', async () => {
    const user = userEvent.setup()
    document.documentElement.setAttribute('dir', 'rtl')
    try {
      renderChannels()
      // RTL: scrollLeft runs from 0 to a negative number toward the end; at 0 only the end arrow («left») shows
      const next = await screen.findByRole('button', { name: 'Scroll left' })
      expect(arrow('Scroll right')).toBeNull()
      await user.click(next)
      expect(scrollByCalls[0].left).toBeLessThan(0)
    } finally {
      document.documentElement.removeAttribute('dir')
    }
  })

  it('the arrows are translated with the keys the dashboard already has', async () => {
    mockState.catalog = { SCROLL_RIGHT: 'Desplazar a la derecha' }
    renderChannels()
    expect(await screen.findByRole('button', { name: 'Desplazar a la derecha' })).toBeInTheDocument()
  })

  it('touch scrolling and the keyboard are untouched: the channels stay in the tab order and the row is not a tab stop of its own', async () => {
    renderChannels()
    await screen.findByRole('button', { name: 'Scroll right' })
    const group = screen.getByRole('group', { name: 'Channel' })
    expect(group).not.toHaveAttribute('tabindex')
    within(group).getAllByRole('button').forEach(button => expect(button).not.toHaveAttribute('tabindex', '-1'))
  })
})

// The layout cannot be measured in jsdom: the sheet says what it promises.
describe('report-filters.css · the channels part', () => {
  const css = readFileSync(path.resolve(__dirname, '../report-filters.css'), 'utf8')
  // the declarations of the B1 part, without its comments
  const mine = css.slice(css.indexOf('/* B1 */')).split('/* B2 */')[0].replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (selector) => {
    const start = mine.indexOf(selector)
    return start < 0 ? '' : mine.slice(start, mine.indexOf('}', start))
  }

  it('one line, scrolling sideways, with no visible scrollbar', () => {
    const row = rule('.odc-bi-channels {')
    expect(row).toMatch(/flex-wrap:\s*nowrap/)
    expect(row).toMatch(/overflow-x:\s*auto/)
    expect(row).toMatch(/scrollbar-width:\s*none/)
    expect(mine).toMatch(/\.odc-bi-channels::-webkit-scrollbar\s*\{\s*display:\s*none/)
  })

  it('keeps the text as it comes: no text-transform (main capitalized it by CSS)', () => {
    expect(mine).not.toMatch(/text-transform/)
  })

  it('leaves room inside the scroller for the focus ring and, on touch, for the 44px area of a small button', () => {
    expect(rule('.odc-bi-channels {')).toMatch(/padding/)
    expect(mine).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)[\s\S]*\.odc-bi-channels[\s\S]*var\(--od-x-target-coarse\)/)
  })

  // redesign bi R1 (M2): the scroller makes room for the area of a MEDIUM chip on a phone (44 - 32), not of a small one (44 - 28)
  it('on a phone the room for the 44 px area is that of a 32 px chip', () => {
    expect(mine).toMatch(/@media \(max-width: 767px\)\s*\{[^}]*\.odc-bi-channels\s*\{[^}]*calc\(\(var\(--od-x-target-coarse\) - var\(--od-x-control-height\)\) \/ 2\)/)
  })

  it('does not hide the focus ring and does not remove outlines', () => {
    expect(mine).not.toMatch(/outline:\s*(none|0)/)
  })

  // redesign
  it('the arrows overlay the edges (the row keeps its height), hide for a coarse pointer, and the scroller keeps clear of them', () => {
    expect(mine).toMatch(/\.odc-bi-channels-wrap\s*\{[^}]*position:\s*relative/)
    expect(mine).toMatch(/\.odc-bi-channels-arrow\s*\{[^}]*position:\s*absolute/)
    expect(rule('.odc-bi-channels.odc-fade-x {')).toMatch(/scroll-padding-inline:\s*calc\(/)
  })

  // redesign (review, low): under 768 px with a MOUSE (a narrow window) the arrows drew over the chips and their 44 px area
  // covered part of the neighbour. They go away in the same query as the phone (coarse pointer or < 768), and the scroller takes back
  // its fade padding there; above 768 with a mouse nothing changes.
  it('the arrows hide, and the scroll padding goes back, for a coarse pointer and under 768 px (a mouse in a narrow window)', () => {
    const phone = mine.match(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*?\.odc-btn\.odc-bi-channels-arrow\s*\{\s*display:\s*none[^}]*\}[^@]*?\.odc-bi-channels\.odc-fade-x\s*\{[^}]*scroll-padding-inline:\s*var\(--od-x-fade-size\)/)
    expect(phone).not.toBeNull()
    // and no query of its own for the coarse pointer alone: one condition for the phone, as everywhere else in the sheet
    expect(mine).not.toMatch(/@media \(pointer: coarse\)\s*\{/)
  })
})
