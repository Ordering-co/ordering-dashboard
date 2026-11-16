/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// redesign SP-F1 (D1)
const probes = vi.hoisted(() => ({ snooze: [], preview: [] }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }]
}))
vi.mock('../../SnoozeComponent', async () => {
  const { createElement } = await import('react')
  return {
    SnoozeComponent: (props) => {
      probes.snooze.push(props)
      return createElement('button', { type: 'button', onClick: props.onClose }, 'snooze body')
    }
  }
})
vi.mock('../../ProductDesktopPreview', async () => {
  const { createElement } = await import('react')
  return {
    ProductDesktopPreview: (props) => {
      probes.preview.push(props)
      return createElement('div', { 'data-testid': 'preview', 'data-mobile': String(!!props.isMobileView) }, props.product?.name)
    }
  }
})
// The legacy Modal needs the controller layer; here it is a box with a close button.
vi.mock('../../../Shared', async () => {
  const { createElement } = await import('react')
  return {
    Modal: ({ open, onClose, children }) => open
      ? createElement('div', { role: 'dialog', 'aria-label': 'legacy modal' }, children, createElement('button', { type: 'button', onClick: onClose }, 'Close legacy'))
      : null
  }
})

import { ProductEditorHeader } from '../ProductEditorHeader'

const product = { id: 7, name: 'Cheese Burger', enabled: true, images: 'https://img.test/burger.png', snooze_until: null }

const makeProps = (over = {}) => ({
  titleId: 'title',
  loading: false,
  product,
  handleChangeProductActiveState: vi.fn(async () => ({ ok: true })),
  handleDuplicateProduct: vi.fn(async () => ({ ok: true })),
  handleDeleteProduct: vi.fn(async () => undefined),
  duplicateState: { loading: false, error: null },
  onSelectSection: vi.fn(),
  formState: { loading: false, changes: {} },
  handleChangeFormState: vi.fn(),
  handleUpdateClick: vi.fn(),
  productCart: { options: {} },
  showProductOption: vi.fn(() => true),
  getProduct: vi.fn(),
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
  probes.snooze = []
  probes.preview = []
})

describe('ProductEditorHeader', () => {
  it('names the panel with the product (h2), shows its thumbnail, its state and the Enable switch named by the product', () => {
    render(<ProductEditorHeader {...makeProps()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Cheese Burger' })).toHaveAttribute('id', 'title')
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.odc-pe-thumb img')).toHaveAttribute('src', 'https://img.test/burger.png')
  })

  it('says Disabled for a disabled product, and draws an icon where there is no image', () => {
    render(<ProductEditorHeader {...makeProps({ product: { ...product, enabled: false, images: null } })} />)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).toHaveAttribute('aria-checked', 'false')
    expect(document.querySelector('.odc-pe-thumb img')).toBeNull()
    expect(document.querySelector('.odc-pe-thumb svg')).not.toBeNull()
  })

  it('shows skeletons instead of the product while it loads, with the controls off', () => {
    render(<ProductEditorHeader {...makeProps({ loading: true, product: null })} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeDisabled()
  })

  it('only offers the way out when the product could not be loaded', async () => {
    const user = userEvent.setup()
    const props = makeProps({ product: null })
    render(<ProductEditorHeader {...props} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Product' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Snooze' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  describe('Enable switch', () => {
    it('asks the controller for the opposite, shows it (busy) while it saves and keeps it when the stored value follows', async () => {
      const user = userEvent.setup()
      let finish
      const props = makeProps({ handleChangeProductActiveState: vi.fn(() => new Promise((resolve) => { finish = resolve })) })
      const { rerender } = render(<ProductEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
      expect(props.handleChangeProductActiveState).toHaveBeenCalledTimes(1)
      const toggle = screen.getByRole('switch', { name: 'Enable Cheese Burger' })
      expect(toggle).toHaveAttribute('aria-checked', 'false')
      expect(toggle).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Disabled')).toBeInTheDocument()

      rerender(<ProductEditorHeader {...props} product={{ ...product, enabled: false }} />)
      finish({ ok: true })
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).not.toHaveAttribute('aria-busy'))
      expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).toHaveAttribute('aria-checked', 'false')
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('goes back to the stored value and says so when the save fails (M-12)', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleChangeProductActiveState: vi.fn(async () => ({ ok: false, error: ['Price is required'] })) })
      render(<ProductEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Price is required')
      expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })

    it('says a generic line when the failure has no text, and also when the call throws', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleChangeProductActiveState: vi.fn(async () => { throw new Error('') }) })
      render(<ProductEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('We couldn\'t save the change.')
      expect(screen.getByRole('switch', { name: 'Enable Cheese Burger' })).toHaveAttribute('aria-checked', 'true')
    })

    it('clears the line with the next try and when another product is shown', async () => {
      const user = userEvent.setup()
      const handleChangeProductActiveState = vi.fn()
        .mockResolvedValueOnce({ ok: false, error: ['no'] })
        .mockResolvedValueOnce({ ok: true })
      const props = makeProps({ handleChangeProductActiveState })
      const { rerender } = render(<ProductEditorHeader {...props} />)
      await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())

      handleChangeProductActiveState.mockResolvedValueOnce({ ok: false, error: ['again'] })
      await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('again')
      rerender(<ProductEditorHeader {...props} product={{ ...product, id: 8, name: 'Fries' }} />)
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('the ⋯ menu', () => {
    it('lists Preview, Duplicate, Custom fields and Delete', async () => {
      const user = userEvent.setup()
      render(<ProductEditorHeader {...makeProps()} />)
      const menu = within(await openMenu(user))
      expect(menu.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Preview', 'Duplicate', 'Custom fields', 'Delete'])
    })

    it('Custom fields opens that section', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
      expect(props.onSelectSection).toHaveBeenCalledWith('custom_fields')
    })

    // redesign D-9 (owner, 2026-10-19): Duplicate asks first; nothing is created until «Duplicate product».
    it('Duplicate asks «Duplicate <product>?» first and creates the copy only on «Duplicate product»', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Duplicate Cheese Burger?' })
      expect(within(dialog).getByText('This creates a copy of this product in the same category. This product does not change.')).toBeInTheDocument()
      expect(props.handleDuplicateProduct).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(props.handleDuplicateProduct).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).toBeNull()

      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duplicate product' }))
      expect(props.handleDuplicateProduct).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('Duplicate stays open and busy until the API answers, and a second click does not make a second copy', async () => {
      const user = userEvent.setup()
      let finish
      const props = makeProps({ handleDuplicateProduct: vi.fn(() => new Promise((resolve) => { finish = resolve })) })
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
      const confirm = within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duplicate product' })
      await user.click(confirm)
      await user.click(confirm)
      expect(props.handleDuplicateProduct).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })).toBeDisabled()

      finish({ ok: true })
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    })

    it('Duplicate says so when it fails (the API answered with an error), after the confirmation closes', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleDuplicateProduct: vi.fn(async () => ({ ok: false, error: ['Category not found'] })) })
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duplicate product' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Category not found')
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    })

    it('Duplicate has a line of its own when the API gives no text', async () => {
      const user = userEvent.setup()
      const props = makeProps({ handleDuplicateProduct: vi.fn(async () => ({ ok: false, error: null })) })
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duplicate product' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('We couldn\'t duplicate the product.')
    })

    it('Duplicate is off while a copy is being made, so the confirmation cannot be opened', async () => {
      const user = userEvent.setup()
      render(<ProductEditorHeader {...makeProps({ duplicateState: { loading: true, error: null } })} />)
      await openMenu(user)
      const item = await screen.findByRole('menuitem', { name: 'Duplicate' })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      await user.click(item)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('Delete asks «Delete <product>?» first and deletes only on «Delete product»', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete Cheese Burger?' })
      // the title already asks; the body says what happens (it does not repeat the question)
      expect(within(dialog).getByText("This can't be undone. The product disappears from every menu of this store.")).toBeInTheDocument()
      expect(within(dialog).queryByText('Are you sure that you want to delete the product?')).toBeNull()
      expect(props.handleDeleteProduct).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(props.handleDeleteProduct).not.toHaveBeenCalled()

      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete product' }))
      expect(props.handleDeleteProduct).toHaveBeenCalledTimes(1)
    })
  })

  describe('Preview', () => {
    it('opens the modal of main with the storefront simulation, untouched, on the desktop view', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Preview' }))
      const modal = await screen.findByRole('dialog', { name: 'legacy modal' })
      expect(within(modal).getByRole('heading', { name: 'Preview' })).toBeInTheDocument()
      expect(within(modal).getByTestId('preview')).toHaveAttribute('data-mobile', 'false')
      const last = probes.preview.at(-1)
      expect(last.product).toBe(props.product)
      expect(last.productCart).toBe(props.productCart)
      expect(last.showProductOption).toBe(props.showProductOption)
    })

    it('switches between the desktop and the mobile view, reloads the product, and goes back to desktop when it is closed', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<ProductEditorHeader {...props} />)
      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Preview' }))
      const modal = await screen.findByRole('dialog', { name: 'legacy modal' })

      await user.click(within(modal).getByRole('button', { name: 'Reload' }))
      expect(props.getProduct).toHaveBeenCalledTimes(1)

      await user.click(within(modal).getByRole('button', { name: 'Mobile view' }))
      expect(within(modal).getByTestId('preview')).toHaveAttribute('data-mobile', 'true')
      await user.click(within(modal).getByRole('button', { name: 'Desktop view' }))
      expect(within(modal).getByTestId('preview')).toHaveAttribute('data-mobile', 'false')

      await user.click(within(modal).getByRole('button', { name: 'Mobile view' }))
      await user.click(within(modal).getByRole('button', { name: 'Close legacy' }))
      expect(screen.queryByRole('dialog', { name: 'legacy modal' })).toBeNull()

      await openMenu(user)
      await user.click(await screen.findByRole('menuitem', { name: 'Preview' }))
      expect(within(await screen.findByRole('dialog', { name: 'legacy modal' })).getByTestId('preview')).toHaveAttribute('data-mobile', 'false')
    })
  })

  it('Snooze opens SnoozeComponent in a dialog with the same props as before', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<ProductEditorHeader {...props} />)
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    const dialog = await screen.findByRole('dialog', { name: 'Snooze' })
    const last = probes.snooze.at(-1)
    expect(last.dataState).toBe(props.product)
    expect(last.handleUpdate).toBe(props.handleUpdateClick)
    expect(last.handleChangeFormState).toBe(props.handleChangeFormState)
    expect(last.formState).toBe(props.formState)
    await user.click(within(dialog).getByRole('button', { name: 'snooze body' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })

  it('Expand and Collapse follow `showExpand` and `isExpand`', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    const { rerender } = render(<ProductEditorHeader {...props} />)
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(props.onToggleExpand).toHaveBeenCalledTimes(1)
    rerender(<ProductEditorHeader {...props} isExpand />)
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()
    rerender(<ProductEditorHeader {...props} showExpand={false} />)
    expect(screen.queryByRole('button', { name: /Expand|Collapse/ })).toBeNull()
  })

  it('offers «All sections» only when a section asked for the whole width', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    const { rerender } = render(<ProductEditorHeader {...props} />)
    expect(screen.queryByRole('button', { name: 'All sections' })).toBeNull()
    rerender(<ProductEditorHeader {...props} isExtendExtraOpen />)
    await user.click(screen.getByRole('button', { name: 'All sections' }))
    expect(props.onShowAllSections).toHaveBeenCalledTimes(1)
  })

  it('the close button closes the editor', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<ProductEditorHeader {...props} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

// redesign at 390px the product name got the ~55px left by the thumbnail, state, switch and actions in one nowrap row, and broke
// letter by letter («McCr / ispy™ / Strip / s»; the old `overflow-wrap` let every letter be a break). `main` cut by words. The header row
// now wraps (the actions drop to their own line before the name is squeezed) and the name breaks only inside a word longer than the
// line. A sheet is not laid out in jsdom, so the rules are read from it.
describe('ProductEditorHeader · name and actions on a narrow panel', () => {
  const css = readFileSync(resolve(__dirname, '../product-editor.css'), 'utf8')
  const rule = (selector) => {
    const escaped = selector.replace(/[.[\]()]/g, '\\$&')
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
    expect(match, `rule ${selector}`).not.toBeNull()
    return match[1]
  }

  it('the name breaks between words, not between letters', () => {
    const title = rule('.odc-pe-title')
    expect(title).toMatch(/overflow-wrap:\s*break-word/)
    expect(title).not.toMatch(/anywhere|break-all/)
  })

  it('the row wraps, so the actions go to another line instead of squeezing the name', () => {
    expect(rule('.odc-pe-head-row')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('the thumbnail, name, state and switch are one block with room for the name; the actions stay at the end', () => {
    const lead = rule('.odc-pe-head-lead')
    expect(lead).toMatch(/flex:\s*1 1 calc\(/)
    expect(lead).toMatch(/min-inline-size:\s*0/)
    expect(rule('.odc-pe-actions')).toMatch(/margin-inline-start:\s*auto/)
  })

  it('draws the thumbnail, name, state and switch together in the block, and the actions outside it', async () => {
    render(<ProductEditorHeader {...makeProps()} />)
    const lead = document.querySelector('.odc-pe-head-lead')
    expect(lead).not.toBeNull()
    expect(lead.querySelector('.odc-pe-thumb')).not.toBeNull()
    expect(within(lead).getByRole('heading', { level: 2 })).toBeInTheDocument()
    expect(within(lead).getByRole('switch')).toBeInTheDocument()
    expect(lead.querySelector('.odc-pe-actions')).toBeNull()
    expect(document.querySelector('.odc-pe-head-row > .odc-pe-actions')).not.toBeNull()
  })
})
