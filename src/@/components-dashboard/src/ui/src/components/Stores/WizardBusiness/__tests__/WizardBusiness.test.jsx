import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach, describe } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { WizardBusiness } from '../index'

const received = vi.hoisted(() => ({ productForm: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))
vi.mock('../../../Shared', () => ({
  SideBar: ({ id, children }) => <div data-testid={id}>{children}</div>
}))
vi.mock('../../BusinessSchedule', () => ({ BusinessSchedule: () => null }))
vi.mock('../../BusinessPaymentMethods', () => ({ BusinessPaymentMethods: () => null }))
vi.mock('../../BusinessProductsCategoyDetails', () => ({ BusinessProductsCategoyDetails: () => null }))
vi.mock('../../BusinessProductAddForm', () => ({
  BusinessProductAddForm: (props) => {
    received.productForm = props
    return <div data-testid='product-form' />
  }
}))

afterEach(() => {
  cleanup()
  received.productForm = null
})

const renderWizard = (business) => render(
  <ThemeProvider theme={theme}>
    <WizardBusiness
      isTutorialMode
      business={business}
      openTutorialSidebarState='new_product'
      setOpenTutorialSidebarState={vi.fn()}
      handleSucessUpdateBusiness={vi.fn()}
    />
  </ThemeProvider>
)

describe('WizardBusiness new product step (G1-14)', () => {
  it('opens the product form when the business has no categories yet', () => {
    expect(() => renderWizard({ id: 3, name: 'New store' })).not.toThrow()
    expect(screen.getByTestId('product-form')).toBeTruthy()
    expect(received.productForm.categorySelected).toBeUndefined()
  })

  it('selects the first category when there is one', () => {
    renderWizard({ id: 3, categories: [{ id: 11, name: 'Drinks' }, { id: 12, name: 'Food' }] })
    expect(received.productForm.categorySelected).toEqual({ id: 11, name: 'Drinks' })
  })
})
