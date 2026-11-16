// redesign tramo A r3 (W0-QA1-04): on a low phone (360x640, 390x600, 320x568) the pill popovers ran past the bottom of the
// window and their «Clear» was out of reach (Driver popover 233 -> 688 on a 640 window). The popup is now never taller than
// the room Base UI measured (`--available-height`), and only the list gives way: the search field and the foot stay.
// Measured live after the fix: popover bottom = window height - 16 (the viewport gap) in the three sizes and at 320x640, and
// «Clear» answers elementFromPoint in Driver, Driver group and Business (Status is the same popup class).
// jsdom has no layout, so the test pins the CSS that does it.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'filter-popover.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const bodyOf = selector => rules.filter(([s]) => s === selector).map(([, body]) => body).join(' ')

describe('W0-QA1-04: pill popovers fit the available height and keep their foot on screen', () => {
  it('the popup is capped at --available-height and scrolls what does not fit', () => {
    const popup = bodyOf('.odc-orders-popover')
    expect(popup).toContain('max-block-size: var(--available-height)')
    expect(popup).toContain('overflow: auto')
  })

  it('the Status / Driver / Driver group / Business popups are a column where only the list gives way', () => {
    const column = bodyOf('.odc-orders-picker-popup, .odc-orders-checklist-popup')
    expect(column).toContain('display: flex')
    expect(column).toContain('flex-direction: column')
    expect(column).toContain('overflow: hidden')
    expect(bodyOf('.odc-orders-picker-popup .odc-orders-picker-list, .odc-orders-checklist-popup > .odc-orders-checklist')).toMatch(/flex: 0 1 auto;.*min-block-size: 0/)
    expect(bodyOf('.odc-orders-picker-popup > *, .odc-orders-checklist-popup > *')).toContain('min-block-size: 0')
    // the search field and «Clear» never shrink
    expect(bodyOf('.odc-orders-picker-popup .odc-orders-picker-search, .odc-orders-picker-popup .odc-orders-popover-foot, .odc-orders-checklist-popup > .odc-orders-popover-foot')).toContain('flex: none')
  })

  // redesign (from bugs H, in bugs F): the positioner sits in the isolated overlay portal of #app-modals, so its z-index
  // only orders it inside that portal; it names the overlay role instead of «raised + 9»
  it('the popover positioner takes the overlay layer role', () => {
    expect(bodyOf('.odc-orders-popover-positioner')).toContain('z-index: calc(var(--od-x-layer-overlay) + 9)')
  })

  // redesign bugs F row 23 (R-7 of stores 2.D): 8.5 rows, so the cut row says the list scrolls (coordinator: every list)
  it('the list keeps its own cap (8.5 rows or 60dvh) for tall windows', () => {
    expect(bodyOf('.odc-orders-picker-list')).toContain('max-block-size: min(60dvh, calc(var(--odc-picker-row) * 8.5))')
  })

  it('the classes the CSS addresses are the ones the markup carries', () => {
    const source = readFileSync(path.join(__dirname, '..', 'FilterPopover.jsx'), 'utf8')
    expect(source).toContain("popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'")
    expect(source).toContain("className='odc-orders-popover-foot'")
    const status = readFileSync(path.join(__dirname, '..', '..', '..', 'Orders', 'OrderStatusSubFilter', 'index.js'), 'utf8')
    expect(status).toContain("popupClassName='odc-orders-checklist-popup'")
  })
})
