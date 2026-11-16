import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const websiteState = vi.hoisted(() => ({
  project: '22sept',
  websiteProduct: 'web_marketplace_26',
  legacySiteUrl: 'https://22sept.orderingplus.com',
  sites: [],
  loading: false
}))

// What the controller gives the page in each test (the controller itself is replaced below)
const controller = vi.hoisted(() => ({
  categories: undefined,
  categorySelected: null,
  businessError: null,
  businessLoading: false,
  errors: null,
  calls: {}
}))

const business = (slug) => ({
  id: slug === 'tastewine' ? 3 : 7,
  slug,
  name: slug,
  categories: controller.categories ?? [{ id: 11, name: 'Beer', rank: 1, products: [] }]
})

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useApi: () => [{ project: websiteState.project, root: 'https://api.test' }, { configurations: { subdomain: 'orderingplus' } }],
    useConfig: () => [{ configs: { site_url: { value: websiteState.legacySiteUrl } } }],
    useSite: () => [{ sites: websiteState.sites, loading: websiteState.loading }],
    useToast: () => [{}, { showToast: () => {} }],
    ToastType: { Info: 'info' },
    // The controller with the store already loaded
    BusinessProductsListing: ({ UIComponent, ...props }) => React.createElement(UIComponent, {
      ...props,
      businessState: { loading: controller.businessLoading, business: business(props.slug), error: controller.businessError },
      categoryState: { loading: false, products: [] },
      categorySelected: controller.categorySelected,
      errors: controller.errors,
      openCategories: { values: [] },
      handleChangeCategory: () => {},
      handleChangeSearch: controller.calls.handleChangeSearch,
      getBusiness: controller.calls.getBusiness,
      getPageProducts: controller.calls.getPageProducts,
      setCategorySelected: controller.calls.setCategorySelected,
      setBusinessSlug: () => {}
    })
  }
})

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProjectState: () => [{ websiteProduct: websiteState.websiteProduct }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280, height: 800 }) }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: () => {} }]
}))
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div data-testid='modal'>{children}</div> : null),
  SearchBar: () => null,
  SideBar: () => null,
  ColumnAllowSettingPopover: () => null,
  LearnDropDown: () => null
}))
vi.mock('../../../Shared/LearnDropDown', () => ({ LearnDropDown: () => <div data-testid='learn' /> }))
// The editor's way out (J2 row 13): the test plays a product editor with unsaved edits, whose `requestLeave` holds the leave
const editorGuard = vi.hoisted(() => ({ dirty: false, pending: null, requestLeave: null }))
vi.mock('../../ProductDetails', () => ({
  ProductDetails: ({ productId, categoryId, product, leaveGuardRef }) => {
    if (leaveGuardRef) leaveGuardRef.current = { requestLeave: editorGuard.requestLeave }
    return <div data-testid='product-details' data-product={product?.id}>{`${categoryId}/${productId}`}</div>
  }
}))
vi.mock('../../BusinessProductsCategoyDetails', () => ({ BusinessProductsCategoyDetails: () => null }))
vi.mock('../../BusinessProductList', () => ({
  BusinessProductList: ({ viewMethod, isParentProductAdd, handleParentProductAdd, handleOpenProductDetails }) => (
    <div data-testid='product-list' data-view={viewMethod} data-adding={String(isParentProductAdd)}>
      <button type='button' onClick={() => handleParentProductAdd(true)}>list-add</button>
      <button type='button' onClick={() => handleOpenProductDetails({ id: 5, category_id: 11 })}>open-5</button>
      <button type='button' onClick={() => handleOpenProductDetails({ id: 6, category_id: 11 })}>open-6</button>
    </div>
  )
}))
vi.mock('../../CatalogCategories', () => ({
  CatalogCategories: ({ categorySelected, handleOpenCategoryDetails }) => (
    <div data-testid='catalog-categories' data-selected={categorySelected?.id ?? 'none'}>
      <button type='button' onClick={() => handleOpenCategoryDetails()}>tree-add-category</button>
    </div>
  )
}))
vi.mock('../../SingleBusinessCategoryEdit', () => ({
  SingleBusinessCategoryEdit: ({ viewMethod, onViewMethodChange, searchSlot, onOpenBatchImages }) => (
    <div data-testid='category-head' data-view={viewMethod}>
      {searchSlot}
      <button type='button' onClick={() => onViewMethodChange('spreedsheet')}>sheet-view</button>
      <button type='button' onClick={() => onOpenBatchImages()}>batch-images</button>
    </div>
  )
}))
vi.mock('../../BusinessSelectHeader', () => ({ BusinessSelectHeader: () => <div data-testid='selector' /> }))
vi.mock('../../BatchImageForm', () => ({ BatchImageForm: () => <div data-testid='batch-form' /> }))
vi.mock('../../BusinessDetails', () => ({ BusinessDetails: () => <div data-testid='business-details' /> }))
vi.mock('../../ImportersButton', () => ({ ImportersButton: () => null }))
vi.mock('../../ProductStartGuide', () => ({
  ProductStartGuide: ({ onImportMenu, onClose }) => (
    <div data-testid='product-start-guide'>
      <button type='button' onClick={onImportMenu}>guide-import-menu</button>
      <button type='button' onClick={onClose}>guide-close</button>
    </div>
  )
}))
vi.mock('../../../Connect/BusinessImporters', () => ({
  BusinessImporters: ({ open, business, onClose, onGoToProducts }) => (
    <div data-testid='business-importers' data-open={String(open)} data-store={business?.slug}>
      <button type='button' onClick={onClose}>importers-close</button>
      <button type='button' onClick={onGoToProducts}>importers-go-to-products</button>
    </div>
  )
}))

import { BusinessProductsListing } from '../index'

// redesign tanda AB (C-5): Refresh, Add category and Store website are items of the head's «More actions» menu
const chooseFromMore = async (user, name) => {
  screen.getByRole('button', { name: 'More actions' }).focus()
  await user.keyboard('{Enter}')
  await user.click(await screen.findByRole('menuitem', { name }))
}

const renderListing = (props, url) => renderWithProviders(
  <BusinessProductsListing onProductRedirect={() => {}} handleStoresRedirect={() => {}} {...props} />,
  { theme: themeJson, initialEntries: [url] }
)

beforeEach(() => {
  controller.categories = undefined
  controller.categorySelected = null
  controller.businessError = null
  controller.businessLoading = false
  controller.errors = null
  controller.calls = {
    handleChangeSearch: vi.fn(),
    getBusiness: vi.fn(),
    getPageProducts: vi.fn(),
    setCategorySelected: vi.fn()
  }
})

describe('BusinessProductsListing', () => {
  it.each([
    [
      { taxes: { loading: false, error: 'Failed to fetch', loaded: false }, fees: { loading: false, error: null, loaded: true } },
      'Could not load taxes. Please try again.'
    ],
    [
      { taxes: { loading: false, error: null, loaded: true }, fees: { loading: false, error: 'Failed to fetch', loaded: false } },
      'Could not load fees. Please try again.'
    ],
    [
      { taxes: { loading: false, error: 'Failed to fetch', loaded: false }, fees: { loading: false, error: 'Failed to fetch', loaded: false } },
      'Could not load taxes and fees. Please try again.'
    ]
  ])('offers a non-blocking retry with the complete message for each failed catalog combination', (catalogState, message) => {
    const retryCatalogs = vi.fn()
    renderListing({
      slug: 'tastewine',
      catalogState,
      retryCatalogs
    }, '/stores/products/tastewine')
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retryCatalogs).toHaveBeenCalledTimes(1)
    // non-blocking: the page head is still there (Store website lives in its «More actions» menu in beta)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
  })

  it('opens the product panel from a product link', async () => {
    renderListing(
      { slug: 'tastewine', categoryId: '11', productId: '221' },
      '/stores/products/tastewine?category=11&product=221'
    )

    expect(await screen.findByTestId('product-details')).toHaveTextContent('11/221')
  })

  it('closes the product panel when the user switches store', async () => {
    const { rerender } = renderListing(
      { slug: 'tastewine', categoryId: '11', productId: '221' },
      '/stores/products/tastewine?category=11&product=221'
    )
    expect(await screen.findByTestId('product-details')).toBeInTheDocument()

    rerender(<BusinessProductsListing onProductRedirect={() => {}} handleStoresRedirect={() => {}} slug='thetwirlylaundry' />)
    await waitFor(() => expect(screen.queryByTestId('product-details')).not.toBeInTheDocument())
  })

  it('opens no product panel without a product link', async () => {
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByTestId('product-details')).not.toBeInTheDocument()
  })

  it('opens the subscribed Marketplace v26 store URL instead of the legacy configured URL', async () => {
    const user = userEvent.setup()
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderListing({ slug: 'chick_fil_a' }, '/stores/products/chick_fil_a')

    await chooseFromMore(user, 'Store website')

    expect(openWindow).toHaveBeenCalledWith(
      'https://v26-22sept.orderingplus.com/store/chick_fil_a',
      '_blank',
      'noopener,noreferrer'
    )
  })
})

// redesign SP-FA: the page around the new tree, head and list
describe('BusinessProductsListing · page (SP-FA)', () => {
  it('draws the category tree of the catalog and the list of the category', () => {
    controller.categorySelected = { id: 11, name: 'Beer' }
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    expect(screen.getByTestId('catalog-categories')).toHaveAttribute('data-selected', '11')
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-view', 'list')
  })

  it('SP-03: with no ?category the first category is the one with the lowest rank, not the first of the array', () => {
    controller.categories = [
      { id: 12, name: 'Wine', rank: 3, products: [] },
      { id: 11, name: 'Beer', rank: 1, products: [] },
      { id: 13, name: 'Gin', rank: 2, products: [] }
    ]
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    expect(controller.calls.setCategorySelected).toHaveBeenCalledTimes(1)
    expect(controller.calls.setCategorySelected.mock.calls[0][0]).toMatchObject({ id: 11 })
  })

  it('keeps the category link: ?category selects that category and opens its panel, not the first one', () => {
    controller.categories = [
      { id: 11, name: 'Beer', rank: 1, products: [] },
      { id: 12, name: 'Wine', rank: 2, products: [] }
    ]
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine?category=12')

    expect(controller.calls.setCategorySelected).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }))
    expect(controller.calls.setCategorySelected).not.toHaveBeenCalledWith(expect.objectContaining({ id: 11 }))
  })

  it('moves the list bar into the head of the category: search, view and batch images', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    const head = screen.getByTestId('category-head')
    expect(within(head).getByRole('searchbox', { name: 'Search all products' })).toBeInTheDocument()
    expect(head).toHaveAttribute('data-view', 'list')

    await user.click(within(head).getByRole('button', { name: 'sheet-view' }))
    expect(screen.getByTestId('category-head')).toHaveAttribute('data-view', 'spreedsheet')
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-view', 'spreedsheet')

    expect(screen.queryByTestId('batch-form')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'batch-images' }))
    expect(await screen.findByTestId('batch-form')).toBeInTheDocument()
  })

  it('SP-10: Add product opens the form also on the spreadsheet view', async () => {
    const user = userEvent.setup()
    controller.categorySelected = { id: 11, name: 'Beer' }
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await user.click(screen.getByRole('button', { name: 'sheet-view' }))
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-adding', 'false')

    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-adding', 'true')
  })

  it('the button of the title opens the store selector and closes it, with the keyboard too', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    const title = within(screen.getByRole('heading', { level: 1 })).getByRole('button', { name: 'tastewine' })
    expect(title).toHaveAttribute('aria-haspopup', 'dialog')
    expect(title).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('selector')).not.toBeInTheDocument()

    title.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('selector')).toBeInTheDocument()
    expect(title).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(screen.queryByTestId('selector')).not.toBeInTheDocument()
    expect(title).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the selector by itself when there is no store, as before', () => {
    renderListing({ slug: undefined }, '/stores/products')

    expect(screen.getByTestId('selector')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select a business' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByTestId('catalog-categories')).not.toBeInTheDocument()
  })

  it('the store in the breadcrumb opens the store editor', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByText('All products')).toBeInTheDocument()
    await user.click(within(crumbs).getByRole('button', { name: 'tastewine' }))
    expect(await screen.findByTestId('business-details')).toBeInTheDocument()
  })

  it('SP-06: a store that fails to load says so, with Retry, and the first-product modal stays closed', async () => {
    const user = userEvent.setup()
    controller.categories = []
    controller.businessError = ['Network Error']
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load this store.")).toBeInTheDocument()
    expect(screen.queryByTestId('catalog-categories')).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-start-guide')).not.toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(controller.calls.getBusiness).toHaveBeenCalledTimes(1)
  })

  it('a store without categories still opens the first-product modal', async () => {
    controller.categories = []
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    expect(await screen.findByTestId('product-start-guide')).toBeInTheDocument()
  })

  it('SP-06: a list of products that fails to load says so, with Retry, in place of the list', async () => {
    const user = userEvent.setup()
    controller.errors = ['Network Error']
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load the products.")).toBeInTheDocument()
    expect(screen.queryByTestId('product-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('catalog-categories')).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(controller.calls.getPageProducts).toHaveBeenCalledWith(true, 1)
  })

  it('Refresh reloads the store', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await chooseFromMore(user, 'Refresh')
    expect(controller.calls.getBusiness).toHaveBeenCalledTimes(1)
  })

  it('Add category in the head and in the tree both open the category panel in add mode', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    // the panel is the legacy SideBar (mocked to null here): what the click changes is the product-add state, so check it does not throw
    await chooseFromMore(user, 'Add category')
    await user.click(screen.getByRole('button', { name: 'tree-add-category' }))
    expect(screen.getByTestId('catalog-categories')).toBeInTheDocument()
  })

  // main / the guide of an empty store offers «Import your menu», which mounts the importers over the catalog
  it('«Import your menu» in the guide closes the guide and mounts the importers with the store', async () => {
    const user = userEvent.setup()
    controller.categories = []
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    expect(screen.queryByTestId('business-importers')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'guide-import-menu' }))

    expect(screen.queryByTestId('product-start-guide')).not.toBeInTheDocument()
    const importers = screen.getByTestId('business-importers')
    expect(importers).toHaveAttribute('data-open', 'true')
    expect(importers).toHaveAttribute('data-store', 'tastewine')
  })

  it('Go to products from the importers closes them and reloads the store', async () => {
    const user = userEvent.setup()
    controller.categories = []
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await user.click(await screen.findByRole('button', { name: 'guide-import-menu' }))
    expect(controller.calls.getBusiness).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'importers-go-to-products' }))

    expect(screen.queryByTestId('business-importers')).not.toBeInTheDocument()
    expect(controller.calls.getBusiness).toHaveBeenCalledTimes(1)
  })

  it('closing the importers also reloads the store, so what was imported shows', async () => {
    const user = userEvent.setup()
    controller.categories = []
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await user.click(await screen.findByRole('button', { name: 'guide-import-menu' }))
    await user.click(screen.getByRole('button', { name: 'importers-close' }))

    expect(screen.queryByTestId('business-importers')).not.toBeInTheDocument()
    expect(controller.calls.getBusiness).toHaveBeenCalledTimes(1)
  })
})

const ui = (props) => <BusinessProductsListing onProductRedirect={() => {}} handleStoresRedirect={() => {}} slug='tastewine' {...props} />

// bugs E D25: the guide opened on every new object of the business (each getBusiness, each handleUpdateBusinessState)
// J2 row 13 (stores-products P-14, D-56 f): with the product editor open and unsaved edits, opening another product or «Add product»
// from the list asks the editor first (its `leaveGuardRef`, as the store list does with the store editor)
describe('BusinessProductsListing · the product editor is asked before the list takes it away', () => {
  beforeEach(() => {
    editorGuard.pending = null
    editorGuard.requestLeave = vi.fn((go) => { editorGuard.pending = go })
  })

  it('opening another product waits for the editor; it goes once the editor lets it', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'mcbonalds' }, '/stores/products?store=mcbonalds')
    await user.click(screen.getByRole('button', { name: 'open-5' }))
    expect(screen.getByTestId('product-details')).toHaveAttribute('data-product', '5')
    expect(editorGuard.requestLeave).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'open-6' }))
    expect(editorGuard.requestLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('product-details')).toHaveAttribute('data-product', '5')
    await act(async () => editorGuard.pending())
    expect(screen.getByTestId('product-details')).toHaveAttribute('data-product', '6')
  })

  it('the same product again does not ask', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'mcbonalds' }, '/stores/products?store=mcbonalds')
    await user.click(screen.getByRole('button', { name: 'open-5' }))
    await user.click(screen.getByRole('button', { name: 'open-5' }))
    expect(editorGuard.requestLeave).not.toHaveBeenCalled()
  })

  it('«Add product» from the list over an open editor asks first', async () => {
    const user = userEvent.setup()
    renderListing({ slug: 'mcbonalds' }, '/stores/products?store=mcbonalds')
    await user.click(screen.getByRole('button', { name: 'open-5' }))
    await user.click(screen.getByRole('button', { name: 'list-add' }))
    expect(editorGuard.requestLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-adding', 'false')
    await act(async () => editorGuard.pending())
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-adding', 'true')
  })
})

describe('BusinessProductsListing · start guide once per store (D25)', () => {
  it('closing the guide keeps it closed when the business is reloaded or updated', async () => {
    const user = userEvent.setup()
    controller.categories = []
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await user.click(await screen.findByRole('button', { name: 'guide-close' }))
    expect(screen.queryByTestId('product-start-guide')).not.toBeInTheDocument()

    // the controller hands the page a new business object (same store, still no categories)
    rerender(ui())
    rerender(ui())
    expect(screen.queryByTestId('product-start-guide')).not.toBeInTheDocument()
  })

  it('opens again in another store without categories', async () => {
    const user = userEvent.setup()
    controller.categories = []
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    await user.click(await screen.findByRole('button', { name: 'guide-close' }))
    rerender(ui({ slug: 'thetwirlylaundry' }))

    expect(await screen.findByTestId('product-start-guide')).toBeInTheDocument()
  })

  it('does not open it for a store with categories', () => {
    renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')
    expect(screen.queryByTestId('product-start-guide')).not.toBeInTheDocument()
  })
})

// bugs E SP-19 / D7: Refresh is `getBusiness`; the effect that chose the first category ran on every end of a load
describe('BusinessProductsListing · category kept on reload (SP-19)', () => {
  const twoCategories = () => [
    { id: 11, name: 'Beer', rank: 1, products: [] },
    { id: 12, name: 'Wine', rank: 2, products: [] }
  ]
  const reload = (rerender) => {
    controller.businessLoading = true
    rerender(ui())
    controller.businessLoading = false
    rerender(ui())
  }
  const chosen = () => controller.calls.setCategorySelected.mock.calls.map(([category]) => category?.id)

  it('keeps the category the person chose after the store reloads', () => {
    controller.categories = twoCategories()
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')
    expect(chosen()).toEqual([11])

    controller.categorySelected = { id: 12, name: 'Wine' }
    reload(rerender)

    // nothing chose another category: the one in the controller stays (and the controller reloads its products)
    expect(chosen()).toEqual([11])
  })

  it('keeps «All products» after the store reloads, and reloads its products', () => {
    controller.categories = twoCategories()
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')
    expect(chosen()).toEqual([11])

    // the person went to «All products»: no category
    controller.categorySelected = null
    reload(rerender)

    expect(chosen()).toEqual([11])
    expect(controller.calls.getPageProducts).toHaveBeenCalledWith(true, 1)
  })

  it('goes to the first category when the chosen one is gone after the reload', () => {
    controller.categories = twoCategories()
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    controller.categorySelected = { id: 12, name: 'Wine' }
    controller.categories = [{ id: 11, name: 'Beer', rank: 1, products: [] }, { id: 13, name: 'Gin', rank: 2, products: [] }]
    reload(rerender)

    expect(chosen().at(-1)).toBe(11)
  })

  it('finds the chosen category when it is a subcategory', () => {
    controller.categories = [
      { id: 11, name: 'Beer', rank: 1, products: [], subcategories: [{ id: 21, name: 'Craft', products: [] }] }
    ]
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    controller.categorySelected = { id: 21, name: 'Craft' }
    reload(rerender)

    expect(chosen()).toEqual([11])
  })

  it('a store that had no categories picks the first one when the import gives it some', () => {
    controller.categories = []
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')

    controller.categories = twoCategories()
    reload(rerender)

    expect(chosen().at(-1)).toBe(11)
  })

  it('another store starts on its own first category', () => {
    controller.categories = twoCategories()
    const { rerender } = renderListing({ slug: 'tastewine' }, '/stores/products/tastewine')
    controller.categorySelected = { id: 12, name: 'Wine' }

    controller.businessLoading = true
    rerender(ui({ slug: 'thetwirlylaundry' }))
    controller.businessLoading = false
    controller.categorySelected = null
    rerender(ui({ slug: 'thetwirlylaundry' }))

    expect(chosen().at(-1)).toBe(11)
  })
})
