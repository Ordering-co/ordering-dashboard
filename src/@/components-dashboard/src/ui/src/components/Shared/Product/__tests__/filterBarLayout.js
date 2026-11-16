import { act } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// The layout stubs shared by the FilterBar width tests (W0-4b, r5, Bugs H). jsdom has no layout, so the widths the bar measures
// are stubbed, like FilterBar.f6f1.test.jsx: the buttons follow their text (20px + 7px a character), the pills carry theirs in
// `data-w`, the search is its floor (200) and the tools are 80. The state lives in this module, and every test file gets its own
// copy of it (Vitest isolates the modules of each file).
export const WIDTHS = { main: 0, search: 200, tools: 80 }
export const POSITION = { plusLeft: 0, originLeft: 0 }
export const BASE = 20
export const CHAR = 7
export const textWidth = node => BASE + CHAR * node.textContent.length
// the width of the value of a pill (`.odc-pill-value`): jsdom has none; the bar cuts it down to 5em
export const VALUE = { w: 0 }

let observers = []
class FakeResizeObserver {
  constructor (callback) {
    this.callback = callback
    this.targets = new Set()
    observers.push(this)
  }

  observe (node) { this.targets.add(node) }
  unobserve (node) { this.targets.delete(node) }
  disconnect () { this.targets.clear() }
}
export const fireResize = () => act(() => observers.forEach(observer => observer.callback([], observer)))
export const resize = main => {
  WIDTHS.main = main
  POSITION.plusLeft = main - 300
  fireResize()
}

// Bugs H (W0-D-12): a pill whose button carries `data-cut-bare` paints only its label: it is its width without the value (the
// separator and the gaps are 0 here), for the pill (what the row counts) and for its button (what the bar measures to know what
// the bare label gives).
const bareGives = node => (node.querySelector?.('[data-cut-bare]') || node.hasAttribute?.('data-cut-bare') ? VALUE.w : 0)

const makeWidthOf = ({ bareCut }) => node => {
  const parent = node.parentElement
  if (node.classList.contains('odc-pill-value')) return VALUE.w
  if (bareCut && node.classList.contains('odc-pill') && parent?.parentElement?.classList.contains('odc-filterbar-filters')) {
    return (Number(parent.getAttribute('data-w')) || 100) - bareGives(node)
  }
  if (node.hasAttribute('data-search')) return WIDTHS.search
  if (parent?.classList.contains('odc-filterbar-filters')) return (Number(node.getAttribute('data-w')) || 100) - (bareCut ? bareGives(node) : 0)
  if (parent?.classList.contains('odc-filterbar-overflow')) {
    return node.hasAttribute('data-filterbar-overflow') || node.hasAttribute('data-filterbar-probe') ? textWidth(node) : 0
  }
  if (parent?.classList.contains('odc-filterbar-more') || parent?.classList.contains('odc-filterbar-clear')) return textWidth(node)
  if (node.classList.contains('odc-filterbar-tools')) return WIDTHS.tools
  return 0
}

/**
 * Installs the stubs around every test of the file that calls it (at its top level).
 * - `bareCut`: the pills give the width of their value when cut down to their bare label (Bugs H). Off, a pill's button
 *   measures 0, as in the W0-4b and r5 files.
 * - `styleMarker`: the attribute of the `<style>` nodes the file adds (its `useFont`), removed after each test.
 */
export const installFilterBarLayout = ({ bareCut = false, styleMarker } = {}) => {
  const widthOf = makeWidthOf({ bareCut })
  beforeEach(() => {
    observers = []
    VALUE.w = 0
    Object.assign(WIDTHS, { main: 0, search: 200, tools: 80 })
    Object.assign(POSITION, { plusLeft: 0, originLeft: 0 })
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function () {
      if (this.classList.contains('odc-filterbar') || this.classList.contains('odc-filterbar-main')) return WIDTHS.main
      return 0
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const width = widthOf(this)
      const left = this.hasAttribute('data-filterbar-overflow') ? POSITION.plusLeft : this.classList.contains('odc-filterbar-start') ? POSITION.originLeft : 0
      return { width, height: 0, top: 0, left, right: left + width, bottom: 0, x: left, y: 0, toJSON () {} }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (styleMarker) document.head.querySelectorAll(`style[${styleMarker}]`).forEach(node => node.remove())
  })
}

// The font the value of a pill is drawn with (the bar cuts it down to 5em: 16px each).
export const useFont = styleMarker => {
  const style = document.createElement('style')
  style.setAttribute(styleMarker, '')
  style.textContent = '.odc-pill-value { font-size: 16px; }'
  document.head.appendChild(style)
}

export const sweep = (from, to, step) => {
  const list = []
  for (let main = from; to > from ? main <= to : main >= to; main += to > from ? step : -step) list.push(main)
  return list
}
// the number of times a series changes direction: false → true → false is 2
export const flips = series => series.filter((value, index) => index > 0 && value !== series[index - 1]).length
