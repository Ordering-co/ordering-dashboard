/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// redesign SL-F2 (B2)
const snooze = vi.hoisted(() => ({ props: [] }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }]
}))
vi.mock('../../SnoozeComponent', async () => {
  const { createElement } = await import('react')
  return {
    SnoozeComponent: (props) => {
      snooze.props.push(props)
      return createElement('button', { type: 'button', onClick: props.onClose }, 'snooze body')
    }
  }
})

import { StoreEditorHeader } from '../StoreEditorHeader'

const business = { id: 42, name: 'Fast Bite', enabled: true, logo: 'https://img.test/logo.png', snooze_until: null, timezone: 'America/Bogota' }

const makeProps = (over = {}) => ({
  titleId: 'title',
  loading: false,
  business,
  handleChangeActiveBusiness: vi.fn(async () => ({ ok: true })),
  onOpenCategories: vi.fn(),
  storeUrl: 'https://shop.test/store/fastbite',
  onOpenSite: vi.fn(),
  isAllowRegisteredBusiness: true,
  handleDuplicateBusiness: vi.fn(),
  handleDeleteBusiness: vi.fn(),
  onSelectSection: vi.fn(),
  formState: { loading: false, changes: {} },
  setFormState: vi.fn(),
  handleUpdateBusinessClick: vi.fn(),
  streamConnectionState: { enabled: false },
  showExpand: true,
  isExpand: false,
  onToggleExpand: vi.fn(),
  isExtendExtraOpen: false,
  onShowAllSections: vi.fn(),
  onClose: vi.fn(),
  ...over
})

const openMenu = async (user) => {
  await user.click(screen.getByRole('button', { name: 'More actions' }))
  return screen.findByRole('menu')
}

afterEach(() => {
  document.getElementById('app-modals')?.remove()
  snooze.props = []
})

// redesign bugs F (Q-05 of bugs G on the store editor): a long store name gives way before the actions, in two lines and
// «…» (as P/RecordPanel, 2139eac6); the whole name stays in the DOM and in the heading's title
describe('StoreEditorHeader · a long name', () => {
  const css = readFileSync(path.join(__dirname, '..', 'store-editor.css'), 'utf8')
  const title = (() => {
    const start = css.indexOf('.odc-se-title {')
    return css.slice(start, css.indexOf('}', start))
  })()

  it('the title takes no width of its own to break the line, grows up to its text and clamps to two lines', () => {
    expect(title).toMatch(/flex:\s*1000 1 0/)
    expect(title).toMatch(/max-inline-size:\s*max-content/)
    expect(title).toMatch(/-webkit-line-clamp:\s*2/)
    expect(title).toMatch(/overflow:\s*hidden/)
  })

  it('keeps the whole name in the heading and its title', () => {
    const name = 'A store with a very long name that would take three or four lines in the header of the editor'
    render(<StoreEditorHeader {...makeProps({ business: { ...business, name } })} />)
    const heading = screen.getByRole('heading', { level: 2, name })
    expect(heading).toHaveAttribute('title', name)
  })
})

describe('StoreEditorHeader', () => {
  it('names the panel with the store (h2), shows its logo, its state and the Enable switch', () => {
    render(<StoreEditorHeader {...makeProps()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Fast Bite' })).toHaveAttribute('id', 'title')
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable' })).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.odc-avatar[data-kind="business"] img')).toHaveAttribute('src', 'https://img.test/logo.png')
  })

  it('says Disabled for a disabled store', () => {
    render(<StoreEditorHeader {...makeProps({ business: { ...business, enabled: false } })} />)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable' })).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the skeleton instead of the store while it loads', () => {
    render(<StoreEditorHeader {...makeProps({ loading: true, business: null })} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
    // redesign bugs Q: a link, so «disabled» is aria-disabled and no address while it loads
    const categories = screen.getByRole('link', { name: 'Categories & products' })
    expect(categories).toHaveAttribute('aria-disabled', 'true')
    expect(categories).not.toHaveAttribute('href')
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeDisabled()
  })

  it('only offers the way out when the store was not found', async () => {
    const user = userEvent.setup()
    const props = makeProps({ business: null })
    render(<StoreEditorHeader {...props} />)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Snooze' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  describe('Enable switch', () => {
    // redesign (owner decision 31 A): switching the store off asks first; this answers «Deactivate store»
    const confirmOff = async (user) => {
      const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Fast Bite?' })
      await user.click(within(dialog).getByRole('button', { name: 'Deactivate store' }))
    }

    it('asks before switching the store off, with the focus on Cancel; Cancel saves nothing', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Fast Bite?' })
      expect(within(dialog).getByText("Customers won't be able to order from it until you turn it back on.")).toBeInTheDocument()
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
      // the dialog is modal: the header behind it is hidden from the accessibility tree while it asks
      expect(screen.getByRole('switch', { name: 'Enable', hidden: true })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('switch', { name: 'Enable', hidden: true })).not.toHaveAttribute('aria-busy')
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(props.handleChangeActiveBusiness).not.toHaveBeenCalled()
      expect(screen.getByRole('switch', { name: 'Enable' })).toHaveAttribute('aria-checked', 'true')
    })

    it('switches a disabled store on at once, with no question', async () => {
      const user = userEvent.setup()
      const props = makeProps({ business: { ...business, enabled: false } })
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      expect(props.handleChangeActiveBusiness).toHaveBeenCalledWith(true)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('asks for the new value, shows it (busy) while it saves and keeps it when the stored value follows', async () => {
      const user = userEvent.setup()
      let finish
      const props = makeProps({ handleChangeActiveBusiness: vi.fn(() => new Promise((resolve) => { finish = resolve })) })
      const { rerender } = render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      await confirmOff(user)
      await waitFor(() => expect(props.handleChangeActiveBusiness).toHaveBeenCalledWith(false))
      const toggle = screen.getByRole('switch', { name: 'Enable' })
      expect(toggle).toHaveAttribute('aria-checked', 'false')
      expect(toggle).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Disabled')).toBeInTheDocument()

      // the controller writes the new value, then answers
      rerender(<StoreEditorHeader {...props} business={{ ...business, enabled: false }} />)
      finish({ ok: true })
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable' })).not.toHaveAttribute('aria-busy'))
      expect(screen.getByRole('switch', { name: 'Enable' })).toHaveAttribute('aria-checked', 'false')
    })

    it('goes back to the stored value when the save fails', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleChangeActiveBusiness: vi.fn(async () => ({ ok: false, error: ['no'] })) })
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      await confirmOff(user)
      await waitFor(() => expect(props.handleChangeActiveBusiness).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable' })).not.toHaveAttribute('aria-busy'))
      expect(screen.getByRole('switch', { name: 'Enable' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })

    it('goes back to the stored value when the save throws', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleChangeActiveBusiness: vi.fn(async () => { throw new Error('network') }) })
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      await confirmOff(user)
      await waitFor(() => expect(props.handleChangeActiveBusiness).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable' })).toHaveAttribute('aria-checked', 'true'))
    })

    it('ignores presses while it saves', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleChangeActiveBusiness: vi.fn(() => new Promise(() => {})) })
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      await confirmOff(user)
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      await user.click(screen.getByRole('switch', { name: 'Enable' }))
      expect(props.handleChangeActiveBusiness).toHaveBeenCalledTimes(1)
    })
  })

  describe('stream connection', () => {
    it.each([
      ['connected', 'Correct connection', 'done'],
      ['paused', 'Connection paused', 'pending'],
      ['disconnected', 'Connection disconnected', 'cancel']
    ])('shows %s as text with its state', (status, label, family) => {
      render(<StoreEditorHeader {...makeProps({ streamConnectionState: { enabled: true, status } })} />)
      expect(screen.getByText(label).closest('[data-family]')).toHaveAttribute('data-family', family)
    })

    it('shows nothing when the stream is not enabled', () => {
      render(<StoreEditorHeader {...makeProps({ streamConnectionState: { enabled: false, status: 'connected' } })} />)
      expect(screen.queryByText('Correct connection')).toBeNull()
    })

    it('shows a skeleton while the connection is checked', () => {
      const { container } = render(<StoreEditorHeader {...makeProps({ streamConnectionState: { enabled: true, loading: true } })} />)
      expect(container.querySelectorAll('.odc-se-head-tools .odc-skeleton').length).toBe(1)
    })
  })

  describe('shortcuts and sizes', () => {
    // redesign bugs Q: it was a <button> without an address (main had a link to /stores/products/<slug>)
    it('«Categories & products» is a link to the store products page of the slug', () => {
      render(<StoreEditorHeader {...makeProps({ business: { ...business, slug: 'fastbite' } })} />)
      const link = screen.getByRole('link', { name: 'Categories & products' })
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/stores/products/fastbite')
      expect(link).toHaveClass('odc-btn')
    })

    it('a plain click calls its handler and keeps the browser from following the link', () => {
      const props = makeProps({ business: { ...business, slug: 'fastbite' } })
      render(<StoreEditorHeader {...props} />)
      const notPrevented = fireEvent.click(screen.getByRole('link', { name: 'Categories & products' }))
      expect(notPrevented).toBe(false)
      expect(props.onOpenCategories).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['Cmd', { metaKey: true }],
      ['Ctrl', { ctrlKey: true }],
      ['Shift', { shiftKey: true }],
      ['the middle button', { button: 1 }]
    ])('%s + click is the browser\'s: no preventDefault and no call to the handler', (_name, init) => {
      const props = makeProps({ business: { ...business, slug: 'fastbite' } })
      render(<StoreEditorHeader {...props} />)
      const notPrevented = fireEvent.click(screen.getByRole('link', { name: 'Categories & products' }), init)
      expect(notPrevented).toBe(true)
      expect(props.onOpenCategories).not.toHaveBeenCalled()
    })

    it('the middle click (auxclick) is not intercepted', () => {
      const props = makeProps({ business: { ...business, slug: 'fastbite' } })
      render(<StoreEditorHeader {...props} />)
      const notPrevented = fireEvent(
        screen.getByRole('link', { name: 'Categories & products' }),
        new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })
      )
      expect(notPrevented).toBe(true)
      expect(props.onOpenCategories).not.toHaveBeenCalled()
    })

    it('«Snooze» opens SnoozeComponent in a dialog with the props it had, and closes it from there', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('button', { name: 'Snooze' }))
      const dialog = await screen.findByRole('dialog', { name: 'Snooze' })
      const last = snooze.props.at(-1)
      expect(last.dataState).toBe(business)
      // redesign bugs C: the dialog reads and writes the store's clock, the one the Overview shows
      expect(last.timeZone).toBe(business.timezone)
      expect(last.handleUpdate).toBe(props.handleUpdateBusinessClick)
      expect(last.setFormState).toBe(props.setFormState)
      expect(last.formState).toBe(props.formState)
      await user.click(within(dialog).getByRole('button', { name: 'snooze body' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('Expand / Collapse only with `showExpand`, named by the state', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      const { rerender } = render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('button', { name: 'Expand' }))
      expect(props.onToggleExpand).toHaveBeenCalledTimes(1)
      rerender(<StoreEditorHeader {...props} isExpand />)
      expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()
      rerender(<StoreEditorHeader {...props} showExpand={false} />)
      expect(screen.queryByRole('button', { name: /Expand|Collapse/ })).toBeNull()
    })

    it('«All sections» only when a section asked for the whole width', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      const { rerender } = render(<StoreEditorHeader {...props} />)
      expect(screen.queryByRole('button', { name: 'All sections' })).toBeNull()
      rerender(<StoreEditorHeader {...props} isExtendExtraOpen />)
      await user.click(screen.getByRole('button', { name: 'All sections' }))
      expect(props.onShowAllSections).toHaveBeenCalledTimes(1)
    })

    it('Close calls its handler', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<StoreEditorHeader {...props} />)
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })

    // redesign tanda AB (S-2): on a phone the full-screen panel leaves with «Back» (as Orders and Customers), not «×»
    describe('on a phone', () => {
      const original = window.matchMedia
      afterEach(() => { window.matchMedia = original })

      it('offers Back at the start instead of Close, and Back closes like Close', async () => {
        window.matchMedia = (query) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })
        const user = userEvent.setup()
        const props = makeProps()
        render(<StoreEditorHeader {...props} />)
        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
        const back = screen.getByRole('button', { name: 'Back' })
        const row = document.querySelector('.odc-se-head-row')
        expect(row.firstElementChild).toBe(back)
        await user.click(back)
        expect(props.onClose).toHaveBeenCalledTimes(1)
      })

      it('offers Back when the store was not found', () => {
        window.matchMedia = (query) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })
        render(<StoreEditorHeader {...makeProps({ business: null })} />)
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
      })
    })
  })

  describe('⋯ menu', () => {
    it('Preview opens the store, and is disabled without a store URL', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      const { unmount } = render(<StoreEditorHeader {...props} />)
      await openMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Preview' }))
      expect(props.onOpenSite).toHaveBeenCalledTimes(1)
      unmount()

      const other = makeProps({ storeUrl: null })
      render(<StoreEditorHeader {...other} />)
      await openMenu(user)
      expect(screen.getByRole('menuitem', { name: 'Preview' })).toHaveAttribute('aria-disabled', 'true')
    })

    // redesign stores 4.B (decision 6, G1-27): Duplicate asks first, naming the store, and stays busy until it answers
    it('Duplicate is only there with isAllowRegisteredBusiness, and asks first', async () => {
      const user = userEvent.setup()
      let answer
      const props = makeProps({ handleDuplicateBusiness: vi.fn(() => new Promise(resolve => { answer = resolve })) })
      const { unmount } = render(<StoreEditorHeader {...props} />)
      await openMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
      const dialog = await screen.findByRole('alertdialog')
      expect(within(dialog).getByText(/^Duplicate .*\?$/)).toBeInTheDocument()
      expect(props.handleDuplicateBusiness).not.toHaveBeenCalled()

      // Cancel sends nothing
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(props.handleDuplicateBusiness).not.toHaveBeenCalled()

      // Confirm sends once; the dialog stays, busy, until the answer
      await openMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
      const again = await screen.findByRole('alertdialog')
      const confirm = within(again).getByRole('button', { name: 'Duplicate store' })
      await user.click(confirm)
      await user.click(confirm)
      expect(props.handleDuplicateBusiness).toHaveBeenCalledTimes(1)
      expect(confirm).toHaveAttribute('aria-busy', 'true')
      await act(async () => { answer({ ok: true }) })
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      unmount()

      render(<StoreEditorHeader {...makeProps({ isAllowRegisteredBusiness: false })} />)
      await openMenu(user)
      expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBeNull()
    })

    it('Custom fields is there by default and opens that section', async () => {
      const user = userEvent.setup()
      const props = makeProps({ isAllowRegisteredBusiness: false })
      render(<StoreEditorHeader {...props} />)
      await openMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Custom fields' }))
      expect(props.onSelectSection).toHaveBeenCalledWith('custom_fields')
    })

    // redesign bugs C ()
    it('Custom fields is left out when the shell says it is not offered', async () => {
      const user = userEvent.setup()
      render(<StoreEditorHeader {...makeProps({ showCustomFields: false })} />)
      await openMenu(user)
      expect(screen.queryByRole('menuitem', { name: 'Custom fields' })).toBeNull()
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    })

    it('Delete asks first, naming the store, with the focus on Cancel; Cancel deletes nothing', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<StoreEditorHeader {...props} />)
      await openMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete Fast Bite?' })
      expect(within(dialog).getByText('Are you sure that you want to delete this business?')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Delete store' })).toBeInTheDocument()
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
      expect(props.handleDeleteBusiness).not.toHaveBeenCalled()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(props.handleDeleteBusiness).not.toHaveBeenCalled()
    })

    it('Delete store deletes it', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<StoreEditorHeader {...props} />)
      await openMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
      const dialog = await screen.findByRole('alertdialog')
      await user.click(within(dialog).getByRole('button', { name: 'Delete store' }))
      expect(props.handleDeleteBusiness).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    })
  })
})
