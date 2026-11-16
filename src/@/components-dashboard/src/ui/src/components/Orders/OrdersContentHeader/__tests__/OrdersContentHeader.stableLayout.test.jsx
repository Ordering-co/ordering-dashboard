// redesign F6b (D-16, D-18): the page head and the notices above the list never change the height of what
// is below them. Layout is not measurable in jsdom, so these pin the rules that guarantee it (the measured
// result, in a browser, is in redesign/pilot-orders/tracker.md); the structure that carries them is tested
// in OrderNotification, WebsocketStatus and OrdersExportCSV.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '../content-header.css'), 'utf8')
const ruleOf = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*{([^}]*)}`, 'g'))].map(match => match[1]).join('\n')
}

describe('content-header.css · notices above the list (D-16)', () => {
  it('stack every notice in one grid cell, so the region is as tall as the tallest and never their sum', () => {
    expect(ruleOf('.odc-orders-notices')).toMatch(/display:\s*grid/)
    expect(ruleOf('.odc-orders-notices > *')).toMatch(/grid-area:\s*1\s*\/\s*1/)
  })

  // redesign F6d (Q3-03): a notice that is not shown takes no space. `visibility: hidden` kept the cell as tall as the
  // longer, hidden text (+26px at 1280 with the panel, 58px of blank on a phone), and the connection notice replaced
  // the sound one under the pointer (Accept became Update). Now the sound notice, once on screen, stays until the user
  // answers it, and the connection notice waits out of the flow (the pill already carries the state); then it shows.
  it('while the sound notice is up the connection notice waits out of the flow (display: none, no space)', () => {
    const rule = ruleOf('.odc-orders-notices:has(.odc-sound-notice) .odc-connection-notice')
    expect(rule).toMatch(/display:\s*none/)
    expect(rule).not.toMatch(/visibility:\s*hidden/)
  })

  it('no notice is ever hidden with visibility (it would keep its height in the shared cell)', () => {
    expect(css).not.toMatch(/\.odc-orders-notices[^{]*{[^}]*visibility:\s*hidden/)
    expect(css).not.toMatch(/\.odc-orders-notices:has\(\.odc-connection-notice\)\s+\.odc-sound-notice/)
  })

  it('from 768px every notice is one line: the text clips with an ellipsis, the action keeps its size and place', () => {
    const block = css.match(/@media\s*\(min-width:\s*768px\)\s*{([\s\S]*?)\n}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/\.odc-orders-notices \.odc-notice\s*{[^}]*flex-wrap:\s*nowrap/)
    expect(block[1]).toMatch(/\.odc-orders-notices \.odc-notice-text\s*{[^}]*white-space:\s*nowrap/)
    expect(block[1]).toMatch(/\.odc-orders-notices \.odc-notice-text\s*{[^}]*text-overflow:\s*ellipsis/)
    expect(block[1]).toMatch(/\.odc-orders-notices \.odc-notice-text\s*{[^}]*flex:\s*1 1 0/)
    expect(block[1]).toMatch(/\.odc-orders-notices \.odc-notice-action\s*{[^}]*flex:\s*none/)
  })
})

describe('content-header.css · the head is one row at any width (D-18)', () => {
  it('does not wrap: the head and the actions group stay on one line', () => {
    expect(ruleOf('.odc-page-head')).toMatch(/flex-wrap:\s*nowrap/)
    expect(ruleOf('.odc-page-head')).not.toMatch(/flex-wrap:\s*wrap/)
    const actions = ruleOf('.odc-page-actions')
    expect(actions).toMatch(/flex-wrap:\s*nowrap/)
    expect(actions).toMatch(/flex:\s*none/)
  })

  it('the title is what gives: it shrinks and truncates with an ellipsis', () => {
    const title = ruleOf('.odc-page-title')
    expect(title).toMatch(/flex:\s*0\s+1\s+auto/)
    expect(title).toMatch(/min-inline-size:\s*0/)
    expect(title).toMatch(/overflow:\s*hidden/)
    expect(title).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('below 600px of head Export keeps only its icon and its accessible name; Create is never collapsed', () => {
    const block = css.match(/@container\s*\(max-width:\s*599px\)\s*{([\s\S]*?)\n}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/\.odc-export-label\s*{[^}]*clip-path:\s*inset\(50%\)/)
    expect(block[1]).toMatch(/\.odc-export-icon\s*{[^}]*display:\s*inline-block/)
    expect(block[1]).not.toMatch(/display:\s*none|visibility:\s*hidden/)
    expect(block[1]).not.toMatch(/data-action='create'|data-action=create/)
    // outside that width the icon is not drawn, so the wide Export looks as it did
    expect(ruleOf('.odc-page-head .odc-export-icon')).toMatch(/display:\s*none/)
  })

  // redesign F6d (Q3-14): at 1280 with the menu expanded and the order panel open the head is ~550px and the 135px
  // «Reconnecting…» pill left the title 83 of 104px («Order…»). The pill goes to its mark first: under 640px of head
  // (the title, the pill's text and the page actions at their widest need ~600px).
  it('under 640px of head the live status keeps only its mark (zero-size text, name kept), before the title truncates', () => {
    const block = css.match(/@container\s*\(max-width:\s*639px\)\s*{([\s\S]*?)\n}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/\.odc-live-btn\.odc-btn\s*{[^}]*font-size:\s*0/)
    expect(block[1]).not.toMatch(/display:\s*none|visibility:\s*hidden/)
    expect(css).not.toMatch(/@container\s*\(max-width:\s*519px\)/)
  })
})

// (bugs H #68c): the title is the page's start (focusPageStart gives it tabindex -1 and focuses it). The browser's default ring
// was drawn on /orders because only PageHeader's `.odc-pagehead-title` had the brand pair (f297dd416). Same pair here: the brand ring on
// :focus-visible (keyboard), none on a plain programmatic focus.
describe('content-header.css · the title focus ring (#68c)', () => {
  it('draws the brand focus ring on :focus-visible, and no ring on a plain programmatic focus', () => {
    const ring = ruleOf('.odc-page-title:focus-visible')
    expect(ring).toMatch(/outline:\s*var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
    expect(ring).toMatch(/outline-offset:\s*var\(--od-focus-ring-offset\)/)
    expect(ruleOf('.odc-page-title:focus:not(:focus-visible)')).toMatch(/outline:\s*none/)
  })
})
