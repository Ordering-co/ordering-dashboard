/* eslint-disable import/first */
// redesign F6b (D-17, C20): while the businesses load, the step draws the rows it will have: the avatar at its
// real size, the name and the address line, and enough of them to fill the visible area of the list.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }]
}))

import { SelectBusinesses } from '../SelectBusinesses'

const mountLoading = () => renderWithProviders(
  <SelectBusinesses businessList={{ loading: true, businesses: undefined }} selectedBusiness={null} setSelectedBusiness={vi.fn()} />
)
const css = readFileSync(resolve(__dirname, '../steps.css'), 'utf8')
const ruleOf = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*{([^}]*)}`, 'g'))].map(match => match[1]).join('\n')
}

describe('SelectBusinesses · loading rows (D-17)', () => {
  it('draws six rows: the list shows at most six, so the area is full from the first frame', () => {
    mountLoading()
    const list = screen.getByRole('list', { name: 'Select business' })
    expect(list).toHaveAttribute('aria-busy', 'true')
    expect(list.querySelectorAll('li.odc-steps-skeleton-row')).toHaveLength(6)
    // the list's own cap is six comfortable rows (steps.css), the count the skeleton fills
    expect(ruleOf('.odc-steps-list[data-scroll]')).toMatch(/max-block-size:\s*calc\(var\(--od-x-row-comfortable\)\s*\*\s*6\)/)
  })

  it('each row has the avatar box at the real avatar size, then a name line and an address line', () => {
    mountLoading()
    const rows = screen.getByRole('list', { name: 'Select business' }).querySelectorAll('li.odc-steps-skeleton-row')
    rows.forEach((row) => {
      const [avatar, ...rest] = row.querySelectorAll('.odc-skeleton')
      expect(avatar).toHaveAttribute('data-shape', 'box')
      expect(avatar.style.inlineSize).toBe('var(--od-x-avatar)')
      expect(avatar.style.blockSize).toBe('var(--od-x-avatar)')
      // the two text lines live in the same block the real row keeps them in
      const main = row.querySelector('.odc-steps-row-main')
      expect(main).not.toBeNull()
      expect(main.querySelectorAll('.odc-skeleton')).toHaveLength(2)
      expect(rest).toHaveLength(2)
      expect(row.querySelectorAll('.odc-skeleton[aria-hidden="true"]')).toHaveLength(3)
    })
  })

  it('reads as busy and says nothing: no buttons, no text', () => {
    const { container } = mountLoading()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(within(screen.getByRole('list', { name: 'Select business' })).queryByText(/\S/)).toBeNull()
    expect(container.querySelectorAll('li.odc-steps-skeleton-row .odc-skeleton').length).toBe(18)
  })
})

describe('steps.css · the loading row has the geometry of the real row (D-17)', () => {
  it('same padding, gap and hairline as the row, and a line box per text line', () => {
    const row = ruleOf('.odc-steps-skeleton-row')
    expect(row).toMatch(/gap:\s*var\(--od-space-3\)/)
    expect(row).toMatch(/padding-block:\s*var\(--od-space-2\)/)
    expect(row).toMatch(/min-block-size:\s*var\(--od-x-row-comfortable\)/)
    expect(ruleOf('.odc-steps-list > .odc-steps-skeleton-row + .odc-steps-skeleton-row')).toMatch(/border-block-start:\s*var\(--od-x-hairline\)\s+solid\s+var\(--od-border\)/)
    expect(ruleOf('.odc-steps-skeleton-name')).toMatch(/min-block-size:\s*calc\(var\(--od-x-type-body-size\)\s*\*\s*var\(--od-x-leading-ui\)\)/)
    expect(ruleOf('.odc-steps-skeleton-meta')).toMatch(/min-block-size:\s*calc\(var\(--od-x-type-ui-size\)\s*\*\s*var\(--od-x-leading-ui\)\)/)
  })

  it('the two-line ghost row leaves its floor to its content, so a capped grid cannot squeeze it under the real row', () => {
    expect(ruleOf('.odc-steps-skeleton-row[data-rich]')).toMatch(/min-block-size:\s*auto/)
    mountLoading()
    document.querySelectorAll('li.odc-steps-skeleton-row').forEach(row => expect(row).toHaveAttribute('data-rich'))
  })

  it('a busy list clips instead of showing a scrollbar for the ghost rows', () => {
    expect(ruleOf(".odc-steps-list[data-scroll][aria-busy='true']")).toMatch(/overflow:\s*hidden/)
  })
})
