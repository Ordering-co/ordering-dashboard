import React, { useState } from 'react'

import {
  DriverInfo as OnlineDriverInfo,
  OnlineDrivers,
  WrapDriverInfo,
  WrapperDriverImage,
  WrapperMap,
  WrapperOnlineDrivers
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/DeliveriesLocation/styles'
import {
  DriverInfo as MarkerInfo,
  MapMarkerImg,
  Text,
  TextContainer,
  WrapperMapMarker
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/DriverMapMarkerAndInfo/styles'
import {
  DriversContainer,
  DriversHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/DriversManager/styles'
// redesign W1-4 (T1-4-4a): the drivers head is P/PageHeader and «Filters applied» a P/InlineNotice; their type and targets are P/'s
import '../../../src/brand/candidates.css'
import { InlineNotice, PageHeader } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Product'
// `main` replaced the API-key modal with a warning banner that links to the Settings
// hub. The fixture renders that banner with the same markup the product does; the
// modal, its show/hide toggle and `ModalBody` are no longer product UI.
import {
  Container as MapsKeyContainer,
  WarningBanner
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/GoogleMapsApiKeySettingButton/style'
import {
  BubbleConsole,
  Reason,
  TimeofSent,
  WraaperLogs
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/Logistics/styles'
import { Button } from '../../../src/@/components-dashboard/src/ui/src/styles'

export const OrdersDeliveryMapsStylesFixture = () => {
  const [markerOpen, setMarkerOpen] = useState(true)

  return (
    <main data-testid='orders-delivery-maps-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <section data-testid='map-surface' aria-label='Delivery map fixture' style={{ height: 390, minWidth: 0 }}>
        <WrapperMap role='region' aria-label='Delivery map'>
          <WrapperMapMarker
            type='button'
            data-status='busy'
            aria-label='Show details for Ada Lovelace, Busy'
            aria-expanded={markerOpen}
            aria-describedby={markerOpen ? 'delivery-marker-tooltip' : undefined}
            onClick={() => setMarkerOpen(value => !value)}
            style={{ top: 148, insetInlineStart: '50%' }}
          >
            <MapMarkerImg aria-hidden='true' />
          </WrapperMapMarker>
          {markerOpen && (
            <MarkerInfo id='delivery-marker-tooltip' role='tooltip' style={{ top: 158, insetInlineStart: 'calc(50% - 120px)' }}>
              <TextContainer><Text fontWeight>Driver</Text><Text data-testid='marker-copy'>Ada Lovelace</Text></TextContainer>
              <TextContainer><Text fontWeight>Status</Text><Text>Busy</Text></TextContainer>
            </MarkerInfo>
          )}
          <WrapperOnlineDrivers>
            <p data-testid='online-title'>Online drivers</p>
            <OnlineDrivers>
              <WrapDriverInfo>
                <WrapperDriverImage aria-hidden='true' />
                <OnlineDriverInfo>
                  <p data-testid='online-name'>Ada Lovelace with a long operational name</p>
                  <p data-testid='online-status'>2 assigned orders</p>
                </OnlineDriverInfo>
              </WrapDriverInfo>
            </OnlineDrivers>
          </WrapperOnlineDrivers>
        </WrapperMap>
      </section>

      <DriversContainer data-testid='manager-surface' style={{ position: 'relative', minHeight: 154 }}>
        {/* redesign W1-4 (T1-4-4a): main's HeaderTitleContainer/WarningMessage are gone. The open-menu P/IconButton and the notice's
            P/Button keep decision 12 (32 visible, 44 area) and are measured on the route, not here. */}
        <DriversHeader>
          <PageHeader title={<span data-testid='drivers-title'>Drivers dashboard</span>} />
        </DriversHeader>
        {/* redesign tanda AB (O-3): DriversManager's FilterNotice is gone (the notice is in the FilterBar now); same spacing here */}
        <div style={{ marginBlockStart: 'var(--od-space-2)' }}>
          <InlineNotice tone='warning'>
            <span data-testid='warning-copy'>Filters applied. You may miss new orders.</span>
          </InlineNotice>
        </div>
      </DriversContainer>

      <section data-testid='maps-key-banner'>
        <MapsKeyContainer>
          <WarningBanner>
            <span data-testid='maps-key-copy'>Google Maps API key is missing.</span>
            <a href='/settings?group=locations&category=google_maps'>Add it in Settings</a>
          </WarningBanner>
        </MapsKeyContainer>
      </section>

      <WraaperLogs role='log' aria-live='polite' data-testid='logistics-surface'>
        <Button type='button' rectangle color='primary'>Reload</Button>
        <BubbleConsole>
          <div data-testid='log-copy'>Driver accepted the delivery and the dispatch event remains visible at narrow widths.</div>
          <Reason>Reason: Route reassigned</Reason>
          <TimeofSent data-testid='log-time'>2026-09-15 14:05:32</TimeofSent>
        </BubbleConsole>
      </WraaperLogs>
    </main>
  )
}
