/* eslint-disable import/first */
// redesign SP-F2 (D2): ProductMainDetails takes a controlled `tab` and an opt-in `hideTabs`.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const spy = vi.hoisted(() => {
  const state = { calls: {}, addQueryToUrl: vi.fn() }
  state.stub = (name) => async () => {
    const { createElement } = await import('react')
    return {
      [name]: (props) => {
        state.calls[name] = [...(state.calls[name] || []), props]
        return createElement('div', { 'data-testid': name })
      }
    }
  }
  return state
})

vi.mock('../../ProductDetatilsInformation', spy.stub('ProductDetatilsInformation'))
vi.mock('../../ProductDetailsAdvanced', spy.stub('ProductDetailsAdvanced'))
vi.mock('../../ProductTagsList', spy.stub('ProductTagsList'))
vi.mock('../../ProductDetailsCategories', spy.stub('ProductDetailsCategories'))
vi.mock('../../SeoOptions', spy.stub('SeoOptions'))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  DragScroll: ({ children }) => <div>{children}</div>
}))

vi.mock('../../../../utils', () => ({
  addQueryToUrl: (...args) => spy.addQueryToUrl(...args)
}))

import { ProductMainDetails } from '..'

const lastProps = (name) => spy.calls[name]?.at(-1)

const makeProps = (extra = {}) => ({
  product: { id: 5, tags: [{ id: 1 }] },
  business: { id: 3 },
  formState: { changes: {} },
  productState: { product: { id: 5 } },
  handlechangeImage: vi.fn(),
  handleChangeInput: vi.fn(),
  handleChangeFormState: vi.fn(),
  handleChangeRibbon: vi.fn(),
  handleUpdateClick: vi.fn(),
  handleSuccessUpdate: vi.fn(),
  isExtendExtraOpen: false,
  setIsExtendExtraOpen: vi.fn(),
  setFormTaxState: vi.fn(),
  formTaxState: { loading: false },
  taxes: [{ id: 1 }],
  setTaxes: vi.fn(),
  fees: [{ id: 2 }],
  setFees: vi.fn(),
  cleanFormState: vi.fn(),
  changeCategoriesPositionById: vi.fn(),
  getPageProducts: vi.fn(),
  handleCloseExtraOpen: vi.fn(),
  ...extra
})

const mount = (props, search = '') => renderWithProviders(
  <ProductMainDetails {...props} />,
  { initialEntries: [`/stores/products${search}`] }
)

describe('ProductMainDetails', () => {
  beforeEach(() => {
    spy.calls = {}
    spy.addQueryToUrl.mockClear()
  })

  describe('without `tab` (as before)', () => {
    it('shows the heading and a bar with the five tabs, starting on Information', () => {
      mount(makeProps())

      expect(screen.getByRole('heading', { level: 1, name: 'Product details' })).toBeInTheDocument()
      const names = screen.getAllByRole('button').map(button => button.textContent)
      expect(names).toEqual(['Information', 'Advanced', 'Labels', 'Categories', 'SEO options'])
      expect(screen.getByTestId('ProductDetatilsInformation')).toBeInTheDocument()
    })

    it('reads ?tab= when it mounts and does not write it', () => {
      mount(makeProps(), '?tab=advanced')

      expect(screen.getByTestId('ProductDetailsAdvanced')).toBeInTheDocument()
      expect(screen.queryByTestId('ProductDetatilsInformation')).not.toBeInTheDocument()
      expect(spy.addQueryToUrl).not.toHaveBeenCalled()
    })

    it('writes ?tab= and collapses the extended panel when a tab is clicked', () => {
      const props = makeProps()
      mount(props)
      props.setIsExtendExtraOpen.mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Labels' }))

      expect(spy.addQueryToUrl).toHaveBeenCalledWith({ tab: 'labels' })
      expect(props.setIsExtendExtraOpen).toHaveBeenCalledWith(false)
      expect(screen.getByTestId('ProductTagsList')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Labels' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('with `tab` (controlled)', () => {
    it('paints that tab and neither reads nor writes ?tab= when it mounts', () => {
      mount(makeProps({ tab: 'categories' }), '?tab=labels')

      expect(screen.getByTestId('ProductDetailsCategories')).toBeInTheDocument()
      expect(screen.queryByTestId('ProductTagsList')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Categories' })).toHaveAttribute('aria-pressed', 'true')
      expect(spy.addQueryToUrl).not.toHaveBeenCalled()
    })

    it('follows the prop when it changes, without remounting the container', () => {
      const props = makeProps({ tab: 'information' })
      const view = mount(props)
      const heading = screen.getByRole('heading', { level: 1 })

      view.rerender(<ProductMainDetails {...props} tab='seo_options' />)

      expect(screen.getByTestId('SeoOptions')).toBeInTheDocument()
      expect(screen.queryByTestId('ProductDetatilsInformation')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toBe(heading)
      expect(spy.addQueryToUrl).not.toHaveBeenCalled()
    })

    it('collapses the extended panel when the controlled tab changes', () => {
      const props = makeProps({ tab: 'information' })
      const view = mount(props)
      props.setIsExtendExtraOpen.mockClear()

      view.rerender(<ProductMainDetails {...props} tab='labels' />)

      expect(props.setIsExtendExtraOpen).toHaveBeenCalledWith(false)
    })

    it.each([
      'information', 'advanced', 'labels', 'categories', 'seo_options'
    ])('paints only the %s branch', (tab) => {
      mount(makeProps({ tab }))

      const ids = {
        information: 'ProductDetatilsInformation',
        advanced: 'ProductDetailsAdvanced',
        labels: 'ProductTagsList',
        categories: 'ProductDetailsCategories',
        seo_options: 'SeoOptions'
      }
      for (const [key, id] of Object.entries(ids)) {
        if (key === tab) expect(screen.getByTestId(id)).toBeInTheDocument()
        else expect(screen.queryByTestId(id)).not.toBeInTheDocument()
      }
    })
  })

  describe('with `hideTabs`', () => {
    it('paints neither the tab bar nor the heading, and still paints the tab', () => {
      mount(makeProps({ tab: 'advanced', hideTabs: true }))

      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByTestId('ProductDetailsAdvanced')).toBeInTheDocument()
    })

    it('is independent of `tab`: uncontrolled it still reads ?tab=', () => {
      mount(makeProps({ hideTabs: true }), '?tab=labels')

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByTestId('ProductTagsList')).toBeInTheDocument()
    })
  })

  describe('the five branches keep the props they always had', () => {
    it('Information', () => {
      const props = makeProps({ tab: 'information' })
      mount(props)

      expect(lastProps('ProductDetatilsInformation')).toMatchObject({
        product: props.product,
        business: props.business,
        formState: props.formState,
        handlechangeImage: props.handlechangeImage,
        handleChangeRibbon: props.handleChangeRibbon,
        handleChangeInput: props.handleChangeInput,
        handleChangeFormState: props.handleChangeFormState,
        handleButtonUpdateClick: props.handleUpdateClick
      })
    })

    it('Advanced', () => {
      const props = makeProps({ tab: 'advanced' })
      mount(props)

      expect(lastProps('ProductDetailsAdvanced')).toMatchObject({
        product: props.product,
        business: props.business,
        handleSuccessUpdate: props.handleSuccessUpdate,
        setFormTaxState: props.setFormTaxState,
        formTaxState: props.formTaxState,
        taxes: props.taxes,
        setTaxes: props.setTaxes,
        fees: props.fees,
        setFees: props.setFees
      })
    })

    it('Labels', () => {
      const props = makeProps({ tab: 'labels' })
      mount(props)

      expect(lastProps('ProductTagsList')).toMatchObject({
        tags: props.product.tags,
        businessId: 3,
        product: props.product,
        setIsExtendExtraOpen: props.setIsExtendExtraOpen,
        handleSuccessProductUpdate: props.handleSuccessUpdate
      })
    })

    it('Categories', () => {
      const props = makeProps({ tab: 'categories' })
      mount(props)

      expect(lastProps('ProductDetailsCategories')).toMatchObject({
        product: props.product,
        business: props.business,
        handleUpdateClick: props.handleUpdateClick,
        changeCategoriesPositionById: props.changeCategoriesPositionById,
        getPageProducts: props.getPageProducts,
        productState: props.productState,
        handleCloseExtraOpen: props.handleCloseExtraOpen
      })
    })

    it('SEO options', () => {
      const props = makeProps({ tab: 'seo_options' })
      mount(props)

      expect(lastProps('SeoOptions')).toMatchObject({
        data: props.product,
        formState: props.formState,
        setFormState: props.handleChangeFormState,
        handleUpdateClick: props.handleUpdateClick,
        handlechangeImageProductCategory: props.handlechangeImage,
        handleProductCategoryChangeInput: props.handleChangeInput,
        isProductSeo: true,
        cleanFormState: props.cleanFormState
      })
    })
  })
})
