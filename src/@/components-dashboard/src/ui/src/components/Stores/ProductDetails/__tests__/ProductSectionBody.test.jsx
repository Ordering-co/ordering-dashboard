/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// redesign SP-F1 (D1): each key paints its branch with the props ProductDetailsUI gave it in main (S/ProductDetails/index.js:148-248).
const spy = vi.hoisted(() => {
  const state = { calls: {} }
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

vi.mock('../../ProductMainDetails', spy.stub('ProductMainDetails'))
vi.mock('../../ServiceDetail', spy.stub('ServiceDetail'))
vi.mock('../../BusinessServiceProfessionals', spy.stub('BusinessServiceProfessionals'))
vi.mock('../../ProductIngredient', spy.stub('ProductIngredient'))
vi.mock('../../ProductExtras', spy.stub('ProductExtras'))
vi.mock('../../ProductGallery', spy.stub('ProductGallery'))
vi.mock('../../ProductVideos', spy.stub('ProductVideos'))
vi.mock('../../ProductMetaFields', spy.stub('ProductMetaFields'))
vi.mock('../../../Shared', () => spy.stub('Personalization')().then(module => module))

import { ProductSectionBody } from '../ProductSectionBody'

const last = (name) => spy.calls[name]?.at(-1)

const product = { id: 5, category_id: 9, name: 'Burger' }

const makeProps = (extra = {}) => ({
  business: { id: 3 },
  productState: { loading: false, product, error: null },
  formState: { changes: {} },
  handlechangeImage: vi.fn(),
  handleChangeFormState: vi.fn(),
  handleChangeRibbon: vi.fn(),
  handleChangeInput: vi.fn(),
  handleUpdateClick: vi.fn(),
  isExtendExtraOpen: false,
  setIsExtendExtraOpen: vi.fn(),
  handleSuccessUpdate: vi.fn(),
  setFormTaxState: vi.fn(),
  formTaxState: { loading: false },
  taxes: [{ id: 1 }],
  setTaxes: vi.fn(),
  fees: [{ id: 2 }],
  setFees: vi.fn(),
  cleanFormState: vi.fn(),
  changeCategoriesPositionById: vi.fn(),
  getPageProducts: vi.fn(),
  handleUpdateBusinessState: vi.fn(),
  handleCloseExtraOpen: vi.fn(),
  ...extra
})

describe('ProductSectionBody', () => {
  beforeEach(() => { spy.calls = {} })

  it('product_details: ProductMainDetails with the tab it is told, hidden tabs and the props of main', () => {
    const props = makeProps()
    render(<ProductSectionBody section='product_details' tab='advanced' {...props} />)
    const main = last('ProductMainDetails')
    expect(main.tab).toBe('advanced')
    expect(main.hideTabs).toBe(true)
    expect(main.product).toBe(product)
    expect(main.productState).toBe(props.productState)
    expect(main.business).toBe(props.business)
    for (const key of [
      'formState', 'handlechangeImage', 'handleChangeFormState', 'handleChangeRibbon', 'handleChangeInput', 'handleUpdateClick',
      'isExtendExtraOpen', 'setIsExtendExtraOpen', 'handleSuccessUpdate', 'setFormTaxState', 'formTaxState', 'taxes', 'setTaxes',
      'fees', 'setFees', 'cleanFormState', 'changeCategoriesPositionById', 'getPageProducts', 'handleCloseExtraOpen'
    ]) {
      expect(main[key], key).toBe(props[key])
    }
  })

  it('service_details: ServiceDetail with the props of main', () => {
    const props = makeProps()
    render(<ProductSectionBody section='service_details' {...props} />)
    const service = last('ServiceDetail')
    expect(service.product).toBe(product)
    for (const key of [
      'formState', 'handlechangeImage', 'handleChangeFormState', 'handleChangeRibbon', 'handleChangeInput', 'handleUpdateClick',
      'isExtendExtraOpen', 'setIsExtendExtraOpen', 'business', 'handleSuccessUpdate', 'setFormTaxState', 'formTaxState', 'taxes',
      'setTaxes', 'fees', 'setFees'
    ]) {
      expect(service[key], key).toBe(props[key])
    }
  })

  it('professionals: BusinessServiceProfessionals', () => {
    const props = makeProps()
    render(<ProductSectionBody section='professionals' {...props} />)
    const professionals = last('BusinessServiceProfessionals')
    expect(professionals.product).toBe(product)
    expect(professionals.formState).toBe(props.formState)
    expect(professionals.isExtendExtraOpen).toBe(false)
    expect(professionals.setIsExtendExtraOpen).toBe(props.setIsExtendExtraOpen)
    expect(professionals.handleUpdateClick).toBe(props.handleUpdateClick)
  })

  it('ingredients: ProductIngredient', () => {
    const props = makeProps()
    render(<ProductSectionBody section='ingredients' {...props} />)
    expect(last('ProductIngredient')).toMatchObject({
      business: props.business,
      product,
      setIsExtendExtraOpen: props.setIsExtendExtraOpen,
      handleSuccessUpdate: props.handleSuccessUpdate
    })
  })

  it('product_options: ProductExtras', () => {
    const props = makeProps()
    render(<ProductSectionBody section='product_options' {...props} />)
    expect(last('ProductExtras')).toMatchObject({
      business: props.business,
      product,
      setIsExtendExtraOpen: props.setIsExtendExtraOpen,
      handleSuccessUpdate: props.handleSuccessUpdate,
      handleUpdateBusinessState: props.handleUpdateBusinessState
    })
  })

  it('product_images and product_video: the gallery and the videos, with the category of the product', () => {
    const props = makeProps()
    const { unmount } = render(<ProductSectionBody section='product_images' {...props} />)
    expect(last('ProductGallery')).toMatchObject({ business: props.business, categoryId: 9, product, handleSuccessUpdate: props.handleSuccessUpdate })
    unmount()
    render(<ProductSectionBody section='product_video' {...props} />)
    expect(last('ProductVideos')).toMatchObject({ business: props.business, categoryId: 9, product, handleSuccessUpdate: props.handleSuccessUpdate })
  })

  it('custom_fields (from the ⋯ menu or the address): ProductMetaFields', () => {
    render(<ProductSectionBody section='custom_fields' {...makeProps()} />)
    expect(last('ProductMetaFields')).toMatchObject({ businessId: 3, categoryId: 9, productId: 5 })
  })

  it('personalization (by address only): Personalization with its title', () => {
    render(<ProductSectionBody section='personalization' {...makeProps()} />)
    expect(last('Personalization')).toMatchObject({ isShowTitle: true })
  })

  it('an unknown key paints nothing', () => {
    const { container } = render(<ProductSectionBody section='nope' {...makeProps()} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('ProductMainDetails')).toBeNull()
  })
})
