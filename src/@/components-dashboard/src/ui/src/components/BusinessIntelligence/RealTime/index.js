import React, { useState } from 'react'
import { useLanguage, EcommerceAnalitycs as EcommerceAnalitycsController } from '../../../../../index'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, IconButton } from '../../../styles'
import { Modal, LearnDropDown } from '../../Shared'
import { AnalyticsCalendar } from '../AnalyticsCalendar'
import { AnalyticsFilterTimeZone } from '../AnalyticsFilterTimeZone'
import { AnalyticsStatusSubFilter } from '../AnalyticsStatusSubFilter'
import { ReportsBrandFilter } from '../ReportsBrandFilter'
import { CountryFilter } from '../CountryFilter'
import { AnalitycsClicks } from '../AnalitycsClicks'
import { learnOptionsValues } from '../../../utils'

import {
  BusinessAnalyticsContainer,
  BusinessAnalyticsHeader,
  HeaderTitleContainer,
  HeaderFilterContainer,
  BusinessFilterWrapper,
  BusinessCalendarWrapper,
  AnalyticsContentWrapper,
  AnalyticsTimeZoneWrapper
} from './styles'
import { AnalitycsTopClicks } from '../AnalitycsTopClicks'

const RealTimeUI = (props) => {
  const {
    handleChangeFilterList,
    filterList,
    trackingEventsList
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [isBrandFilter, setIsBrandFilter] = useState(false)
  const [openCountryFilter, setOpenCountryFilter] = useState(true)

  const learnOptions = learnOptionsValues(['business_reports'], t)

  const handleChangeDate = (date1, date2) => {
    handleChangeFilterList({ ...filterList, from: `${date1} 00:00:00`, to: `${date2} 23:59:59` })
  }

  return (
    <BusinessAnalyticsContainer>
      <BusinessAnalyticsHeader>
        <HeaderTitleContainer>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('REAL_TIME', 'Real time')}</h1>
          <LearnDropDown
            learnOptions={learnOptions}
          />
        </HeaderTitleContainer>
        <HeaderFilterContainer>
          <BusinessFilterWrapper>
            <Button onClick={() => setOpenCountryFilter(true)}>
              {t('COUNTRY', 'Country')}
            </Button>
          </BusinessFilterWrapper>
          <BusinessFilterWrapper>
            <Button onClick={() => setIsBrandFilter(true)}>
              {t('BRAND', 'Brand')} ({filterList?.franchises_id ? filterList?.franchises_id.length : t('ALL', 'All')})
            </Button>
          </BusinessFilterWrapper>
          <AnalyticsTimeZoneWrapper>
            <AnalyticsFilterTimeZone {...props} />
          </AnalyticsTimeZoneWrapper>
          <BusinessCalendarWrapper>
            <AnalyticsCalendar
              {...props}
              handleChangeDate={handleChangeDate}
            />
          </BusinessCalendarWrapper>
        </HeaderFilterContainer>
      </BusinessAnalyticsHeader>
      <AnalyticsStatusSubFilter
        {...props}
      />
      <AnalyticsContentWrapper className='row'>
        <div className='col-md-12 col-lg-8'>
          <AnalitycsClicks
            filterList={filterList}
            chartDataList={trackingEventsList}
            type='Business'
          />
        </div>
        <div className='col-md-12 col-lg-4'>
          <AnalitycsTopClicks
            filterList={filterList}
            chartDataList={trackingEventsList}
            type='Business'
          />
        </div>
      </AnalyticsContentWrapper>
      <AnalyticsContentWrapper className='row'>
        <div className='col-md-12 col-lg-8'>
          <AnalitycsClicks
            filterList={filterList}
            chartDataList={trackingEventsList}
            type='Product'
          />
        </div>
        <div className='col-md-12 col-lg-4'>
          <AnalitycsTopClicks
            filterList={filterList}
            chartDataList={trackingEventsList}
            type='Product'
          />
        </div>
      </AnalyticsContentWrapper>
      <AnalyticsContentWrapper className='row'>
        <div className='col-md-12 col-lg-8'>
          <AnalitycsClicks
            filterList={filterList}
            chartDataList={trackingEventsList}
            type='Category'
          />
        </div>
        <div className='col-md-12 col-lg-4'>
          <AnalitycsTopClicks
            filterList={filterList}
            chartDataList={trackingEventsList}
            type='Category'
          />
        </div>
      </AnalyticsContentWrapper>
      {isBrandFilter && (
        <Modal
          width='50%'
          height='80vh'
          padding='30px'
          title={t('BRAND', 'Brand')}
          open={isBrandFilter}
          onClose={() => setIsBrandFilter(false)}
        >
          <ReportsBrandFilter
            {...props}
            onClose={() => setIsBrandFilter(false)}
          />
        </Modal>
      )}
      <CountryFilter
        {...props}
        openCountryFilter={openCountryFilter}
        setOpenCountryFilter={setOpenCountryFilter}
      />
    </BusinessAnalyticsContainer>
  )
}

export const RealTime = (props) => {
  const driverAnalyticsProps = {
    ...props,
    UIComponent: RealTimeUI
  }
  return (
    <EcommerceAnalitycsController {...driverAnalyticsProps} />
  )
}
