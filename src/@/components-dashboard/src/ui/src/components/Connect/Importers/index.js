import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { PosMenuBusinessList as BusinessListController, useLanguage } from '../../../../../index'
import { getStorageItem, setStorageItem } from '../../../utils'

import { BusinessActiveStateFilter } from '../../Stores/BusinessActiveStateFilter'

import { BusinessesListingHeader } from '../BusinessesListingHeader'
import { BusinessesList } from '../BusinessesList'
import { ImportersPanel } from '../ImportersPanel'
import { MenuImportModal } from './MenuImportModal'
import { GloriaFoodImportModal } from './GloriaFoodImportModal'

import {
  BusinessListingContainer,
  ViewContainer
} from './styles'

export const ImportersUI = (props) => {
  const {
    businessList,
    integrationsList,
    pagination,
    searchValue,
    selectedBusinessActiveState,
    handleChangeBusinessActiveState,
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
  const [openImportersPanel, setOpenImportersPanel] = useState(false)
  const [detailsBusiness, setDetailsBusiness] = useState(null)
  const [detailsBusinessId, setDetailsBusinessId] = useState(null)
  const [importModal, setImportModal] = useState({ open: false, card: null })

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

  const closeImportersPanel = useCallback(() => {
    setOpenImportersPanel(false)
    setDetailsBusiness(null)
    setDetailsBusinessId(null)
    setImportModal({ open: false, card: null })
    onBusinessRedirect()
  }, [onBusinessRedirect])

  const handleBackRedirect = () => {
    closeImportersPanel()
  }

  const handleOpenBusinessDetails = (business) => {
    setDetailsBusiness(business)
    setDetailsBusinessId(business.id)
    setOpenImportersPanel(true)
    onBusinessRedirect(business.id)
  }

  useEffect(() => {
    const id = query.get('id')
    if (id === null) {
      setOpenImportersPanel(false)
      setDetailsBusinessId(null)
      return
    }
    setDetailsBusinessId(id)
  }, [])

  useEffect(() => {
    if (!detailsBusinessId || businessList.loading) return

    const found = businessList?.businesses?.find(
      (business) => String(business.id) === String(detailsBusinessId)
    )

    if (found) {
      setDetailsBusiness(found)
      setOpenImportersPanel(true)
      return
    }

    if (detailsBusiness?.id && String(detailsBusiness.id) === String(detailsBusinessId)) return

    closeImportersPanel()
  }, [businessList.loading, businessList?.businesses, detailsBusinessId, detailsBusiness, closeImportersPanel])

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

  const handleImportClick = (card) => {
    setImportModal({ open: true, card })
  }

  const handleCloseImportModal = () => {
    setImportModal({ open: false, card: null })
  }

  return (
    <>
      <BusinessListingContainer>
        <BusinessesListingHeader
          title={t('CONNECT_IMPORTERS', 'Importers')}
          searchValue={searchValue}
          onSearch={onSearch}
          handleRefreshBusinesses={loadBusinesses}
          loading={businessList.loading}
          noBusinesses={noBusinesses}
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
          fromImporters
        />
      </BusinessListingContainer>
      {openImportersPanel && detailsBusiness && (
        <ImportersPanel
          open={openImportersPanel}
          business={detailsBusiness}
          onClose={handleBackRedirect}
          onImportClick={handleImportClick}
        />
      )}
      {importModal.open && detailsBusiness && (
        importModal.card?.id === 'gloriafood'
          ? (
            <GloriaFoodImportModal
              open={importModal.open}
              business={detailsBusiness}
              onClose={handleCloseImportModal}
            />
            )
          : (
            <MenuImportModal
              open={importModal.open}
              card={importModal.card}
              business={detailsBusiness}
              onClose={handleCloseImportModal}
            />
            )
      )}
    </>
  )
}

export const Importers = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const defaultActive = query.get('active')

  const businessListingProps = {
    ...props,
    UIComponent: ImportersUI,
    asDashboard: true,
    isSearchByBusinessName: true,
    isSearchByBusinessEmail: true,
    isSearchByBusinessPhone: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    },
    defaultActive: defaultActive ? defaultActive === 'true' : true
  }
  return (
    <BusinessListController {...businessListingProps} />
  )
}
