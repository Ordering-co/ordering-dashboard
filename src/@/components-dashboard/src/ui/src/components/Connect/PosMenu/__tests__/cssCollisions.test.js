import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// redesign IM-15: CSS is global once a chunk loads it. The Connect pages (POS & Menu Sync, Sales Channels, Importers) and
// the payment methods of a store both used the prefix `odc-pm-`, and `.odc-pm-name`, `.odc-pm-search` and `.odc-pm-tools` meant two
// things: the payment methods' 44px flex row stretched the store name of the Connect table. No class may be defined by both.
const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const classesOf = (css) => new Set(css.match(/\.odc-pm-[a-z0-9-]+/g) || [])

describe('Connect PosMenu CSS vs the payment methods CSS', () => {
  it('share no class name', () => {
    const connect = new Set([
      ...classesOf(read('../pos-menu.css')),
      ...classesOf(read('../pos-menu-table.css')),
      ...classesOf(read('../pos-store-panel.css'))
    ])
    const payments = classesOf(read('../../../Stores/BusinessPaymentMethods/payment-methods.css'))
    expect([...payments].filter(name => connect.has(name))).toEqual([])
  })
})
