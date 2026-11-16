import React, { useId } from 'react'

import { useLanguage, BusinessAnalytics as BusinessAnalyticsController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton, PageHeader, useProductDir } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { ReportChannels, ReportFilterPills, ReportPeriod } from '../AnalyticsKit'
import { BusinessSummary } from './BusinessSummary'
import { BusinessTrends, TrendCard, formatCount } from './BusinessTrends'
import { BusinessBreakdowns } from './BusinessBreakdowns'
import { BusinessHeatmap } from './BusinessHeatmap'
import './business-analytics.css'

// redesign bi FD (D1-D10; auditor 1, 4, 6, 8, 9, 12): /intelligence/business, direction A. The order, from the top: header, period,
// filters, channels, the six figures of the period, and then Orders and sales, What sells, Service, Customers and Where orders come from.
// The controller (`BusinessAnalytics` of ~components) asks the reports and computes the figures and references; this file only paints.

const Section = ({ title, children }) => {
  const headingId = useId()
  return (
    <section className='odc-bi-section' aria-labelledby={headingId}>
      <h2 className='odc-bi-section-title' id={headingId}>{title}</h2>
      {children}
    </section>
  )
}

const BusinessAnalyticsUI = (props) => {
  const {
    filterList,
    handleChangeFilterList,
    countryCode,
    handleChangeCode,
    period,
    chartPeriod,
    registerUsersList,
    reloadBlock,
    orderLocationList
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const dir = useProductDir()

  const learnOptions = learnOptionsValues(['business_reports'], t)

  return (
    <div className='odc-root odc-bi-page' data-slot='bi-business-page' dir={dir}>
      <PageHeader
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        title={t('BUSINESS_REPORTS', 'Business reports')}
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
          filterList={filterList}
          handleChangeFilterList={handleChangeFilterList}
          countryCode={countryCode}
          handleChangeCode={handleChangeCode}
        />
        <ReportChannels filterList={filterList} handleChangeFilterList={handleChangeFilterList} />
      </div>
      <BusinessSummary {...props} />
      <Section title={t('BUSINESS_REPORTS_SECTION_SALES', 'Orders and sales')}>
        <BusinessTrends {...props} />
      </Section>
      <Section title={t('BUSINESS_REPORTS_SECTION_PRODUCTS', 'What sells')}>
        <BusinessBreakdowns {...props} section='products' />
      </Section>
      <Section title={t('BUSINESS_REPORTS_SECTION_SERVICE', 'Service')}>
        <BusinessBreakdowns {...props} section='service' />
      </Section>
      <Section title={t('BUSINESS_REPORTS_SECTION_CUSTOMERS', 'Customers')}>
        <div className='odc-bi-grid'>
          <TrendCard
            title={t('BUSINESS_REPORTS_REGISTERED_USERS', 'Registered users')}
            block={registerUsersList}
            valueKey='users'
            period={chartPeriod}
            formatValue={formatCount}
            fileName='registers_users'
            header={[t('TIME', 'Time'), t('USERS', 'Users')]}
            onRetry={() => reloadBlock?.('registerUsers')}
          />
        </div>
      </Section>
      <Section title={t('BUSINESS_REPORTS_SECTION_MAP', 'Where orders come from')}>
        {/* redesign a failed map block says so with «Try again» for this block only (the heatmap draws it) */}
        <BusinessHeatmap locationList={orderLocationList} onRetry={() => reloadBlock?.('orderLocation')} />
      </Section>
    </div>
  )
}

export const BusinessAnalytics = (props) => {
  const businessAnalyticsProps = {
    ...props,
    UIComponent: BusinessAnalyticsUI
  }
  return (
    <BusinessAnalyticsController {...businessAnalyticsProps} />
  )
}
