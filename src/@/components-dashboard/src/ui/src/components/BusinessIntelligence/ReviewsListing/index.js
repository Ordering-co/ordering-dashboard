import React, { useEffect, useState, useRef, useMemo } from 'react'
import { List as MenuIcon, CaretDownFill, Download as DownloadIcon } from 'react-bootstrap-icons'
import { useLocation } from 'react-router-dom'
import { useLanguage, useSession, useApi } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { SearchBar, LearnDropDown, Modal } from '../../Shared'
import { BusinessReviewList } from '../BusinessReviewList'
import { UsersReviewList } from '../UsersReviewList'
import { BusinessSelectHeader } from '../../Stores/BusinessSelectHeader'
import { ReviewProductsListing } from '../ReviewProductsListing'
import { AnalyticsCalendar } from '../AnalyticsCalendar'
import { Select } from '../../../styles/Select/FirstSelect'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'

import { IconButton, Button } from '../../../styles'

import {
  ReviewsListingContainer,
  Header,
  HeaderLeft,
  HeaderRight,
  Tabs,
  Tab,
  SelectWrapper,
  TitleWrapper,
  DownloadBar,
  DownloadForm,
  FormField,
  DownloadActions,
  FilterButton,
  DriverSelectWrapper,
  ModalBusinessSelect,
  CalendarWrapper,
  ClearFilter,
  ErrorText
} from './styles'

const formatYMD = (date) => {
  const pad = (n) => `${n}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const getDefaultFilters = () => {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return { from: formatYMD(from), to: formatYMD(to), driver_id: 'all' }
}

export const ReviewsListing = (props) => {
  const {
    isUseQuery
  } = props

  const query = new URLSearchParams(useLocation().search)
  const defaultTab = query.get('tab')
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [{ token }] = useSession()
  const [ordering] = useApi()

  const firstRender = useRef(true)
  const [showOption, setShowOption] = useState(defaultTab || 'business')
  const [searchValue, setSearchValue] = useState(null)
  const [showSelect, setShowSelect] = useState(false)
  const [business, setBusiness] = useState('')
  const [businessId, setBusinessId] = useState(null)

  const [filterList, setFilterList] = useState(getDefaultFilters)
  const [reportBusiness, setReportBusiness] = useState(null)
  const [showBusinessFilter, setShowBusinessFilter] = useState(false)
  const [driverList, setDriverList] = useState({ loading: false, drivers: [] })
  const [driverSearchValue, setDriverSearchValue] = useState(null)
  const [downloadState, setDownloadState] = useState({ loading: false, error: null })
  const [showDownloadModal, setShowDownloadModal] = useState(false)

  const learnOptions = learnOptionsValues(
    [
      'reviews_manager',
      'reviews_details'
    ],
    t
  )

  const changeBusinessState = (business) => {
    setShowSelect(false)
    setBusiness(business)
    setBusinessId(business.id)
    addQueryToUrl({ business: business.id })
  }

  const changeReportBusiness = (business) => {
    setReportBusiness(business)
    setShowBusinessFilter(false)
  }

  const handleChangeDate = (from, to) => {
    setFilterList(prev => ({ ...prev, from, to }))
  }

  const loadDrivers = async (search = null) => {
    setDriverList(prev => ({ ...prev, loading: true }))
    const conditions = [{ attribute: 'level', value: 4 }]
    if (search) conditions.push({ attribute: 'name', value: { condition: 'ilike', value: `%${search}%` } })
    try {
      const { content } = await ordering.users().asDashboard()
        .select(['id', 'name', 'lastname'])
        .where({ conditions, conector: 'AND' })
        .get({ query: { page: 1, page_size: 50 } })
      setDriverList({ loading: false, drivers: content?.result || [] })
    } catch (err) {
      setDriverList({ loading: false, drivers: [] })
    }
  }

  const handleChangeDriverSearch = (value) => {
    setDriverSearchValue(value)
    loadDrivers(value)
  }

  const driverOptions = useMemo(() => {
    const options = [{ value: 'all', content: t('ALL', 'All') }]
    ;(driverList.drivers || []).forEach(driver => {
      options.push({ value: driver.id, content: `${driver.name || ''} ${driver.lastname || ''}`.trim() || `#${driver.id}` })
    })
    return options
  }, [driverList.drivers])

  const buildWhere = (extraConditions = []) => {
    const conditions = [...extraConditions]
    if (filterList.from) {
      conditions.push({ attribute: 'created_at', value: { condition: '>=', value: `${filterList.from} 00:00:00` } })
    }
    if (filterList.to) {
      conditions.push({ attribute: 'created_at', value: { condition: '<=', value: `${filterList.to} 23:59:59` } })
    }
    return conditions
  }

  const handleDownload = async () => {
    setDownloadState({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      let endpoint
      let filename
      if (showOption === 'business') {
        endpoint = `${ordering.root}/business/business_reviews_delivery.csv`
        if (reportBusiness?.id) params.append('business_id', reportBusiness.id)
        params.append('where', JSON.stringify(buildWhere()))
        filename = `business_reviews_delivery_${filterList.from}_${filterList.to}.csv`
      } else {
        endpoint = `${ordering.root}/users/user_reviews.csv`
        if (filterList.driver_id && filterList.driver_id !== 'all') params.append('user_id', filterList.driver_id)
        params.append('where', JSON.stringify(buildWhere([{ attribute: 'type', value: 1 }])))
        filename = `driver_reviews_${filterList.from}_${filterList.to}.csv`
      }
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.result?.[0] || t('DOWNLOAD_FAILED', 'Download failed'))
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloadState({ loading: false, error: null })
      setShowDownloadModal(false)
    } catch (err) {
      setDownloadState({ loading: false, error: err.message })
    }
  }

  const handleChangeOption = (option, isInitialRender) => {
    if (!isInitialRender) {
      firstRender.current = false
      removeQueryToUrl(['page', 'pageSize', 'business', 'category', 'product', 'id'])
      addQueryToUrl({ tab: option })
    }
    setShowOption(option)
    if (option === 'products' && !businessId) {
      setShowSelect(true)
    }
  }

  const handleOpenProducts = (business) => {
    setBusiness(business)
    setShowOption('products')
    setShowSelect(false)
  }

  useEffect(() => {
    if (showOption === 'drivers' && driverList.drivers.length === 0 && !driverList.loading) {
      loadDrivers()
    }
  }, [showOption])

  useEffect(() => {
    const tab = query.get('tab')
    if (tab) {
      const businessId = query.get('business')
      if (tab === 'products' && businessId) {
        setShowOption('products')
        setShowSelect(false)
        setBusinessId(Number(businessId))
      } else {
        handleChangeOption(tab, true)
      }
    } else {
      handleChangeOption(showOption)
    }
  }, [])

  return (
    <>
      <ReviewsListingContainer>
        <Header>
          <HeaderLeft>
            {isCollapse && (
              <IconButton
                color='black'
                onClick={() => handleMenuCollapse(false)}
              >
                <MenuIcon />
              </IconButton>
            )}
            {showOption === 'products'
              ? (
                  <SelectWrapper>
                    <TitleWrapper onClick={() => setShowSelect(prev => !prev)}>
                      <h1>{business?.name || t('REVIEWS_MANAGER', 'Reviews manager')}</h1>
                      <CaretDownFill className={`${showSelect && 'rotate'}`} />
                    </TitleWrapper>
                    {showSelect && (
                      <BusinessSelectHeader
                        close={() => setShowSelect(false)}
                        isOpen={showSelect}
                        noActiveStatusCondition
                        changeBusinessState={changeBusinessState}
                      />
                    )}
                  </SelectWrapper>
                )
              : (<h1>{t('REVIEWS_MANAGER', 'Reviews manager')}</h1>)
            }
            <LearnDropDown
              learnOptions={learnOptions}
            />
          </HeaderLeft>
          <HeaderRight>
            <SearchBar
              lazyLoad
              placeholder={t('SEARCH', 'Search')}
              searchValue={searchValue}
              onSearch={val => setSearchValue(val)}
            />
          </HeaderRight>
        </Header>
        <Tabs>
          <Tab
            active={showOption === 'business'}
            onClick={() => handleChangeOption('business')}
          >
            {t('BUSINESS', 'Business')}
          </Tab>
          <Tab
            active={showOption === 'drivers'}
            onClick={() => handleChangeOption('drivers')}
          >
            {t('DRIVERS', 'Drivers')}
          </Tab>
          <Tab
            active={showOption === 'customers'}
            onClick={() => handleChangeOption('customers')}
          >
            {t('CUSTOMERS', 'Customers')}
          </Tab>
          <Tab
            active={showOption === 'professionals'}
            onClick={() => handleChangeOption('professionals')}
          >
            {t('PROFESSIONALS', 'Professionals')}
          </Tab>
          <Tab
            active={showOption === 'products'}
            onClick={() => handleChangeOption('products')}
          >
            {t('PRODUCTS', 'Products')}
          </Tab>
        </Tabs>
        {(showOption === 'business' || showOption === 'drivers') && (
          <DownloadBar>
            <Button
              color='primary'
              borderRadius='8px'
              onClick={() => { setDownloadState({ loading: false, error: null }); setShowDownloadModal(true) }}
            >
              {t('CSV', 'CSV')}
              <DownloadIcon />
            </Button>
          </DownloadBar>
        )}
        {showOption === 'business' && (
          <BusinessReviewList
            parentSearchValue={searchValue}
            handleOpenProducts={handleOpenProducts}
            isUseQuery={isUseQuery}
            paginationSettings={{
              initialPage: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
          />
        )}
        {showOption === 'drivers' && (
          <UsersReviewList
            defaultUserTypesSelected={[4]}
            parentSearchValue={searchValue}
            isUseQuery={isUseQuery}
            paginationSettings={{
              initialPage: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
          />
        )}
        {showOption === 'customers' && (
          <UsersReviewList
            defaultUserTypesSelected={[3]}
            parentSearchValue={searchValue}
            isUseQuery={isUseQuery}
            paginationSettings={{
              initialPage: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
          />
        )}
        {showOption === 'professionals' && (
          <UsersReviewList
            defaultUserTypesSelected={[8]}
            parentSearchValue={searchValue}
            isUseQuery={isUseQuery}
            paginationSettings={{
              initialPage: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
          />
        )}
        {showOption === 'products' && businessId && (
          <ReviewProductsListing
            parentSearchValue={searchValue}
            businessId={businessId}
            isUseQuery={isUseQuery}
            defaultPage={isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPage) : 1}
            defaultPageSize={isUseQuery && firstRender.current && !isNaN(defaultPage) ? Number(defaultPageSize) : 10}
            firstRender={firstRender.current}
          />
        )}
      </ReviewsListingContainer>
      {showDownloadModal && (
        <Modal
          open={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          title={t('DOWNLOAD_REVIEWS_CSV', 'Download reviews CSV')}
          width='500px'
          maxWidth='500px'
          padding='30px'
          overflow='visible'
        >
          <DownloadForm>
            {showOption === 'business'
              ? (
                <>
                  <FormField>
                    <label>{t('BUSINESS', 'Business')}</label>
                    <ModalBusinessSelect>
                      <FilterButton onClick={() => setShowBusinessFilter(prev => !prev)}>
                        <b>{reportBusiness?.name || t('ALL', 'All')}</b>
                        <CaretDownFill className={`${showBusinessFilter && 'rotate'}`} />
                      </FilterButton>
                      {reportBusiness && (
                        <ClearFilter onClick={() => setReportBusiness(null)}>
                          {t('ALL', 'All')}
                        </ClearFilter>
                      )}
                      {showBusinessFilter && (
                        <BusinessSelectHeader
                          close={() => setShowBusinessFilter(false)}
                          isOpen={showBusinessFilter}
                          noActiveStatusCondition
                          changeBusinessState={changeReportBusiness}
                        />
                      )}
                    </ModalBusinessSelect>
                  </FormField>
                  <FormField>
                    <label>{t('DATE_RANGE', 'Date range')}</label>
                    <CalendarWrapper>
                      <AnalyticsCalendar
                        handleChangeDate={handleChangeDate}
                        defaultValue={filterList}
                        leftAlign
                        collapseSingleDate
                      />
                    </CalendarWrapper>
                  </FormField>
                </>
                )
              : (
                <>
                  <FormField>
                    <label>{t('DRIVER', 'Driver')}</label>
                    <DriverSelectWrapper>
                      <Select
                        className='select'
                        options={driverOptions}
                        defaultValue={filterList.driver_id}
                        placeholder={t('DRIVER', 'Driver')}
                        onChange={(value) => setFilterList(prev => ({ ...prev, driver_id: value }))}
                        isShowSearchBar
                        searchBarIsCustomLayout
                        searchValue={driverSearchValue}
                        handleChangeSearch={handleChangeDriverSearch}
                      />
                    </DriverSelectWrapper>
                  </FormField>
                  <FormField>
                    <label>{t('DATE_RANGE', 'Date range')}</label>
                    <CalendarWrapper>
                      <AnalyticsCalendar
                        handleChangeDate={handleChangeDate}
                        defaultValue={filterList}
                        leftAlign
                        collapseSingleDate
                      />
                    </CalendarWrapper>
                  </FormField>
                </>
                )}
            {downloadState.error && <ErrorText>{downloadState.error}</ErrorText>}
            <DownloadActions>
              <Button
                color='primary'
                borderRadius='8px'
                disabled={downloadState.loading}
                onClick={handleDownload}
              >
                <DownloadIcon />
                {downloadState.loading ? t('DOWNLOADING', 'Downloading...') : t('DOWNLOAD', 'Download')}
              </Button>
            </DownloadActions>
          </DownloadForm>
        </Modal>
      )}
    </>
  )
}
