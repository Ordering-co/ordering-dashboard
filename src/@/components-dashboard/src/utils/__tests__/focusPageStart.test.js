// redesign billing-modal (C-4): the page-start focus target shared by the sidebar and the Billing dialog.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { focusPageStart } from '../focusPageStart'

const visible = element => {
  element.getClientRects = () => [{ width: 1, height: 1 }]
  return element
}

afterEach(() => { document.body.innerHTML = '' })

describe('focusPageStart', () => {
  it('focuses the first visible h1 outside the nav, with a tabindex that goes away on blur', () => {
    document.body.innerHTML = '<nav><h1>Menu</h1></nav><div><h1 hidden>Hidden</h1><h1>Orders</h1></div><button>Other</button>'
    const [inNav, hidden, page] = document.querySelectorAll('h1')
    ;[inNav, hidden, page].forEach(visible)
    focusPageStart(document.querySelector('nav'))
    expect(document.activeElement).toBe(page)
    expect(page.getAttribute('tabindex')).toBe('-1')
    document.querySelector('button').focus()
    expect(page.hasAttribute('tabindex')).toBe(false)
  })

  it('falls back to main (with a box) when the page has no visible h1', () => {
    document.body.innerHTML = '<main>Content</main>'
    visible(document.querySelector('main'))
    focusPageStart(null)
    expect(document.activeElement).toBe(document.querySelector('main'))
  })

  it('does nothing when there is no target', () => {
    focusPageStart(null)
    expect(document.activeElement).toBe(document.body)
  })
})

// (#76a): the shell main is `display: contents`, so it has no client rects and cannot take focus itself
describe('focusPageStart with a display: contents main', () => {
  it('skips a main with no client rects and focuses its first shown child', () => {
    document.body.innerHTML = '<nav>Menu</nav><main id="main-content"><div id="page">Content</div></main>'
    visible(document.getElementById('page'))
    focusPageStart(document.querySelector('nav'))
    expect(document.activeElement).toBe(document.getElementById('page'))
    expect(document.activeElement).not.toBe(document.querySelector('main'))
  })

  it('does not target a main with no client rects when there is nothing else', () => {
    document.body.innerHTML = '<main>Content</main>'
    focusPageStart(null)
    expect(document.activeElement).toBe(document.body)
  })
})

// the destination of focusPageStart (a 404 or offline h1, a main container...) is not always `.odc-pagehead-title`, which
// is the only element the brand focus ring was written for. The destination is marked, and the shell's CSS gives the mark the ring.
describe('focusPageStart marks its destination for the brand focus ring', () => {
  it('sets data-odc-page-start on the focused h1 and takes it away when the focus leaves', () => {
    document.body.innerHTML = '<nav>Menu</nav><div><h1>This page isn\'t available</h1></div><button>Other</button>'
    const heading = visible(document.querySelector('h1'))
    focusPageStart(document.querySelector('nav'))
    expect(document.activeElement).toBe(heading)
    expect(heading).toHaveAttribute('data-odc-page-start')
    document.querySelector('button').focus()
    expect(heading).not.toHaveAttribute('data-odc-page-start')
    expect(heading.hasAttribute('tabindex')).toBe(false)
  })

  it('marks the fallback container too, and keeps a tabindex the page set itself', () => {
    document.body.innerHTML = '<main tabindex="0">Content</main><button>Other</button>'
    const main = visible(document.querySelector('main'))
    focusPageStart(null)
    expect(document.activeElement).toBe(main)
    expect(main).toHaveAttribute('data-odc-page-start')
    expect(main.getAttribute('tabindex')).toBe('0')
    document.querySelector('button').focus()
    expect(main).not.toHaveAttribute('data-odc-page-start')
  })

  it('does not stack listeners when the same element is claimed again before it loses the focus', () => {
    document.body.innerHTML = '<h1>Orders</h1><button>Other</button>'
    const heading = visible(document.querySelector('h1'))
    focusPageStart(null)
    focusPageStart(null)
    expect(heading).toHaveAttribute('data-odc-page-start')
    document.querySelector('button').focus()
    expect(heading).not.toHaveAttribute('data-odc-page-start')
  })
})

// The rule lives in the shell's sidebar.css (always in the bundle: SidebarNav is imported by App), next to `.odc-skip-link`, and copies
// the ring of `.odc-pagehead-title:focus-visible` (page-header.css, which stays as it is).
describe('the brand focus ring for any page-start destination', () => {
  const read = file => readFileSync(path.join(__dirname, '..', '..', 'ui', 'src', 'components', 'Shared', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const declarations = (css, selector) => {
    const match = css.match(new RegExp(`${selector.replace(/[.[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
    return match ? match[1].trim().replace(/\s+/g, ' ') : null
  }

  it('gives [data-odc-page-start]:focus-visible the same ring as the page title, with tokens only', () => {
    const ring = declarations(read('Product/page-header.css'), '.odc-pagehead-title:focus-visible')
    expect(ring).toBe('outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color); outline-offset: var(--od-focus-ring-offset);')
    expect(declarations(read('SideBar/sidebar.css'), '[data-odc-page-start]:focus-visible')).toBe(ring)
  })

  it('draws no ring for a plain programmatic focus (a click or a route change from the mouse), as the page title', () => {
    expect(declarations(read('SideBar/sidebar.css'), '[data-odc-page-start]:focus:not(:focus-visible)')).toBe('outline: none;')
  })
})
