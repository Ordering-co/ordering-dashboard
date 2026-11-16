/* eslint-disable import/first */
// bugs E: Product details > Information.
// renaming a saved product must not rewrite its slug (public / SEO links); a product with no id and no slug still gets one.
// Quantity: an emptied field sends `null` (what the shared menu editor sends for "no quantity"), never NaN.
// X-3: the three switches (Regular Price, Inventory, Ribbon) are named by the visible text beside them.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url, parsePrice: (value) => `$${value}` }],
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children }) => <div>{children}</div>
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: () => null,
  ImageCrop: () => null,
  ColorPicker: () => null
}))

import { ProductDetatilsInformation } from '../index'

const SAVED = { id: 7, name: 'Cheese Burger', slug: 'cheese_burger', price: 10, inventoried: true, quantity: 4 }

const draw = ({ product = SAVED, changes = {} } = {}) => {
  const handlers = {
    handleChangeInput: vi.fn(),
    handleChangeFormState: vi.fn(),
    handleChangeRibbon: vi.fn(),
    handlechangeImage: vi.fn(),
    handleButtonUpdateClick: vi.fn()
  }
  const make = (nextChanges) => (
    <ProductDetatilsInformation
      product={product}
      business={{ id: 3 }}
      formState={{ loading: false, changes: nextChanges, result: { error: false } }}
      {...handlers}
    />
  )
  const view = renderWithProviders(make(changes))
  return { ...handlers, rerenderWith: (nextChanges) => view.rerender(make(nextChanges)) }
}

const slugCalls = (handleChangeInput) =>
  handleChangeInput.mock.calls.filter(([event]) => event?.target?.name === 'slug')

describe('Information form · slug', () => {
  it('renaming a saved product leaves its slug alone', () => {
    const { handleChangeInput, rerenderWith } = draw()

    rerenderWith({ name: 'Cheese Burger XL' })

    expect(slugCalls(handleChangeInput)).toHaveLength(0)
  })

  it('a pending rename on first paint of a saved product does not touch the slug either', () => {
    const { handleChangeInput } = draw({ changes: { name: 'Another name' } })

    expect(slugCalls(handleChangeInput)).toHaveLength(0)
  })

  it('a product that has neither id nor slug (a new one) still gets its slug from the name', () => {
    const { handleChangeInput, rerenderWith } = draw({ product: { name: '' } })

    rerenderWith({ name: 'Cheese Burger XL' })

    expect(slugCalls(handleChangeInput)).toHaveLength(1)
    expect(slugCalls(handleChangeInput)[0][0].target.value).toBe('cheese_burger_xl')
  })
})

describe('Information form · quantity', () => {
  it('sends the typed whole number', () => {
    const { handleChangeFormState } = draw()

    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '12' } })

    expect(handleChangeFormState).toHaveBeenCalledWith({ quantity: 12 })
  })

  it('an emptied field sends null, never NaN', () => {
    const { handleChangeFormState } = draw()

    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '' } })

    expect(handleChangeFormState).toHaveBeenCalledTimes(1)
    const [changes] = handleChangeFormState.mock.calls[0]
    expect(Number.isNaN(changes.quantity)).toBe(false)
    expect(changes).toEqual({ quantity: null })
  })
})

describe('Information form · switches', () => {
  it('names the Regular Price, Inventory and Ribbon switches from the text beside them', () => {
    draw()

    for (const name of ['Regular Price', 'Inventory', 'Ribbon']) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    }
  })

  it('keeps each switch working after being named', () => {
    const { handleChangeFormState } = draw()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Inventory' }))

    expect(handleChangeFormState).toHaveBeenCalledWith({ inventoried: false })
  })
})
