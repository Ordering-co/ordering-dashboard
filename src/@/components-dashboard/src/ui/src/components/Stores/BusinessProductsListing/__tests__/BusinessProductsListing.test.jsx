import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const websiteState = vi.hoisted(() => ({
  project: '22sept',
  websiteProduct: 'web_marketplace_26',
  legacySiteUrl: 'https://22sept.orderingplus.com',
  sites: [],
  loading: false
}))

const business = (slug) => ({
  id: slug === 'tastewine' ? 3 : 7,
  slug,
  name: slug,
  categories: [{ id: 11, name: 'Beer', products: [] }]
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
      businessState: { loading: false, business: business(props.slug), error: null },
      categoryState: { loading: false, products: [] },
      categorySelected: null,
      openCategories: { values: [] },
      handleChangeCategory: () => {},
      handleChangeSearch: () => {},
      setCategorySelected: () => {},
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
  Modal: () => null,
  SearchBar: () => null,
  SideBar: () => null,
  ColumnAllowSettingPopover: () => null,
  LearnDropDown: () => null
}))
vi.mock('../../ProductDetails', () => ({
  ProductDetails: ({ productId, categoryId }) => <div data-testid='product-details'>{`${categoryId}/${productId}`}</div>
}))
vi.mock('../../BusinessProductsCategoyDetails', () => ({ BusinessProductsCategoyDetails: () => null }))
vi.mock('../../BusinessProductList', () => ({ BusinessProductList: () => null }))
vi.mock('../../BusinessProductsCategories', () => ({ BusinessProductsCategories: () => null }))
vi.mock('../../SingleBusinessCategoryEdit', () => ({ SingleBusinessCategoryEdit: () => null }))
vi.mock('../../BusinessSelectHeader', () => ({ BusinessSelectHeader: () => null }))
vi.mock('../../BatchImageForm', () => ({ BatchImageForm: () => null }))
vi.mock('../../BusinessDetails', () => ({ BusinessDetails: () => null }))
vi.mock('../../ImportersButton', () => ({ ImportersButton: () => null }))
vi.mock('../../AddBusinessForm', () => ({ AddBusinessForm: () => null }))
vi.mock('../../ProductStep', () => ({ ProductStep: () => null }))
vi.mock('../../BusinessAddStore', () => ({ BusinessAddStore: () => null }))

import { BusinessProductsListing } from '../index'

const renderListing = (props, url) => renderWithProviders(
  <BusinessProductsListing onProductRedirect={() => {}} handleStoresRedirect={() => {}} {...props} />,
  { theme: themeJson, initialEntries: [url] }
)

describe('BusinessProductsListing', () => {
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

  it('opens the subscribed Marketplace v26 store URL instead of the legacy configured URL', () => {
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderListing({ slug: 'chick_fil_a' }, '/stores/products/chick_fil_a')

    fireEvent.click(screen.getByRole('button', { name: 'Store website' }))

    expect(openWindow).toHaveBeenCalledWith(
      'https://v26-22sept.orderingplus.com/store/chick_fil_a',
      '_blank'
    )
  })
})
