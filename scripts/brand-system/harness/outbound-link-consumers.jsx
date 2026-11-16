import React from 'react'
import { ThemeProvider } from 'styled-components'
import rightArrow from '../../../src/assets/images/icons/right-arrow.svg'
import leftArrow from '../../../src/assets/images/icons/left-arrow.svg'
import { MemoryRouter } from 'react-router-dom'
import { UserDetailsUI } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserDetails'
import { ProductForm } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/ProductForm'

const product = {
  id: 901,
  name: 'Fixture product',
  description: 'Customer description: https://example.invalid/product and support@example.invalid remain customer text.',
  price: 10,
  images: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="80"/%3E',
  ingredients: [],
  extras: []
}
export const OutboundLinkConsumersFixture = () => (
  <main style={{ padding: 20 }}>
    <h1>Ordering.co outbound link consumers</h1>
    <section data-testid='personalization-user-consumer' id='user_lateral_bar' style={{ maxWidth: 700 }}>
      <MemoryRouter initialEntries={['/?tab=personalization']}>
        <UserDetailsUI
          userState={{ loading: false, user: { id: 501, name: 'Fixture user', lastname: 'Only', level: 3, enabled: true } }}
          setExtraOpen={() => {}}
          handleSuccessUserUpdate={() => {}}
          handleDeleteUser={() => { throw new Error('User writes outside fixture scope') }}
          handleChangeActiveUser={() => { throw new Error('User writes outside fixture scope') }}
        />
      </MemoryRouter>
    </section>
    <section data-testid='product-description-consumer' style={{ maxWidth: 700 }}>
      <ThemeProvider theme={theme => ({ ...theme, images: { ...theme.images, icons: { ...theme.images?.icons, rightArrow, leftArrow } } })}>
        <ProductForm product={product} productCart={{ options: {}, ingredients: {}, quantity: 1, total: 10, comment: '' }} />
      </ThemeProvider>
    </section>
  </main>
)
