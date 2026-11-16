// redesign F6g-2: the order summary of the wizard aligns on the start side, so in RTL its titles, labels and values share one edge
// (the page body says `text-align: left`, which every text node of the summary used to inherit).
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Summary } from '../Summary'

const css = readFileSync(resolve(__dirname, '../wizard.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = Array.from(css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)).map(([, selector, body]) => ({ selector: selector.trim(), body }))
const summaryRules = rules.filter(({ selector }) => /odc-wizard-(summary|block|total)/.test(selector))

describe('F6g-2 · wizard summary alignment', () => {
  it('declares text-align: start on the summary root, which its headings, labels and values inherit', () => {
    const root = rules.find(({ selector }) => selector === '.odc-wizard-summary')
    expect(root.body).toMatch(/text-align:\s*start/)
  })

  it('uses no physical left/right alignment or spacing anywhere in the summary', () => {
    expect(summaryRules.length).toBeGreaterThan(5)
    summaryRules.forEach(({ selector, body }) => {
      expect(body, selector).not.toMatch(/text-align:\s*(left|right)/)
      expect(body, selector).not.toMatch(/(margin|padding|border)-(left|right)/)
      expect(body, selector).not.toMatch(/(^|[;\s])(left|right)\s*:/)
    })
  })

  it('renders the summary heading, the labels and the total', () => {
    render(
      <Summary
        label='Order summary'
        blocks={[{ id: 'customer', label: 'Customer', lines: null, step: 1 }]}
        total={null}
        totalLabel='Total'
        editLabel='Edit'
        notSetLabel='Not set yet'
      />
    )
    expect(screen.getAllByText('Order summary').length).toBeGreaterThan(0)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })
})
