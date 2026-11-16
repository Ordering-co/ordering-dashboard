import React, { useMemo } from 'react'
import { ThemeProvider, useTheme } from 'styled-components'

import mobileCase from '../../../src/assets/images/mobile-case.png'
import mobileMask from '../../../src/assets/images/mobile-mask.png'
import productDummy from '../../../src/assets/images/dummies/product.png'
import storeDummy from '../../../src/assets/images/dummies/store.png'
import { createDashboardLogoDefaults } from '../../../src/brand/identity'
import { BusinessPreview } from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessPreview'

const business = {
  id: 401,
  name: 'Identity fixture restaurant',
  food: true,
  open: true,
  header: productDummy,
  logo: storeDummy,
  delivery_price: 4.5,
  delivery_time: '00:30',
  pickup_time: '00:15',
  distance: 2.4,
  reviews: { total: 5, reviews: [{ id: 1 }] },
  categories: [{
    id: 501,
    name: 'Identity products',
    image: productDummy,
    products: [{
      id: 601,
      name: 'Fixture product',
      description: 'A populated preview product.',
      price: 12,
      inventoried: false,
      quantity: 20,
      images: productDummy
    }]
  }]
}

export const IdentityBusinessPreviewFixture = () => {
  const outerTheme = useTheme()
  const query = new URLSearchParams(window.location.search)
  const isMobileView = query.get('view') === 'mobile'
  const theme = useMemo(() => ({
    ...outerTheme,
    images: {
      ...outerTheme.images,
      logos: createDashboardLogoDefaults(),
      general: { ...outerTheme.images?.general, mobileCase, mobileMask },
      dummies: { ...outerTheme.images?.dummies, businessLogo: storeDummy, product: productDummy }
    }
  }), [outerTheme])
  return (
    <ThemeProvider theme={theme}>
      <main data-testid='identity-business-preview-fixture' style={{ boxSizing: 'border-box', minWidth: 0, padding: 16, width: '100%' }}>
        <h1>Business preview identity consumer</h1>
        <p>This fixture verifies only the BusinessPreview identity consumer and its existing visibility gates.</p>
        <div data-testid='business-preview-mode'>{isMobileView ? 'mobile' : 'desktop'}</div>
        <BusinessPreview business={business} isMobileView={isMobileView} />
      </main>
    </ThemeProvider>
  )
}
