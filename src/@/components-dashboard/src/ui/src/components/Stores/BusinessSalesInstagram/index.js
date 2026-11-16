import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { TabPanel, Tabs } from '../../Shared/Product'
import { GeneralInstagram } from './GeneralInstagram'
import { AdvancedInstagram } from './AdvancedInstagram'

// redesign stores 5.15b (; G5-04, G5-12, G5-13, G5-14): the Instagram guide, drawn inside BusinessSalesChannel's
// P/SectionSplit. General | Advanced are P/Tabs (decision 35: four tabs or fewer); both tabs get the store's link (main never
// handed it to Advanced, which always showed the placeholder address).
export const BusinessSalesInstagram = ({ link }) => {
  const [, t] = useLanguage()
  const [selectedTab, setSelectedTab] = useState('general')

  return (
    <div className='odc-sales-guide'>
      <Tabs
        label={t('SALES_INSTAGRAM_TABS', 'Instagram guide')}
        value={selectedTab}
        onValueChange={setSelectedTab}
        activateOnFocus
        className='odc-sales-tabs'
        items={[
          { value: 'general', label: t('GENERAL', 'General') },
          { value: 'advanced', label: t('ADVANCED', 'Advanced') }
        ]}
      >
        <TabPanel value={selectedTab} className='odc-sales-tab-panel'>
          {selectedTab === 'general' ? <GeneralInstagram link={link} /> : <AdvancedInstagram link={link} />}
        </TabPanel>
      </Tabs>
    </div>
  )
}
