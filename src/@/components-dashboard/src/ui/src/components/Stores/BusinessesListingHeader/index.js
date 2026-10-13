import React, { useState, useEffect } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { List as MenuIcon, InfoCircle, ArrowRepeat, Funnel } from 'react-bootstrap-icons'
import MdcFilterOff from '@meronex/icons/mdc/MdcFilterOff'
import { useLanguage } from '../../../../../index'
import { SearchBar, LearnDropDown } from '../../Shared'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { ImportersButton } from '../ImportersButton'
import { learnOptionsValues } from '../../../utils'

import { Button, IconButton } from '../../../styles'
import {
  HeaderContainer,
  HeaderTitleContainer,
  ActionsWrapper
} from './styles'
import { BusinessFilterGroup } from '../BusinessFilterGroup'

export const BusinessesListingHeader = (props) => {
  const {
    searchValue,
    onSearch,
    // handleOpenAddBusiness,
    handleStartTutorial,
    handleOpenSync,
    handleRefreshBusinesses,
    loading,
    noBusinesses,
    handleGotToAdd,
    handleChangeFilterValues,
    filterValues,
    allowBusinessRegister
  } = props
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [filterApplied, setFilterApplied] = useState(false)
  const [isFilterModal, setIsFilterModal] = useState(false)

  const showTour = false
  const learnOptions = learnOptionsValues(
    [
      'store_general_view',
      'store_details',
      'store_schedule',
      'store_menu',
      'store_delivery_pickup',
      'store_notifications',
      'store_payment_methods',
      'store_tax_fees',
      'store_promotions',
      'store_channels',
      'store_qr_codes',
      'store_sales_channels',
      'store_layout',
      'store_webhooks'
    ],
    t
  )

  useEffect(() => {
    setFilterApplied(Object.keys(filterValues).length > 0)
  }, [filterValues])

  return (
    <HeaderContainer>
      <HeaderTitleContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('STORES', 'Stores')}</h1>
        <LearnDropDown
          learnOptions={learnOptions}
        />
        {showTour && !loading && !noBusinesses && (
          <OverlayTrigger
            placement='bottom'
            overlay={
              <Tooltip>
                {t('START_TUTORIAL', 'Start tutorial')}
              </Tooltip>
            }
          >
            <IconButton
              color='dark'
              className='tour_btn'
              onClick={() => handleStartTutorial()}
            >
              <InfoCircle />
            </IconButton>
          </OverlayTrigger>
        )}
      </HeaderTitleContainer>
      <ActionsWrapper>
        {!loading && !noBusinesses && (
          <>
            <Button
              color='lightPrimary'
              borderRadius='8px'
              onClick={() => handleRefreshBusinesses()}
              className={loading ? 'loading' : ''}
            >
              {t('REFRESH', 'Refresh')}
              <ArrowRepeat size={16} style={{ marginLeft: 5 }} />
            </Button>
            {/*
              No onImportSuccess here on purpose: this whole block is gated on `!loading`,
              so refreshing the list unmounts ImportersButton and closes the importer
              sidebar — which would hide the import result the user is waiting for.
            */}
            <ImportersButton customClass='importerGroup' />
            {allowBusinessRegister && (
              <Button
                color='lightPrimary'
                borderRadius='8px'
                onClick={() => handleGotToAdd()}
              >
                {t('ADD_NEW_STORE', 'Add new store')}
              </Button>
            )}
            <Button
              color='lightPrimary'
              borderRadius='8px'
              onClick={() => handleOpenSync()}
            >
              {t('SYNC', 'Sync')}
            </Button>
          </>
        )}
        <SearchBar
          isCustomLayout
          lazyLoad
          onSearch={onSearch}
          search={searchValue}
          placeholder={t('SEARCH', 'Search')}
          customClass='searchBar'
        />
        <IconButton
          color='black'
          onClick={() => setIsFilterModal(true)}
          name='filter-btn'
        >
          {filterApplied ? <Funnel /> : <MdcFilterOff />}
        </IconButton>
      </ActionsWrapper>
      <BusinessFilterGroup
        handleChangeFilterValues={handleChangeFilterValues}
        onClose={() => setIsFilterModal(false)}
        isFilterModal={isFilterModal}
      />
    </HeaderContainer>
  )
}
