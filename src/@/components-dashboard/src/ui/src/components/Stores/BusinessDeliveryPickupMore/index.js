import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { BusinessDeliveryDetails } from '../BusinessDeliveryDetails'
import { BusinessPickupDetails } from '../BusinessPickupDetails'
import { BusinessEta } from '../BusinessEta'
import { DragScroll } from '../../Shared'
import { addQueryToUrl } from '../../../utils'
import { useBusinessOwnerRestriction } from '../../../hooks/useBusinessOwnerRestriction'

import {
  Container,
  TabsContainer,
  Tab
} from './styles'
import { DriversGroupsListingDetails } from '../BusinessDeliveryGroupsDetails'

export const BusinessDeliveryPickupMore = (props) => {
  const {
    setIsExtendExtraOpen
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const isRestricted = useBusinessOwnerRestriction()

  const [selectedTab, setSelectedTab] = useState('delivery')

  const tabs = [
    { key: 'delivery', content: t('DELIVERY', 'Delivery'), enabled: true },
    { key: 'pickup', content: t('PICKUP', 'Pickup'), enabled: true },
    { key: 'driver_delivery_group', content: t('DRIVER_DELIVERY_GROUP', 'Driver Delivery Group'), enabled: !isRestricted },
    { key: 'advanced_eta', content: t('ADVANCED_ETA', 'Advanced ETA'), enabled: true }
  ]

  useEffect(() => {
    setIsExtendExtraOpen(false)
  }, [selectedTab])

  const handleTabClick = (tab, isInitialRender) => {
    setSelectedTab(tab)
    if (!isInitialRender) {
      addQueryToUrl({ tab })
    }
  }

  useEffect(() => {
    const tab = query.get('tab')
    const includeTab = tabs.some(_tab => _tab?.key === tab)
    handleTabClick(tab && includeTab ? tab : 'delivery', !!(tab && includeTab))
  }, [])

  return (
    <Container>
      <h1>{t('DELIVERY_PICKUP_MORE', 'Delivery, pickup & more')}</h1>
      <TabsContainer>
        <DragScroll>
          {tabs.filter((tab) => (tab.enabled)).map(tab => (
            <Tab
              key={tab.key}
              active={tab.key === selectedTab}
              onClick={() => handleTabClick(tab.key)}
            >
              {tab.content}
            </Tab>
          ))}
        </DragScroll>
      </TabsContainer>
      {selectedTab === 'delivery' && (
        <BusinessDeliveryDetails {...props} />
      )}
      {selectedTab === 'pickup' && (
        <BusinessPickupDetails {...props} />
      )}
      {selectedTab === 'driver_delivery_group' && (
        <DriversGroupsListingDetails {...props} />
      )}
      {selectedTab === 'advanced_eta' && (
        <BusinessEta {...props} />
      )}
    </Container>
  )
}
