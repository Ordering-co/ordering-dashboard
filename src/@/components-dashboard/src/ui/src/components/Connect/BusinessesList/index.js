import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '../../../../../index'
import { ColumnAllowSettingPopover, Pagination, NotFoundSource } from '../../Shared'
import { SingleBusiness } from '../SingleBusiness'
import { addQueryToUrl } from '../../../utils'

import {
  BusinessListContainer,
  BusinessListTable,
  WrapperPagination,
  BusinessCardContainer,
  BusinessListBottomContainer,
  BusinessIdWrapper,
  ActionWrapper,
  FeaturedWrapper,
  BusinessListEmptyState
} from './styles'

export const BusinessesList = (props) => {
  const {
    viewMethod,
    businessList,
    integrationsList,
    pagination,
    loadMoreBusinesses,
    handleSucessRemoveBusiness,
    handleSucessAddBusiness,
    handleSucessUpdateBusiness,
    handleOpenBusinessDetails,
    detailsBusinessId,
    getPageBusinesses,
    selectedBusinessActiveState,
    citiesList,
    isUseQuery,
    fromSalesChannels,
    fromImporters,
    searchValue,
    onSearch
  } = props

  const [, t] = useLanguage()
  const trimmedSearchValue = searchValue?.trim?.() || ''
  const showEmptyState = !businessList.loading && businessList.businesses?.length === 0

  const emptyStateContent = useMemo(() => {
    if (trimmedSearchValue) {
      return t(
        'CONNECT_BUSINESS_SEARCH_NO_RESULTS',
        'No businesses found for "{{term}}". Try another name, email, or phone.'
      ).replace('{{term}}', trimmedSearchValue)
    }
    if (!selectedBusinessActiveState) {
      return t('CONNECT_BUSINESS_LIST_EMPTY_INACTIVE', 'No inactive businesses to show.')
    }
    return t('CONNECT_BUSINESS_LIST_EMPTY_ACTIVE', 'No active businesses to show.')
  }, [trimmedSearchValue, selectedBusinessActiveState, t])

  const [allowColumns, setAllowColumns] = useState({
    business: true,
    status: !fromSalesChannels && !fromImporters,
    pos: !!fromSalesChannels,
    sales_channels: !!fromSalesChannels
  })

  const optionsDefault = [
    {
      value: 'business',
      content: t('BUSINESS', 'Business')
    },
    {
      value: 'status',
      content: t('STATUS', 'Status')
    },
    {
      value: 'pos',
      content: t('POS', 'POS')
    },
    {
      value: 'sales_channels',
      content: t('SALES_CHANNELS', 'Sales Channels')
    }
  ]

  const columnConfig = [
    { value: 'business', show: true },
    { value: 'status', show: !fromSalesChannels && !fromImporters },
    { value: 'pos', show: !!fromSalesChannels },
    { value: 'sales_channels', show: !!fromSalesChannels }
  ]

  const selectorOptions = optionsDefault.filter(option =>
    columnConfig.find(config => config.value === option.value)?.show ?? false
  )

  const handleChangeAllowColumns = (type) => {
    setAllowColumns({
      ...allowColumns,
      [type]: !allowColumns[type]
    })
  }

  const handleChangePage = (page) => {
    getPageBusinesses(pagination.pageSize, page)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(pagination.from / pageSize)
    getPageBusinesses(pageSize, expectedPage)
  }

  const handleScroll = useCallback(() => {
    const innerHeightScrolltop = window.innerHeight + document.documentElement?.scrollTop + 10
    const badScrollPosition = innerHeightScrolltop < document.documentElement?.offsetHeight
    const hasMore = !(pagination.to === pagination.total)
    if (badScrollPosition || businessList.loading || !hasMore) return
    loadMoreBusinesses()
  }, [businessList, pagination])

  useEffect(() => {
    if (viewMethod !== 'card') return
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll, viewMethod])

  useEffect(() => {
    if (!isUseQuery || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [pagination?.currentPage, pagination?.pageSize, pagination?.total])

  return (
    <>
      {viewMethod === 'list' && (
        <>
          <BusinessListContainer fromSalesChannels={fromSalesChannels}>
            <BusinessListTable fromImporters={fromImporters}>
              <thead>
                <tr>
                  <th>
                    <BusinessIdWrapper>
                      {t('ID', 'ID')}
                    </BusinessIdWrapper>
                  </th>
                  {allowColumns?.business && (
                    <th className='business'>{t('BUSINESS', 'Business')}</th>
                  )}
                  {allowColumns?.status && (
                    <th>
                      <FeaturedWrapper>
                      {t('STATUS', 'Status')?.toUpperCase()}
                      </FeaturedWrapper>
                    </th>
                  )}
                  {allowColumns?.pos && (
                    <th>
                      <FeaturedWrapper>
                        {t('POS', 'Pos')?.toUpperCase()}
                      </FeaturedWrapper>
                    </th>
                  )}
                  {allowColumns?.sales_channels && (
                    <th>
                      <FeaturedWrapper>
                        {t('SALES_CHANNELS', 'Sales Channels')?.toUpperCase()}
                      </FeaturedWrapper>
                    </th>
                  )}
                  {!selectedBusinessActiveState && (
                    <th>{t('DISABLED_REASON', 'Disabled reason')}</th>
                  )}
                  {!fromImporters && (
                    <th className='action'>
                      <ActionWrapper>
                        <ColumnAllowSettingPopover
                          allowColumns={allowColumns}
                          optionsDefault={selectorOptions}
                          handleChangeAllowColumns={handleChangeAllowColumns}
                        />
                      </ActionWrapper>
                    </th>
                  )}
                </tr>
              </thead>
              {businessList.loading
                ? (
                    [...Array(10).keys()].map(i => (
                    <SingleBusiness
                      key={i}
                      isSkeleton
                      viewMethod={viewMethod}
                      allowColumns={allowColumns}
                      fromImporters={fromImporters}
                    />
                    ))
                  )
                : (
                    businessList.businesses.map(business => (
                      <SingleBusiness
                        key={business.id}
                        detailsBusinessId={detailsBusinessId}
                        integrationsList={integrationsList}
                        viewMethod={viewMethod}
                        allowColumns={allowColumns}
                        businessId={business.id}
                        business={business}
                        handleSucessRemoveBusiness={handleSucessRemoveBusiness}
                        handleSucessAddBusiness={handleSucessAddBusiness}
                        handleSucessUpdateBusiness={handleSucessUpdateBusiness}
                        handleOpenBusinessDetails={handleOpenBusinessDetails}
                        citiesList={citiesList}
                        fromSalesChannels={fromSalesChannels}
                        fromImporters={fromImporters}
                      />
                    ))
                  )}
            </BusinessListTable>
            {showEmptyState && (
              <BusinessListEmptyState>
                <NotFoundSource
                  content={emptyStateContent}
                  btnTitle={trimmedSearchValue ? t('CLEAR_SEARCH', 'Clear search') : undefined}
                  onClickButton={trimmedSearchValue ? () => onSearch?.('') : undefined}
                />
              </BusinessListEmptyState>
            )}
          </BusinessListContainer>

          <BusinessListBottomContainer>
            {pagination && (
              <WrapperPagination>
                {pagination?.total > 0 && (
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={Math.ceil(pagination?.total / pagination.pageSize)}
                    handleChangePage={handleChangePage}
                    handleChangePageSize={handleChangePageSize}
                    defaultPageSize={pagination?.pageSize}
                  />
                )}
              </WrapperPagination>
            )}
          </BusinessListBottomContainer>
        </>
      )}

      {viewMethod === 'card' && (
        <BusinessCardContainer>
          {businessList.loading
            ? (
                [...Array(30).keys()].map(i => (
              <SingleBusiness
                key={i}
                isSkeleton
                viewMethod={viewMethod}
                allowColumns={allowColumns}
              />
                ))
              )
            : (
                businessList.businesses.map(business => (
              <SingleBusiness
                key={business.id}
                viewMethod={viewMethod}
                allowColumns={allowColumns}
                businessId={business.id}
                business={business}
                handleSucessRemoveBusiness={handleSucessRemoveBusiness}
                handleSucessAddBusiness={handleSucessAddBusiness}
                handleSucessUpdateBusiness={handleSucessUpdateBusiness}
                handleOpenBusinessDetails={handleOpenBusinessDetails}
                citiesList={citiesList}
              />
                ))
              )}
        </BusinessCardContainer>
      )}
    </>
  )
}
