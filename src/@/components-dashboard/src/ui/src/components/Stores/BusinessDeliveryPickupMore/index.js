import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { BusinessDeliveryDetails } from '../BusinessDeliveryDetails'
import { BusinessPickupDetails } from '../BusinessPickupDetails'
import { BusinessEta } from '../BusinessEta'
import { DriversGroupsListingDetails } from '../BusinessDeliveryGroupsDetails'
import { TabPanel, Tabs } from '../../Shared/Product'
import { useRequestLeave } from '../../Shared/Product/LeaveGuard'
import { addQueryToUrl } from '../../../utils'
import './business-delivery-pickup-more.css'

const DEFAULT_TAB = 'delivery'

export const BusinessDeliveryPickupMore = (props) => {
  const {
    setIsExtendExtraOpen
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()

  const tabs = [
    { key: 'delivery', content: t('DELIVERY', 'Delivery') },
    { key: 'pickup', content: t('PICKUP', 'Pickup') },
    { key: 'driver_delivery_group', content: t('DRIVER_DELIVERY_GROUP', 'Driver Delivery Group') },
    { key: 'advanced_eta', content: t('ADVANCED_ETA', 'Advanced ETA') }
  ]
  // main: every tab is offered; the EatStreet owner no longer loses Driver Delivery Group
  const enabledTabs = tabs

  // redesign stores 5.7 (G3-26): the `?tab=` is read against the tabs this person is offered. An unknown one opens Delivery,
  // as it always did.
  const requestedTab = query.get('tab')
  const [selectedTab, setSelectedTab] = useState(() => (
    enabledTabs.some(tab => tab.key === requestedTab) ? requestedTab : DEFAULT_TAB
  ))
  // A tab that is not offered is never the one shown.
  const activeTab = enabledTabs.some(tab => tab.key === selectedTab) ? selectedTab : DEFAULT_TAB

  useEffect(() => {
    setIsExtendExtraOpen(false)
  }, [activeTab])

  // The address says where the person is: a missing or unknown `?tab=` is written back as Delivery (review 5.7 #7).
  useEffect(() => {
    if (requestedTab !== activeTab) addQueryToUrl({ tab: activeTab })
  }, [activeTab])

  const selectTab = (tab) => {
    setSelectedTab(tab)
    addQueryToUrl({ tab })
  }

  // redesign stores 5.7 (G3-23): a tab with unsaved work in the open one asks first (the editor's leave guard: «Keep editing ·
  // Save · Discard»); without a host or with nothing dirty the tab changes at once.
  const requestLeave = useRequestLeave()
  const handleTabChange = (tab) => {
    if (tab === activeTab) return
    requestLeave(() => selectTab(tab))
  }

  return (
    <div className='odc-dpm'>
      <h1 className='odc-dpm-title'>{t('DELIVERY_PICKUP_MORE', 'Delivery, pickup & more')}</h1>
      <Tabs
        label={t('DELIVERY_PICKUP_MORE', 'Delivery, pickup & more')}
        items={enabledTabs.map(tab => ({ value: tab.key, label: tab.content }))}
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabPanel value={activeTab}>
          {activeTab === 'delivery' && (
            <BusinessDeliveryDetails {...props} />
          )}
          {activeTab === 'pickup' && (
            <BusinessPickupDetails {...props} />
          )}
          {activeTab === 'driver_delivery_group' && (
            <DriversGroupsListingDetails {...props} />
          )}
          {activeTab === 'advanced_eta' && (
            <BusinessEta {...props} />
          )}
        </TabPanel>
      </Tabs>
    </div>
  )
}
