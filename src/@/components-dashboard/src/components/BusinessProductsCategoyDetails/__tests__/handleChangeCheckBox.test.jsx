/* eslint-disable import/first */
// bugs E D18: `handleChangeCheckBox` of the category editor serves two switches. The Enabled switch calls it with
// `{ enabled }` and must change only `enabled`; the "nest under the selected category" checkbox calls it with `{ enabledParent }`
// and is the only one that moves `parent_category_id`.
import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ loading: false, token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{}]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessProductsCategoyDetails } from '../index'

const NESTED = { id: 5, name: 'Fries', enabled: true, parent_category_id: 9 }
const SELECTED = { id: 12, name: 'Sides' }

let ui
const draw = (category) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  render(
    <BusinessProductsCategoyDetails
      UIComponent={UI}
      category={category}
      categoryId={category.id}
      categorySelected={SELECTED}
      businessState={{ business: { id: 3, categories: [] } }}
      setCategorySelected={vi.fn()}
    />
  )
}

describe('BusinessProductsCategoyDetails controller · handleChangeCheckBox', () => {
  it('toggling Enabled changes only `enabled` and leaves the parent of a nested category alone', () => {
    draw(NESTED)

    act(() => { ui.handleChangeCheckBox({ enabled: false }) })

    expect(ui.formState.changes.enabled).toBe(false)
    expect(ui.formState.changes.parent_category_id).toBe(9)
  })

  it('toggling Enabled does not add a parent change to a category that never had one', () => {
    draw({ id: 6, name: 'Drinks', enabled: false })

    act(() => { ui.handleChangeCheckBox({ enabled: true }) })

    expect(ui.formState.changes.enabled).toBe(true)
    expect(ui.formState.changes).not.toHaveProperty('parent_category_id')
  })

  it('the nest checkbox on sets the parent to the selected category and checking it off clears it', () => {
    draw(NESTED)

    act(() => { ui.handleChangeCheckBox({ enabledParent: true }) })
    expect(ui.formState.changes.parent_category_id).toBe(12)
    expect(ui.formState.changes.enabled).toBe(true)

    act(() => { ui.handleChangeCheckBox({ enabledParent: false }) })
    expect(ui.formState.changes.parent_category_id).toBeNull()
    expect(ui.formState.changes.enabled).toBe(true)
  })
})
