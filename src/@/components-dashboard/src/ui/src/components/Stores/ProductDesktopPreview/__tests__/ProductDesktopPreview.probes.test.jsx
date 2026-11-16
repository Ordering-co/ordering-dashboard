/* eslint-disable import/first */
// redesign SP-F2 (D2) — documentary probes for ProductDesktopPreview (decision 8).
// The component is NOT modified by the catalog redesign; this file pins what it
// shows today and must pass unchanged after the redesign.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}` }]
}))

import { ProductDesktopPreview } from '..'

const theme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    gray: '#cccccc',
    secundaryContrast: '#333333',
    primaryContrast: '#ffffff',
    secundary: '#e0e0e0',
    grayTextColor: '#777777'
  },
  images: {
    general: { mobileCase: 'case.png', mobileMask: 'mask.png' },
    icons: { leftArrow: 'left.svg', rightArrow: 'right.svg' },
    dummies: { product: 'dummy.png' }
  }
}

const product = {
  id: 7,
  name: 'Smash burger',
  price: 8,
  offer_price: 10,
  description: 'Double patty with house sauce',
  sku: 'BRG-7',
  images: 'https://example.test/burger.jpg',
  gallery: [{ id: 1, file: 'https://example.test/burger-2.jpg' }],
  ingredients: [
    { id: 1, name: 'Lettuce' },
    { id: 2, name: 'Tomato' }
  ],
  extras: [
    {
      id: 20,
      options: [
        {
          id: 200,
          name: 'Size',
          min: 1,
          max: 1,
          suboptions: [
            { id: 2001, name: 'Regular', price: 0, enabled: true },
            { id: 2002, name: 'Large', price: 2, enabled: true }
          ]
        },
        {
          id: 201,
          name: 'Toppings',
          min: 0,
          max: 2,
          suboptions: [
            { id: 2011, name: 'Bacon', price: 1.5, enabled: true },
            { id: 2012, name: 'Egg', price: 1, enabled: true },
            { id: 2013, name: 'Hidden topping', price: 3, enabled: false }
          ]
        }
      ]
    }
  ]
}

const productCart = {
  ingredients: { 'id:1': { selected: true } },
  options: {},
  total: 9.5,
  quantity: 1,
  comment: null
}

const mount = (isMobileView) => renderWithProviders(
  <ProductDesktopPreview
    isMobileView={isMobileView}
    product={product}
    productCart={productCart}
    showProductOption={() => true}
  />,
  { theme }
)

describe('ProductDesktopPreview probes', () => {
  describe.each([
    ['desktop', false],
    ['mobile', true]
  ])('%s view', (_name, isMobileView) => {
    it('shows the product header texts', () => {
      mount(isMobileView)

      expect(screen.getByRole('heading', { level: 1, name: 'Smash burger' })).toBeInTheDocument()
      expect(screen.getByText('Double patty with house sauce')).toBeInTheDocument()
      // price wrapper: cart total, then the offer price
      expect(screen.getAllByText('$9.50').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('$10.00')).toHaveClass('price-discount')
      expect(screen.getByRole('heading', { level: 2, name: 'Sku' })).toBeInTheDocument()
      expect(screen.getByText('BRG-7')).toBeInTheDocument()
    })

    it('shows the gallery as a main slider plus a thumbnail slider', () => {
      const { container } = mount(isMobileView)

      // product image + one gallery image, in both sliders
      const sources = Array.from(container.querySelectorAll('.swiper-slide img')).map(img => img.getAttribute('src'))
      expect(sources).toEqual([
        'https://example.test/burger.jpg',
        'https://example.test/burger-2.jpg',
        'https://example.test/burger.jpg',
        'https://example.test/burger-2.jpg'
      ])
    })

    it('shows the All / Ingredients / Extra tabs and the section titles', () => {
      mount(isMobileView)

      expect(screen.getByText('All')).toBeInTheDocument()
      // tab and section title share the text
      expect(screen.getAllByText('ingredients').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Extra')).toBeInTheDocument()
      expect(screen.getByText('Ingredients')).toBeInTheDocument()
      expect(screen.getByText('COMMENTS')).toBeInTheDocument()
    })

    it('shows every ingredient, checked only when the cart selects it', () => {
      const { container } = mount(isMobileView)

      expect(screen.getByText('Lettuce')).toBeInTheDocument()
      expect(screen.getByText('Tomato')).toBeInTheDocument()
      const wrapper = screen.getByText('Lettuce').closest('div').parentElement
      const boxes = wrapper.querySelectorAll('input[type="checkbox"]')
      expect(boxes).toHaveLength(2)
      expect(boxes[0].checked).toBe(true)
      expect(boxes[1].checked).toBe(false)
      expect(container.querySelectorAll('#ingredients input[type="checkbox"]')).toHaveLength(2)
    })

    it('shows 2 options and only the 4 enabled suboptions, with their prices and limits', () => {
      const { container } = mount(isMobileView)
      const extra = container.querySelector('#extra')

      expect(within(extra).getByText('Size')).toBeInTheDocument()
      expect(within(extra).getByText('Toppings')).toBeInTheDocument()
      // min 1 / max 1 reads «Required»; min 0 / max 2 reads «(Max: 2)»
      expect(within(extra).getByText('Required')).toBeInTheDocument()
      expect(within(extra).getByText('(Max: 2)')).toBeInTheDocument()

      for (const name of ['Regular', 'Large', 'Bacon', 'Egg']) {
        expect(within(extra).getByText(name)).toBeInTheDocument()
      }
      expect(within(extra).queryByText('Hidden topping')).not.toBeInTheDocument()

      // 4 enabled suboptions: radio-styled controls for the required option, checkboxes for the multi one
      // (RadioButton is a checkbox-typed input with the od-radio-button class)
      expect(extra.querySelectorAll('input.od-radio-button')).toHaveLength(2)
      expect(extra.querySelectorAll('input.od-checkbox')).toHaveLength(2)
      for (const price of ['+ $0.00', '+ $2.00', '+ $1.50', '+ $1.00']) {
        expect(within(extra).getByText(price)).toBeInTheDocument()
      }
    })

    it('shows the comment box and the add-to-cart footer', () => {
      mount(isMobileView)

      expect(screen.getByPlaceholderText('Special comment')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
      expect(screen.queryByText('Sold out')).not.toBeInTheDocument()
      // quantity stepper reads 1
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('structure that differs between views', () => {
    it('desktop draws the browser frame (3 dots) and the close icon; mobile does not', () => {
      const desktop = mount(false)
      const desktopMask = desktop.container.querySelector('#product_mobile_view')
      expect(desktop.container.firstElementChild.firstElementChild.children).toHaveLength(3)
      expect(desktopMask.firstElementChild.querySelector('svg')).not.toBeNull()
      desktop.unmount()

      const mobile = mount(true)
      const mobileMask = mobile.container.querySelector('#product_mobile_view')
      // the phone view goes straight to the image slider
      expect(mobileMask.firstElementChild.querySelector('.swiper')).not.toBeNull()
      expect(mobileMask.firstElementChild.querySelector('svg')).toBeNull()
    })

    it('keeps the same order: image, title block, divider, tabs and sections, footer', () => {
      const { container } = mount(false)
      const mask = container.querySelector('#product_mobile_view')
      const info = mask.lastElementChild

      expect(info.querySelector('h1')).toHaveTextContent('Smash burger')
      const order = ['h1', '#all', '#ingredients', '#extra', 'textarea', '.add']
      const positions = order.map(selector => {
        const node = info.querySelector(selector)
        expect(node, selector).not.toBeNull()
        return Array.from(info.querySelectorAll('*')).indexOf(node)
      })
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    })
  })
})
