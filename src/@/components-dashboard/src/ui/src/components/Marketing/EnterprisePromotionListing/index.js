import React, { useState, useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useConfig, useSession, useLanguage, EnterprisePromotionList as EnterprisePromontioListController } from '../../../../../index'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, IconButton } from '../../../styles'
import { Alert, SearchBar, SideBar, LearnDropDown } from '../../Shared'
import { EnterprisePromotionList } from '../EnterprisePromotionList'
import { EnterprisePromotionDetails } from '../EnterprisePromotionDetails'
import { PromotionJourneysListingUI } from '../PromotionJourneysListing'
import {
  getPromotionWorkspaceView,
  JOURNEY_VIEWS,
  setPromotionWorkspaceView
} from '../PromotionJourneysListing/journeyUtils'
import { DisabledFeatureAlert } from '../../DisabledFeatureAlert'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'

import {
  PromotionsListingContainer,
  HeaderContainer,
  HeaderTitleContainer,
  ActionsWrapper,
  PromotionWorkspace,
  WorkspaceHeader,
  WorkspaceTab,
  WorkspaceTabs
} from './styles'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'

const EnterprisePromotionListingUI = (props) => {
  const {
    searchValue,
    onSearch,
    promotionListState,
    handleSuccessUpdatePromotions,
    handleSuccessAddPromotion,
    sitesState,
    paymethodsState,
    businessesList,
    businessesPaginationProps,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    handleSuccessDeletePromotion,
    hideWorkspaceHeading
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const featureName = 'Marketing_dashboard'
  const [isDisabledFeature, setIsDisabledFeature] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [advancedOfferModuleDisabled, setAdvancedOfferModuleDisabled] = useState(false)

  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [openDetails, setOpenDetails] = useState(false)
  const [selectedPromotion, setSelectedPromotion] = useState(null)
  const [curPromotionId, setCurPromotionId] = useState(null)
  const [moveDistance, setMoveDistance] = useState(0)
  const [sideBarWidth, setSideBarWidth] = useState(600)
  const learnOptions = learnOptionsValues(['advanced_offers'], t)

  const handleOpenDetails = (promotion) => {
    setSideBarWidth(600)
    setMoveDistance(0)
    setSelectedPromotion(promotion)
    setCurPromotionId(promotion?.id)
    setOpenDetails(true)
    if (promotion) {
      addQueryToUrl({ id: promotion?.id })
    }
  }

  const handleCloseDetails = () => {
    setMoveDistance(0)
    setSideBarWidth(600)
    setOpenDetails(false)
    setSelectedPromotion(null)
    removeQueryToUrl(['id'])
  }

  useEffect(() => {
    if (!promotionListState?.error) return
    setAdvancedOfferModuleDisabled(true)
    setAlertState({
      open: true,
      content: promotionListState?.error
    })
  }, [promotionListState?.error])

  useEffect(() => {
    if (configs && Object.keys(configs).length > 0 && user) {
      if (!Object.keys(configs).includes(featureName) && user?.level === 0) {
        setIsDisabledFeature(false)
      }
    }
  }, [configs])

  // `?add=1` (command palette) opens the add form like the button
  useOpenFromQuery('add', () => handleOpenDetails(null), { ready: !promotionListState.loading })

  useEffect(() => {
    if (promotionListState.loading) return
    const id = query.get('id')
    if (id) {
      setCurPromotionId(Number(id))
      setOpenDetails(true)
      setSelectedPromotion(promotionListState.promotions.find(promotion => promotion.id === Number(id)))
    }
  }, [promotionListState.loading])

  return (
    <>
      <PromotionsListingContainer>
        <HeaderContainer>
          {!hideWorkspaceHeading && (
            <HeaderTitleContainer>
              {isCollapse && (
                <IconButton
                  color='black'
                  onClick={() => handleMenuCollapse(false)}
                >
                  <MenuIcon />
                </IconButton>
              )}
              <h1>{t('ADVANCED_OFFERS', 'Advanced offers')}</h1>
              <LearnDropDown
                learnOptions={learnOptions}
              />
            </HeaderTitleContainer>
          )}
          <ActionsWrapper eventDisabled={advancedOfferModuleDisabled || isDisabledFeature}>
            <Button
              color='lightPrimary'
              borderRadius='8px'
              onClick={() => handleOpenDetails(null)}
            >
              {t('ADD_PROMOTION_ENTERPRISE', 'Add promotion enterprise')}
            </Button>
            <SearchBar
              lazyLoad
              onSearch={onSearch}
              search={searchValue}
              placeholder={t('SEARCH', 'Search')}
            />
          </ActionsWrapper>
        </HeaderContainer>
        <EnterprisePromotionList
          {...props}
          eventDisabled={advancedOfferModuleDisabled || isDisabledFeature}
          selectedPromotion={selectedPromotion}
          handleOpenDetails={handleOpenDetails}
        />
      </PromotionsListingContainer>
      {isDisabledFeature && (<DisabledFeatureAlert />)}
      {openDetails && (
        <SideBar
          defaultSideBarWidth={sideBarWidth}
          moveDistance={moveDistance}
          open={openDetails}
          onClose={() => handleCloseDetails()}
        >
          <EnterprisePromotionDetails
            sitesState={sitesState}
            businessesList={businessesList}
            businessesPaginationProps={businessesPaginationProps}
            searchBusinesses={searchBusinesses}
            handleChangeBusinessPage={handleChangeBusinessPage}
            handleChangeBusinessPageSize={handleChangeBusinessPageSize}
            paymethodsState={paymethodsState}
            promotion={selectedPromotion || {}}
            promotionId={curPromotionId}
            promotionsList={promotionListState.promotions}
            handleSuccessUpdatePromotions={handleSuccessUpdatePromotions}
            handleSuccessAddPromotion={handleSuccessAddPromotion}
            handleSuccessDeletePromotion={handleSuccessDeletePromotion}
            setMoveDistance={setMoveDistance}
            setSideBarWidth={setSideBarWidth}
            onClose={() => handleCloseDetails()}
          />
        </SideBar>
      )}

      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}

const PromotionWorkspaceUI = (props) => {
  const history = useHistory()
  const location = useLocation()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const selectedView = props.selectedView

  const changeView = (view, promotionId) => {
    const currentSearch = window.location.search || location.search
    history.push({
      pathname: location.pathname,
      search: setPromotionWorkspaceView(currentSearch, view, promotionId)
    })
  }

  return (
    <PromotionWorkspace data-testid='promotion-workspace'>
      <WorkspaceHeader>
        {isCollapse && (
          <IconButton
            aria-label={t('OPEN_MENU', 'Open menu')}
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('PROMOTIONS', 'Promotions')}</h1>
      </WorkspaceHeader>
      <WorkspaceTabs role='tablist' aria-label={t('PROMOTION_WORKSPACE', 'Promotion workspace')}>
        <WorkspaceTab
          type='button'
          role='tab'
          aria-selected={selectedView === JOURNEY_VIEWS.JOURNEYS}
          $active={selectedView === JOURNEY_VIEWS.JOURNEYS}
          onClick={() => changeView(JOURNEY_VIEWS.JOURNEYS)}
        >
          {t('QUICK_OFFERS', 'Quick offers')}
        </WorkspaceTab>
        <WorkspaceTab
          type='button'
          role='tab'
          aria-selected={selectedView === JOURNEY_VIEWS.ADVANCED}
          $active={selectedView === JOURNEY_VIEWS.ADVANCED}
          onClick={() => changeView(JOURNEY_VIEWS.ADVANCED)}
        >
          {t('ADVANCED_OFFERS', 'Advanced offers')}
        </WorkspaceTab>
      </WorkspaceTabs>
      {selectedView === JOURNEY_VIEWS.JOURNEYS
        ? (
          <PromotionJourneysListingUI
            {...props}
            onOpenAdvancedPromotion={promotion => changeView(JOURNEY_VIEWS.ADVANCED, promotion?.id)}
          />
          )
        : <EnterprisePromotionListingUI {...props} hideWorkspaceHeading />}
    </PromotionWorkspace>
  )
}

export const EnterprisePromotionListing = (props) => {
  const location = useLocation()
  const selectedView = getPromotionWorkspaceView(location.search)
  const query = new URLSearchParams(location.search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const enterprisePromotionsProps = {
    ...props,
    selectedView,
    UIComponent: PromotionWorkspaceUI,
    paginationSettings: {
      initialPage: props.isUseQuery && selectedView === JOURNEY_VIEWS.ADVANCED && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && selectedView === JOURNEY_VIEWS.ADVANCED && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    },
    isSearchByPromotionName: true,
    isSearchByPromotionDescription: true
  }

  return <EnterprisePromontioListController {...enterprisePromotionsProps} />
}
