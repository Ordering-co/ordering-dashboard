// (review R1): CSS is global once a chunk loads it. The store's Menu tab and P/Menu (the ⋯ menus, Export of /orders…)
// both use `odc-menu-item` and `odc-menu-label`; the tab's unscoped `.odc-menu-item { display: block; padding: 0 }` stripped every
// P/Menu item of the app once Stores had loaded. The tab's rules on a class P/Menu also uses must stay inside the tab's own list.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const STORES_MENU_CSS = read('../business-menu.css')
const PRODUCT_MENU_CSS = read('../../../Shared/Product/menu.css')
const PRODUCT_MENU_JSX = read('../../../Shared/Product/Menu.jsx')

// the classes P/Menu draws
const productMenuClasses = new Set([...PRODUCT_MENU_JSX.matchAll(/'(odc-menu[a-z0-9-]*)'/g)].map(match => match[1]))
// each selector of the tab's stylesheet (comments out, at-rule preludes skipped)
const selectorsOf = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('}')
  .map(block => block.split('{')[0].trim())
  .filter(prelude => prelude && !prelude.startsWith('@'))
  .flatMap(prelude => prelude.split(',').map(selector => selector.trim()))

describe('the store Menu tab stylesheet leaves P/Menu alone', () => {
  afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

  it('every rule on a class P/Menu also uses is scoped to the tab (under .odc-menu-list or .odc-menu-pane)', () => {
    const shared = selectorsOf(STORES_MENU_CSS).filter(selector => {
      const last = selector.split(/\s+|>|\+|~/).filter(Boolean).at(-1) || ''
      return [...last.matchAll(/\.(odc-menu[a-z0-9-]*)/g)].some(match => productMenuClasses.has(match[1]))
    })
    expect(shared.length).toBeGreaterThan(0) // the tab does style its own rows with these names
    shared.forEach(selector => expect(selector).toMatch(/^\.odc-menu-(list|pane)\b.*\s*(>|\s)\s*\.odc-menu-/))
  })

  it('a P/Menu item outside Stores keeps its flex row with the tab stylesheet loaded after P/Menu', () => {
    document.head.innerHTML = `<style>${PRODUCT_MENU_CSS}</style><style>${STORES_MENU_CSS}</style>`
    document.body.innerHTML = `
      <div class="odc-menu" role="menu"><div class="odc-menu-item" role="menuitem"><span class="odc-menu-label">Export</span></div></div>
      <ul class="odc-menu-list"><li class="odc-menu-item"><span class="odc-menu-label">Lunch</span></li></ul>`
    const [productItem, storeItem] = document.querySelectorAll('.odc-menu-item')
    expect(getComputedStyle(productItem).display).toBe('flex')
    expect(getComputedStyle(storeItem).display).toBe('block') // the tab's row looks as it did
  })
})
