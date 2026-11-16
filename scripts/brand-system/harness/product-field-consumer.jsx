import React from 'react'
import { ThemeProvider } from 'styled-components'
import { ProductDesktopPreview } from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductDesktopPreview'
import rightArrow from '../../../src/assets/images/icons/right-arrow.svg'
import leftArrow from '../../../src/assets/images/icons/left-arrow.svg'

const product = {
  name: 'Selection contract specimen',
  images: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="120"/%3E',
  ingredients: [],
  extras: [{
    options: [{
      id: 800,
      name: 'Round checkbox preview',
      min: 1,
      max: 1,
      suboptions: [
        { id: 801, name: 'Round choice A', enabled: true, price: 0 },
        { id: 802, name: 'Round choice B', enabled: true, price: 0 }
      ]
    }]
  }]
}
const cart = { options: {}, ingredients: {}, quantity: 1, total: 0, comment: '' }

// Exercise the sole real RadioButton consumer without changing its preview-only
// behavior or connecting a catalog controller/provider.
export const ProductFieldConsumerFixture = () => (
  <ThemeProvider theme={theme => ({ ...theme, images: { ...theme.images, icons: { ...theme.images?.icons, rightArrow, leftArrow } } })}>
    <main data-testid='product-field-consumer' style={{ maxWidth: 960, margin: 24 }}>
      <ProductDesktopPreview product={product} productCart={cart} showProductOption={() => true} />
    </main>
  </ThemeProvider>
)
