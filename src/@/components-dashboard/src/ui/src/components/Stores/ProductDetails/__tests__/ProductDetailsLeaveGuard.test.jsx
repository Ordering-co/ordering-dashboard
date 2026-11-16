/* eslint-disable import/first */
import React, { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router-dom'

// redesign (J2, P-14 / D-56 f): the product editor is a leave-guard host, like the store editor. Closing the panel (X,
// Escape), changing section or tab, a route change and the list's own way out ask first while the shared form holds unsaved edits;
// a clean editor goes at once. Enable and Snooze never ask: they send only their own key and leave the other edits alone
// (ProductDetatils.test.jsx, SnoozeComponent tests).
const mocks = vi.hoisted(() => ({
  addQuery: vi.fn(),
  removeQuery: vi.fn(),
  validate: null // J2 review H1: what the mounted section's form validation answers (null: no form registered)
}))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url, parsePrice: (value) => `$${Number(value).toFixed(2)}` }],
  ProductDetatils: () => null
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: mocks.addQuery, removeQueryToUrl: mocks.removeQuery }))
vi.mock('../../SnoozeComponent', async () => {
  const { createElement } = await import('react')
  return { SnoozeComponent: () => createElement('div', { 'data-testid': 'snooze' }, 'snooze body') }
})
vi.mock('../../ProductDesktopPreview', () => ({ ProductDesktopPreview: () => null }))
vi.mock('../../../Shared', async () => {
  const { createElement } = await import('react')
  return {
    Modal: () => null,
    ProgressRing: () => createElement('div', { 'data-testid': 'ring' })
  }
})
vi.mock('../ProductSectionBody', async () => {
  const { createElement, useContext } = await import('react')
  const { ProductFormValidationContext } = await import('../productFormValidation')
  return {
    ProductSectionBody: (props) => {
      // the section's form registers its validation with the editor, as ProductDetatilsInformation does
      const validation = useContext(ProductFormValidationContext)
      if (validation) validation.current = mocks.validate
      return createElement('div', { 'data-testid': 'section-body', 'data-section': props.section, 'data-tab': props.tab ?? '' })
    }
  }
})

import { ProductDetailsUI } from '../index'

const makeProduct = (over = {}) => ({
  id: 7,
  name: 'Cheese Burger',
  type: 'product',
  enabled: true,
  category_id: 9,
  images: 'https://img.test/burger.png',
  price: 10,
  ...over
})

const makeProps = (over = {}) => {
  const product = over.product ?? makeProduct()
  return {
    open: true,
    onClose: vi.fn(),
    product,
    productId: product.id,
    categoryId: product.category_id,
    business: { id: 3 },
    productState: { loading: false, product, error: null },
    formState: { loading: false, changes: {} },
    cleanFormState: vi.fn(),
    handleChangeFormState: vi.fn(),
    handleUpdateClick: vi.fn(async () => ({ ok: true })),
    handleSuccessUpdate: vi.fn(),
    handleChangeProductActiveState: vi.fn(async () => ({ ok: true })),
    handleDuplicateProduct: vi.fn(async () => ({ ok: true })),
    handleDeleteProduct: vi.fn(async () => undefined),
    duplicateState: { loading: false, error: null },
    productCart: { options: {} },
    showProductOption: vi.fn(() => true),
    getProduct: vi.fn(),
    ...over
  }
}

const DIRTY = { loading: false, changes: { name: 'Cheese Burger XL', price: 12 } }

const shell = (props, url = '/stores/products/fast-bite?category=9&product=7') => (
  <MemoryRouter initialEntries={[url]}>
    <Link to='/orders'>Orders page</Link>
    <ProductDetailsUI {...props} />
  </MemoryRouter>
)

const nav = () => screen.queryByRole('navigation', { name: 'Product sections' })
const choose = async (user, name) => user.click(within(nav()).getByRole('button', { name }))
const escape = () => fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })
const question = () => screen.queryByRole('alertdialog')
const closeButton = () => within(document.getElementById('product_details')).getByRole('button', { name: 'Close' })

beforeEach(() => {
  mocks.validate = null
  mocks.addQuery.mockClear()
  mocks.removeQuery.mockClear()
  window.innerWidth = 1280
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('ProductDetails · leave guard · closing the panel', () => {
  it('a clean editor closes at once, without a question', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(shell(props))
    await user.click(closeButton())
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(question()).toBeNull()
  })

  it('unsaved edits: the X asks first and nothing closes yet', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props))
    await user.click(closeButton())
    expect(props.onClose).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Save your changes?')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save and continue' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('Discard drops the shared form and then closes', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props))
    await user.click(closeButton())
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(props.cleanFormState).toHaveBeenCalledWith({ changes: {} })
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateClick).not.toHaveBeenCalled()
  })

  it('Keep editing stays: nothing closes, nothing is dropped', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props))
    await user.click(closeButton())
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.cleanFormState).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2, name: 'Cheese Burger' })).toBeInTheDocument()
  })

  it('Save and continue saves the form and then closes; a failed save stays', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    const { unmount } = render(shell(props))
    await user.click(closeButton())
    await user.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    expect(props.handleUpdateClick).toHaveBeenCalledTimes(1)
    unmount()

    const failing = makeProps({ formState: DIRTY, handleUpdateClick: vi.fn(async () => ({ ok: false, error: ['nope'] })) })
    render(shell(failing))
    await user.click(closeButton())
    await user.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(failing.handleUpdateClick).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(question()).toBeNull())
    expect(failing.onClose).not.toHaveBeenCalled()
  })

  // J2 review H1: the question's «Save and continue» goes through the section form's own validation (required name, regular price
  // over the price): an invalid form sends nothing and the user stays, as the form's own Save does
  it('Save and continue runs the form validation first: invalid, nothing is sent and the editor stays', async () => {
    const user = userEvent.setup()
    mocks.validate = vi.fn(async () => false)
    const props = makeProps({ formState: { loading: false, changes: { name: '' } } })
    render(shell(props, '/stores/products/fast-bite?category=9&product=7&section=product_details&tab=information'))
    await user.click(closeButton())
    await user.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(mocks.validate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(question()).toBeNull())
    expect(props.handleUpdateClick).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('Save and continue with a valid form saves', async () => {
    const user = userEvent.setup()
    mocks.validate = vi.fn(async () => true)
    const props = makeProps({ formState: DIRTY })
    render(shell(props, '/stores/products/fast-bite?category=9&product=7&section=product_details&tab=information'))
    await user.click(closeButton())
    await user.click(await screen.findByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    expect(mocks.validate).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateClick).toHaveBeenCalledTimes(1)
  })

  it('Escape asks too, and a clean editor closes with it', async () => {
    const dirty = makeProps({ formState: DIRTY })
    const { unmount } = render(shell(dirty))
    escape()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(dirty.onClose).not.toHaveBeenCalled()
    unmount()

    const clean = makeProps()
    render(shell(clean))
    escape()
    expect(clean.onClose).toHaveBeenCalledTimes(1)
  })

  it('names the section that holds the edits', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props, '/stores/products/fast-bite?category=9&product=7&section=product_details&tab=information'))
    await user.click(closeButton())
    expect(await screen.findByText('You have unsaved changes in Information. Save them before you leave, or discard them.')).toBeInTheDocument()
  })

  it('ignores edits that are being saved (the form is loading)', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: { ...DIRTY, loading: true } })
    render(shell(props))
    await user.click(closeButton())
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ProductDetails · leave guard · changing section', () => {
  it('a clean editor changes section at once', async () => {
    const user = userEvent.setup()
    render(shell(makeProps()))
    await choose(user, 'Information')
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-tab', 'information')
    expect(question()).toBeNull()
  })

  it('unsaved edits: another section asks first, and Keep editing leaves the section and the address as they were', async () => {
    const user = userEvent.setup()
    render(shell(makeProps({ formState: DIRTY })))
    await choose(user, 'Information')
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByTestId('section-body')).toBeNull()
    expect(mocks.addQuery).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(screen.queryByTestId('section-body')).toBeNull()
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })

  it('Discard drops the edits and then opens the section', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props))
    await choose(user, 'Ingredients / Properties')
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(props.cleanFormState).toHaveBeenCalledWith({ changes: {} })
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'ingredients')
    expect(mocks.addQuery).toHaveBeenCalledWith({ section: 'ingredients' })
  })

  it('a tab to another tab asks too, and so does going back to the Overview', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props, '/stores/products/fast-bite?category=9&product=7&section=product_details&tab=information'))
    await choose(user, 'Advanced')
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-tab', 'information')
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(question()).toBeNull())
    await choose(user, 'Overview')
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByTestId('section-body')).toBeInTheDocument()
  })

  it('the ⋯ menu «Custom fields» asks too', async () => {
    const user = userEvent.setup()
    render(shell(makeProps({ formState: DIRTY })))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByTestId('section-body')).toBeNull()
  })

  it('the deep link is not held: it opens the section when it mounts, with edits or not', () => {
    render(shell(makeProps({ formState: DIRTY }), '/stores/products/fast-bite?category=9&product=7&section=product_options'))
    expect(screen.getByTestId('section-body')).toHaveAttribute('data-section', 'product_options')
    expect(question()).toBeNull()
  })
})

describe('ProductDetails · leave guard · Enable, Snooze and the other ways out', () => {
  it('Enable with unsaved edits does not ask: it only asks the controller for its own change', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props))
    await user.click(screen.getByRole('switch', { name: 'Enable Cheese Burger' }))
    await waitFor(() => expect(props.handleChangeProductActiveState).toHaveBeenCalledTimes(1))
    expect(question()).toBeNull()
    expect(props.handleUpdateClick).not.toHaveBeenCalled()
    expect(props.cleanFormState).not.toHaveBeenCalled()
  })

  it('opening Snooze with unsaved edits does not ask nor touch the form', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: DIRTY })
    render(shell(props))
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    expect(await screen.findByTestId('snooze')).toBeInTheDocument()
    expect(question()).toBeNull()
    expect(props.handleUpdateClick).not.toHaveBeenCalled()
    expect(props.cleanFormState).not.toHaveBeenCalled()
  })

  it('a route change to another page asks while the form is dirty, and goes through when it is clean', async () => {
    const user = userEvent.setup()
    const dirty = makeProps({ formState: DIRTY })
    const { unmount } = render(shell(dirty))
    await user.click(screen.getByRole('link', { name: 'Orders page' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    unmount()

    render(shell(makeProps()))
    await user.click(screen.getByRole('link', { name: 'Orders page' }))
    expect(question()).toBeNull()
  })

  it('the list asks through `leaveGuardRef` before it opens another product', async () => {
    const user = userEvent.setup()
    const leaveGuardRef = createRef()
    const props = makeProps({ formState: DIRTY, leaveGuardRef })
    render(shell(props))
    const proceed = vi.fn()
    const cancel = vi.fn()
    act(() => { leaveGuardRef.current.requestLeave(proceed, cancel) })
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(proceed).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    expect(proceed).not.toHaveBeenCalled()
  })

  it('without edits the list is let through at once', () => {
    const leaveGuardRef = createRef()
    render(shell(makeProps({ leaveGuardRef })))
    const proceed = vi.fn()
    act(() => { leaveGuardRef.current.requestLeave(proceed) })
    expect(proceed).toHaveBeenCalledTimes(1)
  })
})
