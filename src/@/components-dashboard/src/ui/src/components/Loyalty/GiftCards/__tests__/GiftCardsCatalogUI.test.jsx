/* eslint-disable import/first */
// redesign GC-C (; D5, D7, D8 | GC-05, GC-07, GC-10, GC-11, GC-18): the catalog of gift cards for sale, in one Product Sheet.
// The controller (PlatformProductsList, lote A) is a stand-in with the same contract (`platformProductsListState {loading, products,
// error}`, `reload`, `handleSuccessAddProduct`, …) that keeps the list in state. The card (GiftCardEditor) is a stub that records what
// the catalog hands it and lets a test make the form dirty or finish an add or a delete the way the controller does; its own behavior
// has its test (GiftCardDetail). The Product wrappers (Sheet, ConfirmDialog, InlineNotice, EmptyState, Status, Button) are the real ones.
// Covered: the list in its states (loading, error with Retry, empty, rows); a row opens the card and Back returns the focus to the row;
// the notice links to the Settings hub; `?product=` opens the card and keeps `status`, `page` and `pageSize`; the discard guard on every
// way out; two panes from 1100px (one click to change card) and one column below; the controller is not asked for anything until
// the sheet opens.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { Route } from 'react-router-dom'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ctl = vi.hoisted(() => ({ state: null, setState: null, reload: null, mounts: 0, editor: null, realEditor: false, deleteError: null }))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ optimizeImage: url => url, parsePrice: value => `$ ${value}` }],
    PlatformProductsList: ({ UIComponent, ...props }) => {
      const [state, setState] = ReactModule.useState(ctl.state)
      ctl.setState = setState // redesign GC-D (R3): a test plays the answer of the API (loading, then the list or another error)
      ReactModule.useEffect(() => { ctl.mounts++ }, [])
      return ReactModule.createElement(UIComponent, {
        ...props,
        platformProductsListState: state,
        reload: ctl.reload,
        handleSuccessAddProduct: result => setState(prev => ({ ...prev, products: [...prev.products, result] })),
        handleSuccessUpdateProduct: result => setState(prev => ({ ...prev, products: prev.products.map(item => (item.id === result.id ? result : item)) })),
        handleSuccessDeleteProduct: id => setState(prev => ({ ...prev, products: prev.products.filter(item => item.id !== id) }))
      })
    },
    // redesign GC-D (R4): the controller of the real card, for the delete flow: it deletes at once and finishes the way the real one does
    PlatformProductDetail: ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, {
      ...props,
      formState: { loading: false, error: null, changes: {} },
      handleChangeItem: () => {},
      handleUpdateProduct: async () => ({ ok: true }),
      handleAddProduct: async () => ({ ok: true }),
      handleDeleteProduct: async () => {
        if (ctl.deleteError) return { ok: false, error: [ctl.deleteError] }
        props.handleSuccessDeleteProduct(props.product.id)
        props.onClose?.()
        return { ok: true }
      }
    })
  }
})
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

// The card: records its props and plays the controller's part when a test asks
vi.mock('../../GiftCardDetail', async () => {
  const ReactModule = await import('react')
  const actual = await vi.importActual('../../GiftCardDetail')
  return {
    GiftCardEditor: (props) => {
      ctl.editor = props
      // redesign GC-D (R4): the delete flow runs on the real card (its ConfirmDialog and its menu), over the stand-in controller above
      if (ctl.realEditor) return ReactModule.createElement(actual.GiftCardEditor, props)
      return ReactModule.createElement(
        'div',
        { 'data-testid': 'editor' },
        ReactModule.createElement('span', { 'data-testid': 'editor-product' }, props.product?.id ? `card ${props.product.id}` : 'new card'),
        ReactModule.createElement('button', { type: 'button', onClick: () => props.onDirtyChange(true) }, 'Make dirty'),
        ReactModule.createElement('button', { type: 'button', onClick: () => props.onDirtyChange(false) }, 'Make clean'),
        ReactModule.createElement('button', { type: 'button', onClick: () => { props.handleSuccessAddProduct({ id: 99, name: 'Fresh', price: 5, enabled: true, image: null }); props.onClose() } }, 'Finish add'),
        ReactModule.createElement('button', { type: 'button', onClick: () => { props.handleSuccessDeleteProduct(props.product.id); props.onClose() } }, 'Finish delete')
      )
    }
  }
})

import { GiftCardsCatalog } from '../index'

const PRODUCTS = [
  { id: 1, name: 'Birthday', price: 25, enabled: true, image: 'https://cdn.test/birthday.png' },
  { id: 2, name: 'Thank you', price: 10, enabled: false, image: null },
  { id: 3, name: 'Holidays', price: 50, enabled: true, image: null }
]
const loaded = (products = PRODUCTS) => ({ loading: false, products, error: null })

// jsdom has no layout: a rule of the stylesheet is read from the file (the declarations of the rules that name exactly `selector`)
const css = readFileSync(resolvePath(__dirname, '../gift-cards-catalog.css'), 'utf8')
const cssRule = (source, selector) => {
  const declarations = {}
  for (const [, selectors, body] of source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').map(item => item.trim().replace(/\s+/g, ' ')).includes(selector)) continue
    body.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
      const index = item.indexOf(':')
      declarations[item.slice(0, index).trim()] = item.slice(index + 1).trim()
    })
  }
  return declarations
}

// jsdom answers matchMedia with `matches: false`: one is installed that evaluates the (min|max)-width queries and tells its listeners
// when the width changes (`viewport.set`)
const installViewport = (initial) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const listeners = new Set()
  const viewport = { width: initial }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? viewport.width >= Number(value) : viewport.width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    addListener: listener => listeners.add(listener),
    removeListener: listener => listeners.delete(listener)
  })
  window.innerWidth = initial
  viewport.set = (width) => {
    viewport.width = width
    window.innerWidth = width
    act(() => { listeners.forEach(listener => listener({ matches: true })) })
  }
  viewport.restore = () => Object.assign(window, original)
  return viewport
}

const ROUTE = '/gift-cards'
let viewport
let onClose
const renderCatalog = (state = loaded(), { route = ROUTE, open = true } = {}) => {
  ctl.state = state
  window.history.replaceState(null, '', route)
  onClose = vi.fn()
  const element = (isOpen) => (
    <>
      <GiftCardsCatalog open={isOpen} onClose={onClose} />
      <Route path='*' render={({ location }) => <span data-testid='router-location'>{location.pathname + location.search}</span>} />
    </>
  )
  const view = renderWithProviders(element(open), { initialEntries: [route] })
  return { ...view, setOpen: isOpen => view.rerender(element(isOpen)) }
}
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))
const sheet = () => document.querySelector('.odc-sheet')
const sheetTitle = () => sheet().querySelector('.odc-overlay-title')
const rowOf = (id) => document.querySelector(`[data-gcc-row="${id}"]`)

beforeEach(() => {
  viewport = installViewport(600)
  ctl.reload = vi.fn()
  ctl.mounts = 0
  ctl.editor = null
  ctl.realEditor = false
  ctl.deleteError = null
})

afterEach(() => {
  viewport.restore()
  window.history.replaceState(null, '', '/')
})

describe('GiftCardsCatalog · the sheet and the list', () => {
  it('asks the controller for nothing until the sheet opens, and lists the products when it does', async () => {
    const view = renderCatalog(loaded(), { open: false })
    expect(ctl.mounts).toBe(0)
    expect(document.querySelector('.odc-sheet')).toBeNull()
    view.setOpen(true)
    expect(await screen.findByRole('dialog', { name: 'Gift cards for sale' })).toBeInTheDocument()
    expect(ctl.mounts).toBe(1)
    expect(within(screen.getByRole('list', { name: 'Gift cards for sale' })).getAllByRole('listitem')).toHaveLength(3)
  })

  it('every product is a native button: name, status, amount; the image only when there is one', async () => {
    renderCatalog()
    const rows = await screen.findAllByRole('button', { name: /Birthday|Thank you|Holidays/ })
    expect(rows).toHaveLength(3)
    rows.forEach(row => expect(row.tagName).toBe('BUTTON'))
    expect(within(rowOf(1)).getByText('Enabled')).toBeInTheDocument()
    expect(within(rowOf(2)).getByText('Disabled')).toBeInTheDocument()
    expect(within(rowOf(1)).getByText('$ 25').className).toContain('odc-figure')
    expect(rowOf(1).querySelector('img')).toHaveAttribute('src', 'https://cdn.test/birthday.png')
    expect(rowOf(2).querySelector('img')).toBeNull()
    expect(document.querySelectorAll('.odc-gcc-list img:not([src])')).toHaveLength(0)
  })

  it('loading: five ghosts and a label, no rows', async () => {
    renderCatalog({ loading: true, products: [], error: null })
    const list = await screen.findByRole('list', { name: 'Gift cards for sale' })
    expect(list).toHaveAttribute('aria-busy', 'true')
    expect(list.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(5)
    expect(within(list).getByText('Loading')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-gcc-row]')).toHaveLength(0)
  })

  it('an error is an error, not an empty list: the message and Retry', async () => {
    renderCatalog({ loading: false, products: [], error: ['Server exploded'] })
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Server exploded')).toBeInTheDocument()
    expect(screen.queryByText('No gift cards for sale yet')).not.toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(ctl.reload).toHaveBeenCalledTimes(1)
  })

  // redesign GC-D (R3): «Retry» removes the error (and itself) while the list loads, and the focus fell to <body>, outside the modal sheet.
  // It goes to what the answer is: the first row, the new «Retry» if it fails again, the title of the sheet if the list is empty.
  describe('«Retry» keeps the focus inside the sheet (R3)', () => {
    const failing = { loading: false, products: [], error: ['Server exploded'] }
    const retryAndWait = async () => {
      ctl.reload = vi.fn(() => ctl.setState({ loading: true, products: [], error: null }))
      renderCatalog(failing)
      const retry = await screen.findByRole('button', { name: 'Retry' })
      retry.focus()
      await userEvent.keyboard('{Enter}')
      expect(ctl.reload).toHaveBeenCalledTimes(1)
      await screen.findByRole('list', { name: 'Gift cards for sale' }) // loading
      expect(document.activeElement).not.toBe(retry)
    }

    it('to the first row when the list comes back', async () => {
      await retryAndWait()
      act(() => ctl.setState(loaded()))
      await waitFor(() => expect(rowOf(1)).toHaveFocus())
    })

    it('to the new «Retry» when it fails again', async () => {
      await retryAndWait()
      act(() => ctl.setState({ loading: false, products: [], error: ['Still down'] }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus())
    })

    it('to the title of the sheet when the list is empty', async () => {
      await retryAndWait()
      act(() => ctl.setState(loaded([])))
      await waitFor(() => expect(sheetTitle()).toHaveFocus())
    })
  })

  it('an error with no text says it in its own words', async () => {
    renderCatalog({ loading: false, products: [], error: [] })
    expect(await screen.findByText("We couldn't load the gift cards for sale.")).toBeInTheDocument()
  })

  it('empty: says so, and Add new is still there', async () => {
    renderCatalog(loaded([]))
    expect(await screen.findByText('No gift cards for sale yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new gift card' })).toBeInTheDocument()
  })

  it('the Stripe notice is in the catalog, translated by key, with the way to the Settings hub', async () => {
    renderCatalog()
    const notice = (await screen.findByText('Stripe activation is required.')).closest('[role="status"]')
    expect(notice).toHaveTextContent('Compatible only with Wallet.')
    const link = within(notice).getByRole('link', { name: 'Gift card settings' })
    expect(link).toHaveAttribute('href', '/settings?group=payments&category=addon_gift_cards')
    await userEvent.click(link)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('router-location')).toHaveTextContent('/settings?group=payments&category=addon_gift_cards')
  })

  // redesign GC-D (R7 + the squeezed notice of the mechanical pass): in the `action` slot (`flex: none`) the link left the text 31-62px in
  // fr, it, de, pt, nl and bg at 390. It goes inside the text, on its own line after the notice, and it is Product's link button, which
  // gives the 44px reach on a phone (a bare link measured 105×16 with none).
  it('the settings link is inside the text, on its own line, as Product’s link button (R7)', async () => {
    renderCatalog()
    const notice = (await screen.findByText('Stripe activation is required.')).closest('[role="status"]')
    const link = within(notice).getByRole('link', { name: 'Gift card settings' })
    expect(notice.querySelector('.odc-notice-action')).toBeNull()
    expect(link.closest('.odc-notice-text')).not.toBeNull()
    expect(link).toHaveClass('odc-btn')
    expect(link).toHaveAttribute('data-variant', 'link')
    // its own line: a block of its own, after the text of the notice
    const line = link.parentElement
    expect(line).toHaveClass('odc-gcc-notice-link')
    expect(cssRule(css, '.odc-gcc-notice-link').display).toBe('block')
    expect(notice.querySelector('.odc-notice-text').lastElementChild).toBe(line)
  })
})

describe('GiftCardsCatalog · one column (below 1100px)', () => {
  it('a row opens its card in place of the list: the sheet takes the name, Back returns and the focus is on the row', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Thank you/ }))
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 2')
    expect(sheetTitle()).toHaveTextContent('Thank you')
    expect(document.querySelectorAll('[data-gcc-row]')).toHaveLength(0)
    await waitFor(() => expect(sheetTitle()).toHaveFocus())
    expect(urlParams().product).toBe('2')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(sheetTitle()).toHaveTextContent('Gift cards for sale')
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
    expect(urlParams().product).toBeUndefined()
  })

  // «Back» is Product's IconButton (32px seen, a centred 44×44 area from `.odc-btn::after` with a coarse pointer), but it is the
  // first thing in the sheet's scrolling body (`.odc-overlay-body`, overflow auto, no padding on top): the 6px of its area above the
  // button were clipped and the effective area measured 38px. The head leaves that room with a coarse pointer, from the tokens.
  // jsdom has no layout, so the class that gives the area and the rule that keeps it whole are read.
  it('«Back» keeps its whole 44px reach with a coarse pointer: Product’s icon button, and room above it from the tokens', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Thank you/ }))
    const back = screen.getByRole('button', { name: 'Back' })
    expect(back).toHaveClass('odc-btn')
    expect(back).toHaveAttribute('data-icon-only')
    expect(back.closest('.odc-gcc-detail-head')).not.toBeNull()
    const coarse = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/@media \(pointer: coarse\), \(max-width: 767px\) \{([\s\S]*?\n\})/)
    expect(coarse).not.toBeNull()
    const head = cssRule(coarse[1], '.odc-gcc-detail-head')
    expect(head['padding-block-start']).toBe('calc((var(--od-x-target-coarse) - var(--od-x-control-height)) / 2)')
    expect(head['padding-block-start']).not.toMatch(/\d+px/)
  })

  it('«Add new gift card» opens an empty card, Back returns the focus to the button', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: 'Add new gift card' }))
    expect(screen.getByTestId('editor-product')).toHaveTextContent('new card')
    expect(sheetTitle()).toHaveTextContent('New gift card')
    expect(urlParams().product).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add new gift card' })).toHaveFocus())
  })

  it('adding a card goes back to the list with the focus on its row; deleting goes back with the focus on Add new', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: 'Add new gift card' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish add' }))
    await waitFor(() => expect(rowOf(99)).toHaveFocus())

    await userEvent.click(rowOf(2))
    await userEvent.click(screen.getByRole('button', { name: 'Finish delete' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add new gift card' })).toHaveFocus())
    expect(rowOf(2)).toBeNull()
  })
})

// redesign GC-D (R4): the ConfirmDialog of the card gives the focus back to the menu item that opened it, which is gone, and the sheet
// takes it to its first «Close». After a delete that worked the card is gone too: the focus goes to «Add new gift card» (what
// `onEditorDone` meant). This runs on the real card.
describe('GiftCardsCatalog · the delete dialog of a card (R4)', () => {
  const askDelete = async () => {
    ctl.realEditor = true
    await userEvent.click(await screen.findByRole('button', { name: /Thank you/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('Cancel puts the focus back on «More actions» of the card', async () => {
    renderCatalog()
    const dialog = await askDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('a refused delete closes the dialog, shows why and puts the focus back on «More actions»', async () => {
    ctl.deleteError = 'Gift card in use'
    renderCatalog()
    const dialog = await askDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Gift card in use')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('the focus goes to «Add new gift card» once the card is deleted', async () => {
    renderCatalog()
    const dialog = await askDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(rowOf(2)).toBeNull())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add new gift card' })).toHaveFocus())
    // and it stays: nothing takes it later
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(screen.getByRole('button', { name: 'Add new gift card' })).toHaveFocus()
  })
})

describe('GiftCardsCatalog · the URL (GC-05)', () => {
  it('`?product=` opens that card once the list is there, and leaves status, page and pageSize alone', async () => {
    renderCatalog(loaded(), { route: '/gift-cards?status=redeemed&page=2&pageSize=25&product=2' })
    await waitFor(() => expect(screen.getByTestId('editor-product')).toHaveTextContent('card 2'))
    expect(urlParams()).toEqual({ status: 'redeemed', page: '2', pageSize: '25', product: '2' })

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(urlParams()).toEqual({ status: 'redeemed', page: '2', pageSize: '25' })

    await userEvent.click(await screen.findByRole('button', { name: /Holidays/ }))
    expect(urlParams()).toEqual({ status: 'redeemed', page: '2', pageSize: '25', product: '3' })
    expect(window.location.search).not.toContain('id=')
  })

  it('waits for the list: nothing opens while it loads, and an unknown id opens nothing', async () => {
    renderCatalog({ loading: true, products: [], error: null }, { route: '/gift-cards?product=2' })
    await screen.findByRole('list', { name: 'Gift cards for sale' })
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  it('an id that is not in the list opens nothing', async () => {
    renderCatalog(loaded(), { route: '/gift-cards?page=3&product=404' })
    await screen.findByRole('button', { name: /Birthday/ })
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  it('closing the sheet removes `?product=` and keeps the rest', async () => {
    renderCatalog(loaded(), { route: '/gift-cards?status=redeemed&product=1' })
    await screen.findByTestId('editor')
    await userEvent.click(within(sheet()).getAllByRole('button', { name: 'Close' })[0])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(urlParams()).toEqual({ status: 'redeemed' })
  })

  it('when the parent closes the sheet the view starts again at the list', async () => {
    const view = renderCatalog(loaded(), { route: '/gift-cards?page=2&product=1' })
    await screen.findByTestId('editor')
    view.setOpen(false)
    await waitFor(() => expect(urlParams()).toEqual({ page: '2' }))
    view.setOpen(true)
    expect(await screen.findByRole('button', { name: /Birthday/ })).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })
})

describe('GiftCardsCatalog · the discard guard (decision 17)', () => {
  const dirtyCard = async (name = /Thank you/) => {
    await userEvent.click(await screen.findByRole('button', { name }))
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
  }
  const guard = () => screen.findByRole('alertdialog', { name: 'Discard your changes?' })

  it('closing with the X asks first: Keep editing stays, Discard closes', async () => {
    renderCatalog()
    await dirtyCard()
    await userEvent.click(within(sheet()).getAllByRole('button', { name: 'Close' })[0])
    const dialog = await guard()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 2')

    await userEvent.click(within(sheet()).getAllByRole('button', { name: 'Close' })[0])
    await userEvent.click(within(await guard()).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(urlParams().product).toBeUndefined()
  })

  it('Esc asks first too', async () => {
    renderCatalog()
    await dirtyCard()
    await userEvent.keyboard('{Escape}')
    await guard()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Back asks first, and Discard goes back to the list', async () => {
    renderCatalog()
    await dirtyCard()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(within(await guard()).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('button', { name: /Thank you/ })).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  it('a card with nothing to lose closes without asking', async () => {
    renderCatalog()
    await dirtyCard()
    await userEvent.click(screen.getByRole('button', { name: 'Make clean' }))
    await userEvent.click(within(sheet()).getAllByRole('button', { name: 'Close' })[0])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('the settings link asks first when there are changes', async () => {
    viewport.set(1440)
    renderCatalog()
    await dirtyCard()
    await userEvent.click(screen.getByRole('link', { name: 'Gift card settings' }))
    expect(screen.getByTestId('router-location')).toHaveTextContent(/^\/gift-cards$/)
    await userEvent.click(within(await guard()).getByRole('button', { name: 'Discard' }))
    expect(screen.getByTestId('router-location')).toHaveTextContent('/settings?group=payments&category=addon_gift_cards')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('GiftCardsCatalog · two panes (from 1100px, as `main`)', () => {
  beforeEach(() => {
    viewport.set(1440)
  })

  it('the list and the card show together; the sheet widens only while a card is open', async () => {
    renderCatalog()
    await screen.findByRole('button', { name: /Birthday/ })
    expect(sheet().className).not.toContain('odc-gcc-sheet--wide')
    await userEvent.click(rowOf(1))
    expect(sheet().className).toContain('odc-gcc-sheet--wide')
    expect(rowOf(1)).toBeInTheDocument()
    expect(rowOf(3)).toBeInTheDocument()
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 1')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('the row of the open card says so (aria-current) in the list that shows beside it', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Holidays/ }))
    expect(rowOf(3)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(1)).not.toHaveAttribute('aria-current')
  })

  // redesign GC-D (R6): two «Close» one under the other did different things (one closes the card, the other the whole sheet) and
  // sounded the same with Tab. The card's is «Close gift card».
  it('the sheet keeps its name and the card has its own heading and its own «Close gift card»', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Birthday/ }))
    expect(sheetTitle()).toHaveTextContent('Gift cards for sale')
    const heading = screen.getByRole('heading', { name: 'Birthday', level: 3 })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(within(sheet()).getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    const pane = heading.closest('section')
    expect(within(pane).queryByRole('button', { name: 'Close' })).toBeNull()
    await userEvent.click(within(pane).getByRole('button', { name: 'Close gift card' }))
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled() // the card closes, the list stays
    await waitFor(() => expect(rowOf(1)).toHaveFocus())
    expect(sheet().className).not.toContain('odc-gcc-sheet--wide')
  })

  it('choosing another card is one click, and so is «Add new gift card»', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Birthday/ }))
    await userEvent.click(rowOf(3))
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 3')
    expect(urlParams().product).toBe('3')
    await userEvent.click(screen.getByRole('button', { name: 'Add new gift card' }))
    expect(screen.getByTestId('editor-product')).toHaveTextContent('new card')
    expect(urlParams().product).toBeUndefined()
  })

  it('only one primary button per view: Add new gives way to the card’s Save', async () => {
    renderCatalog()
    await screen.findByRole('button', { name: /Birthday/ })
    expect(screen.getByRole('button', { name: 'Add new gift card' })).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(rowOf(1))
    expect(screen.getByRole('button', { name: 'Add new gift card' })).toHaveAttribute('data-variant', 'secondary')
  })

  it('changing card with changes pending asks first; Keep editing stays on the card', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Birthday/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
    await userEvent.click(rowOf(3))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 1')

    await userEvent.click(rowOf(3))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 3')
  })

  it('going from two panes to one keeps the open card', async () => {
    renderCatalog()
    await userEvent.click(await screen.findByRole('button', { name: /Birthday/ }))
    viewport.set(600)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-gcc-row]')).toHaveLength(0)
    expect(sheetTitle()).toHaveTextContent('Birthday')
    expect(screen.getByTestId('editor-product')).toHaveTextContent('card 1')
  })
})
