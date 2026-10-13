import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { PosMenuBusinessList as BusinessListController, useLanguage } from '../../../../../index'
import { getStorageItem, setStorageItem } from '../../../utils'

import { BusinessActiveStateFilter } from '../../Stores/BusinessActiveStateFilter'

import { BusinessesListingHeader } from '../BusinessesListingHeader'
import { BusinessesList } from '../BusinessesList'
import { BusinessDetails } from '../BusinessDetails'

import {
  BusinessListingContainer,
  ViewContainer
} from './styles'

const SalesChannelsUI = (props) => {
  const {
    businessList,
    integrationsList,
    pagination,
    searchValue,
    selectedBusinessActiveState,
    handleChangeBusinessActiveState,
    handleInstallSysPlugin,
    installingPluginRoot,
    handleInstallPosIntegration,
    getIntegrations,
    loadMoreBusinesses,
    handleSucessRemoveBusiness,
    handleSucessAddBusiness,
    handleSucessUpdateBusiness,
    loadBusinesses,
    onSearch,
    onBusinessRedirect,
    getPageBusinesses,
    filterValues,
    businessTypeSelected,
    inActiveBusinesses,
    citiesList,
    isUseQuery
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [viewMethod] = useState('list')
  const [openBusinessDetails, setOpenBusinessDetails] = useState(false)
  const [detailsBusiness, setDetailsBusiness] = useState(null)
  const [detailsBusinessId, setDetailsBusinessId] = useState(null)
  const [openAddBusiness, setOpenAddBusiness] = useState(false)

  const noBusinesses = useMemo(() => {
    return !businessList?.loading &&
      businessList?.businesses?.length === 0 &&
      pagination?.currentPage === 1 &&
      !searchValue &&
      (!filterValues || Object.keys(filterValues).length === 0) &&
      selectedBusinessActiveState &&
      !businessTypeSelected &&
      inActiveBusinesses.businesses?.length === 0
  }, [businessList?.loading, businessList?.businesses, pagination, searchValue, filterValues, selectedBusinessActiveState, businessTypeSelected, inActiveBusinesses])

  const handleBackRedirect = () => {
    setOpenBusinessDetails(false)
    setDetailsBusiness(null)
    setDetailsBusinessId(null)
    onBusinessRedirect()
  }

  const handleOpenBusinessDetails = (business) => {
    setOpenAddBusiness(false)
    setDetailsBusiness(business)
    setDetailsBusinessId(business.id)
    setOpenBusinessDetails(true)
    onBusinessRedirect(business.id)
  }

  useEffect(() => {
    const id = query.get('id')
    if (id === null) setOpenBusinessDetails(false)
    else {
      setDetailsBusinessId(id)
      setOpenBusinessDetails(true)
    }
  }, [])

  const handleSetStorage = async () => {
    const preVisited = await getStorageItem('visited', true)
    if (!preVisited?.businesses_page) {
      const visited = {
        ...preVisited,
        businesses_page: true
      }
      await setStorageItem('visited', visited, true)
    }
  }

  useEffect(() => {
    handleSetStorage()
  }, [])

  return (
    <>
      <BusinessListingContainer isAdd={openAddBusiness}>
        <BusinessesListingHeader
          title={t('SALES_CHANNELS', 'Sales Channels')}
          searchValue={searchValue}
          onSearch={onSearch}
          handleRefreshBusinesses={loadBusinesses}
          loading={businessList.loading}
          noBusinesses={noBusinesses}
          openAddBusiness={openAddBusiness}
        />
        {!noBusinesses && (
          <ViewContainer>
            <BusinessActiveStateFilter
              isUseQuery={isUseQuery}
              selectedBusinessActiveState={selectedBusinessActiveState}
              handleChangeBusinessActiveState={handleChangeBusinessActiveState}
            />
          </ViewContainer>
        )}

        <BusinessesList
          viewMethod={viewMethod}
          businessList={businessList}
          integrationsList={integrationsList}
          pagination={pagination}
          detailsBusinessId={detailsBusinessId}
          loadMoreBusinesses={loadMoreBusinesses}
          getPageBusinesses={getPageBusinesses}
          handleSucessRemoveBusiness={handleSucessRemoveBusiness}
          handleSucessAddBusiness={handleSucessAddBusiness}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          handleOpenBusinessDetails={handleOpenBusinessDetails}
          selectedBusinessActiveState={selectedBusinessActiveState}
          citiesList={citiesList}
          isUseQuery={isUseQuery && viewMethod === 'list'}
          searchValue={searchValue}
          onSearch={onSearch}
          fromSalesChannels
        />
      </BusinessListingContainer>
      {openBusinessDetails && (
        <BusinessDetails
          open={openBusinessDetails}
          business={detailsBusiness}
          businessId={detailsBusinessId}
          integrationsList={integrationsList}
          getIntegrations={getIntegrations}
          handleSucessAddBusiness={handleSucessAddBusiness}
          handleSucessRemoveBusiness={handleSucessRemoveBusiness}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          handleInstallSysPlugin={handleInstallSysPlugin}
          installingPluginRoot={installingPluginRoot}
          handleInstallPosIntegration={handleInstallPosIntegration}
          onClose={() => handleBackRedirect()}
          fromSalesChannels
        />
      )}
    </>
  )
}

export const SalesChannels = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const defaultActive = query.get('active')

  const businessListingProps = {
    ...props,
    UIComponent: SalesChannelsUI,
    asDashboard: true,
    isSearchByBusinessName: true,
    isSearchByBusinessEmail: true,
    isSearchByBusinessPhone: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    },
    defaultActive: defaultActive ? defaultActive === 'true' : true,
    integrationType: 'sales_channel'
  }
  return (
    <BusinessListController {...businessListingProps} />
  )
}
