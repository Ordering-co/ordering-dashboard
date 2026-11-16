/* eslint-disable import/first */
// redesign UC-R1 (I-01, I-05): the fixes of the first live check that jsdom can show. jsdom has no layout, so what is pinned here
// is the markup (names, titles, the mark the page header collapses) and the CSS text that the live measurements then confirm
// (the numbers are in the batch reply, not in a test: a width is not a unit test).
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => text]
}))

import { CustomersHeader } from '../CustomersHeader'

const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8')
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const css0 = (file) => strip(read(file))
// The body of the first rule block of `css` whose prelude matches `prelude` (at the top level, nested blocks included)
const blockOf = (css, prelude) => {
  const start = css.search(prelude)
  expect(start, `${prelude} is in the css`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error('unbalanced css')
}

const renderHeader = (props = {}) => render(
  <CustomersHeader
    title='Customers'
    total={42}
    learn={<button type='button' className='odc-btn learn-drop-down' title='Learn'><span className='od-learn-label'>Learn</span></button>}
    actions={<button type='button' className='odc-btn'>Export CSV</button>}
    onAdd={() => {}}
    {...props}
  />
)

describe('header · one line in the list column (I-01)', () => {
  it('«Add customer» keeps its name and its tour anchor, with the label in the node the page header collapses', () => {
    renderHeader()
    const add = screen.getByRole('button', { name: 'Add customer' })
    expect(add).toHaveAttribute('data-tour', 'tour_add')
    expect(add).toHaveAttribute('data-variant', 'primary')
    // the tooltip of the icon-only state, and the text the narrow page header clips (it stays in the accessible name)
    expect(add).toHaveAttribute('title', 'Add customer')
    expect(add.querySelector('[data-collapse-label]')).toHaveTextContent('Add customer')
  })

  it('Export CSV is the page\'s own node, named and with a tooltip for when it is only its icon', () => {
    renderHeader()
    const exportButton = screen.getByRole('button', { name: 'Export CSV' })
    const holder = exportButton.closest('.odc-cpg-export')
    expect(holder).not.toBeNull()
    expect(holder).toHaveAttribute('title', 'Export CSV')
    // the holder is inside the page header's group of actions, so the group sizes it with the rest
    expect(holder.closest('.odc-pagehead-actions')).not.toBeNull()
  })

  it('without actions there is no holder (nothing for the group to carry)', () => {
    renderHeader({ actions: undefined })
    expect(document.querySelector('.odc-cpg-export')).toBeNull()
  })

  it('the css collapses Learn and Export CSV to their icons in a narrow header, by the header\'s own container', () => {
    const css = strip(read('customers-page.css'))
    const body = blockOf(css, /@container\s*\(max-width:\s*767px\)/)
    // Learn: its label (the span LearnDropDown draws) is clipped, not removed: the name and the title stay
    expect(body).toMatch(/\.odc-cpg-head\s+\.od-learn-label\s*\{[^}]*clip-path:\s*inset\(50%\)/)
    // Export: the button of the page's node takes the control's square; its words are the node marked data-collapse-label, clipped
    // (row 92: they were hidden with `font-size: 0`, a text node only the font could take away)
    expect(body).toMatch(/\.odc-cpg-export\s*>\s*\.odc-btn\s*\{[^}]*inline-size:\s*var\(--od-x-control-height\)/)
    expect(body).toMatch(/\.odc-cpg-export\s+\[data-collapse-label\]\s*\{[^}]*clip-path:\s*inset\(50%\)/)
  })

  it('no stylesheet of the two export holders hides the words with `font-size: 0` any more (row 92)', () => {
    expect(css0('customers-page.css')).not.toMatch(/font-size:\s*0\s*;/)
    const staff = css0('../StaffDirectory/staff-page.css')
    expect(staff).not.toMatch(/font-size:\s*0\s*;/)
    // the staff header already clips every node marked data-collapse-label in its narrow container, the export's included
    expect(blockOf(staff, /@container\s*\(max-width:\s*767px\)/)).toMatch(/\.sdl-head\s+\[data-collapse-label\]\s*\{[^}]*clip-path:\s*inset\(50%\)/)
  })

  it('the clip is for the export only: «Add customer» keeps collapsing under 600px by the page header, not under 768px', () => {
    const body = blockOf(strip(read('customers-page.css')), /@container\s*\(max-width:\s*767px\)/)
    expect(body).not.toMatch(/\.odc-cpg-head\s+\[data-collapse-label\]/)
  })

  it('the breakpoint is a literal inside @container only; every other length is a token', () => {
    const css = strip(read('customers-page.css'))
    const outside = css.replace(/@(container|media)[^{]*\{/g, '{')
    expect(outside).not.toMatch(/\d(px|rem|em)\b/)
  })
})

describe('overview · one column of values (I-05)', () => {
  const css = strip(read('customer-panel.css'))

  it('the rows share the tracks of their list: a row without a shortcut button lines up with the rest', () => {
    // each row was its own grid, so its `auto` track was as wide as ITS shortcut («View orders», «Adjust balance») and the
    // 1fr/2fr tracks of a row without one (Loyalty level, Member since) were wider: its value started further right
    const rows = blockOf(css, /\.ucp-rows\s*\{/)
    // (row 92): the label track is a share of the list's own width (both lists are as wide as the panel), no longer a `fr`
    // that the widest shortcut of THAT list (Account has «View orders», Contact only copy buttons) moves: Contact and Account line up
    expect(rows).toMatch(/grid-template-columns:\s*\d+%\s+minmax\(0,\s*1fr\)\s+auto/)
    expect(rows).not.toMatch(/\d+fr\)?\s+minmax\(0,\s*2fr\)/)
    const row = blockOf(css, /\n\.ucp-row\s*\{/)
    expect(row).toMatch(/grid-template-columns:\s*subgrid/)
    expect(row).toMatch(/grid-column:\s*1\s*\/\s*-1/)
  })

  it('in a narrow panel the rows keep sharing their list\'s tracks (label over value, shortcut at the end)', () => {
    const narrow = blockOf(css, /@container\s+odc-record\s*\(max-width:\s*480px\)/)
    expect(narrow).toMatch(/\.ucp-rows\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
    expect(narrow).not.toMatch(/\.ucp-row\s*\{[^}]*grid-template-columns:\s*minmax/)
  })
})
