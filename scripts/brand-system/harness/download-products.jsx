import React, { useMemo, useState } from 'react'
import { ThemeProvider, useTheme } from 'styled-components'

import android from '../../../src/assets/images/icons/android.svg'
import apple from '../../../src/assets/images/icons/apple.svg'
import delivery from '../../../src/assets/images/icons/delivery.svg'
import posTerminal from '../../../src/assets/images/icons/pos-terminal.svg'
import poster from '../../../src/assets/images/icons/poster.svg'
import appStore from '../../../src/assets/images/app-store.png'
import googlePlay from '../../../src/assets/images/google-play.png'
import callCenterApp from '../../../src/assets/images/call-center-app.png'
import driverApp from '../../../src/assets/images/driver-app.png'
import kioskApp from '../../../src/assets/images/kiosk-app.png'
import posApp from '../../../src/assets/images/pos-app.png'
import storeApp from '../../../src/assets/images/store-app.png'
import { InfoShareContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/InfoShareContext'
import { FreeProductsList } from '../../../src/@/components-dashboard/src/ui/src/components/Downloads/FreeProductsList'
import { PurchasedProductsList } from '../../../src/@/components-dashboard/src/ui/src/components/Downloads/PurchasedProductsList'

export const DownloadProductsFixture = () => {
  const outerTheme = useTheme()
  const query = new URLSearchParams(window.location.search)
  const list = query.get('list') || 'free'
  const [isCollapse, setIsCollapse] = useState(query.get('collapsed') === '1')
  const [collapseCalls, setCollapseCalls] = useState([])
  const handleMenuCollapse = value => {
    setIsCollapse(value)
    setCollapseCalls(current => [...current, value])
  }
  const theme = useMemo(() => ({
    ...outerTheme,
    images: {
      ...outerTheme.images,
      apps: { ...outerTheme.images?.apps, storeApp, driverApp, posApp, kioskApp, callCenterApp },
      general: { ...outerTheme.images?.general, appStore, googlePlay },
      icons: { ...outerTheme.images?.icons, delivery, posTerminal, poster, apple, android }
    }
  }), [outerTheme])
  return (
    <ThemeProvider theme={theme}>
      <InfoShareContext.Provider value={[{ isCollapse }, { handleMenuCollapse }]}>
        <main data-testid='download-products-fixture' style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default, minWidth: 0, width: '100%' }}>
          <div data-testid='download-products-list'>{list}</div>
          {list === 'purchased' ? <PurchasedProductsList /> : <FreeProductsList />}
          <output data-testid='download-collapse-state'>{String(isCollapse)}</output>
          <output data-testid='download-collapse-calls'>{JSON.stringify(collapseCalls)}</output>
        </main>
      </InfoShareContext.Provider>
    </ThemeProvider>
  )
}
