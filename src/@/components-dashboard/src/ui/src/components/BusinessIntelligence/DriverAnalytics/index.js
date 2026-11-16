import React, { useId } from 'react'

import { useLanguage, DriverAnalytics as DriverAnalyticsController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton, PageHeader, useProductDir } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { ReportChannels, ReportFilterPills, ReportPeriod } from '../AnalyticsKit'
// redesign drivers FC2 (D10): the pieces of Business that this page reuses are imported by file; nothing of Business moves
import { BusinessBreakdowns } from '../BusinessAnalytics/BusinessBreakdowns'
import { BusinessHeatmap } from '../BusinessAnalytics/BusinessHeatmap'
import { DriverTreePill } from './DriverTreePill'
import { DriverOrderRoute } from './DriverOrderRoute'
import { DriverSummary } from './DriverSummary'
import { DriverOrdersAndSales, DriverPeople, DriverTimes } from './DriverSections'
import '../BusinessAnalytics/business-analytics.css'
import './driver-analytics.css'

// redesign drivers FC2 (D1-D12; auditors 1, 2, 5, 6, 10, 12): /intelligence/drivers, direction A of Business. The order, from the top:
// header, period, filters, channels, the seven figures of the period, and then Orders and sales, Drivers, Delivery times, Service and
// Order locations. The controller (`DriverAnalytics` of ~components, batch B) asks the reports and computes the figures and the series;
// this file only paints. The page classes (`odc-bi-page`, `odc-bi-section`, `odc-bi-grid`...) are those of Business (business-analytics.css).

// redesign drivers FC2 (D5): the bar paints the page's own driver pill (the tree of `main`) in the place of the kit's, the order of `main`
const PILLS = ['country', 'brand', 'driverGroup', 'driver', 'zone']

const Section = ({ title, children }) => {
  const headingId = useId()
  return (
    <section className='odc-bi-section' aria-labelledby={headingId}>
      <h2 className='odc-bi-section-title' id={headingId}>{title}</h2>
      {children}
    </section>
  )
}

const DriverAnalyticsUI = (props) => {
  const {
    filterList,
    handleChangeFilterList,
    countryCode,
    handleChangeCode,
    period,
    reloadBlock,
    orderStatusList,
    customerSatisfactionList,
    orderLocationList
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const dir = useProductDir()

  // redesign drivers FC2 (DR-11): the article of the delivery reports, not the one of Business
  const learnOptions = learnOptionsValues(['delivery_reports'], t)

  return (
    <div className='odc-root odc-bi-page' data-slot='bi-drivers-page' dir={dir}>
      <PageHeader
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        title={t('DELIVERY_REPORTS', 'Delivery reports')}
        learn={<LearnDropDown learnOptions={learnOptions} />}
      />
      <div className='odc-bi-controls'>
        <ReportPeriod
          lapse={filterList?.lapse}
          period={period}
          timeZone={filterList?.timeZone}
          onChange={(lapse) => handleChangeFilterList({ ...filterList, lapse })}
        />
        <ReportFilterPills
          pills={PILLS}
          driverPill={DriverTreePill}
          filterList={filterList}
          handleChangeFilterList={handleChangeFilterList}
          countryCode={countryCode}
          handleChangeCode={handleChangeCode}
        />
        <ReportChannels filterList={filterList} handleChangeFilterList={handleChangeFilterList} />
      </div>
      <DriverSummary {...props} />
      <Section title={t('BUSINESS_REPORTS_SECTION_SALES', 'Orders and sales')}>
        <DriverOrdersAndSales {...props} />
      </Section>
      <Section title={t('DRIVER_REPORTS_SECTION_DRIVERS', 'Drivers')}>
        <DriverPeople {...props} />
      </Section>
      <Section title={t('DRIVER_REPORTS_SECTION_TIMES', 'Delivery times')}>
        <DriverTimes {...props} />
      </Section>
      <Section title={t('BUSINESS_REPORTS_SECTION_SERVICE', 'Service')}>
        <BusinessBreakdowns
          section='service'
          orderStatusList={orderStatusList}
          customerSatisfactionList={customerSatisfactionList}
          reloadBlock={reloadBlock}
        />
      </Section>
      <Section title={t('DRIVER_REPORTS_SECTION_MAP', 'Order locations')}>
        {/* redesign (Drivers part): BusinessHeatmap paints a failed block as the card of the kit with «Try again» (DR-01, R1 F3) and keeps
            that card mounted while it reloads, so the focus never falls on <body> (the card used to unmount when the block went to loading) */}
        <BusinessHeatmap locationList={orderLocationList} onRetry={() => reloadBlock?.('orderLocation')} />
      </Section>
      {/* (port of ): the lookup by order number is about one order, so it reads neither the period nor the filters */}
      {/* the card is the section: its title is the h2, so the name is not said twice */}
      <div className='odc-bi-section'>
        <DriverOrderRoute headingLevel={2} />
      </div>
    </div>
  )
}

export const DriverAnalytics = (props) => {
  const driverAnalyticsProps = {
    ...props,
    UIComponent: DriverAnalyticsUI
  }
  return (
    <DriverAnalyticsController {...driverAnalyticsProps} />
  )
}
