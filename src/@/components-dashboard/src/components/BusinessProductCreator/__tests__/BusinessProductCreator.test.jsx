/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// bugs E D17b: the "All" and "featured" views have no real category to add a product to
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  categories: vi.fn(),
  save: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ loading: false }] }))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: () => ({ categories: (id) => { mocks.categories(id); return { products: () => ({ save: mocks.save }) } } })
  }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { BusinessProductCreator } from '..'

const business = { id: 7, categories: [{ id: 41, products: [] }, { id: 42, products: [] }] }

const create = async (categorySelected) => {
  const ui = { current: null }
  const UIComponent = (props) => {
    ui.current = props
    return null
  }
  render(
    <BusinessProductCreator
      UIComponent={UIComponent}
      business={business}
      categorySelected={categorySelected}
      categoryState={{ products: [] }}
    />
  )
  await act(async () => { await ui.current.handleUpdateClick() })
}

describe('BusinessProductCreator handleUpdateClick (D17b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 900 } } })
  })

  it('adds to the first category of the store when the "All" view (id null) is selected', async () => {
    await create({ id: null, name: 'All' })
    expect(mocks.categories).toHaveBeenCalledWith(41)
  })

  it('adds to the first category of the store when the featured view is selected', async () => {
    await create({ id: 'featured', name: 'Featured' })
    expect(mocks.categories).toHaveBeenCalledWith(41)
  })

  it('keeps adding to the selected category when there is one', async () => {
    await create({ id: 42, name: 'Drinks' })
    expect(mocks.categories).toHaveBeenCalledWith(42)
  })
})
