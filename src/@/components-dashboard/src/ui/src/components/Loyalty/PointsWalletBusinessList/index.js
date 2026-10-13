import React, { useState, useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, useUtils, PointsWalletBusinessList as PointsWalletBusinessListController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useTheme } from 'styled-components'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { SearchBar, Pagination, Modal, SideBar, Alert } from '../../Shared'
import { Switch } from '../../../styles'
import { ChevronRight, Square, CheckSquareFill } from 'react-bootstrap-icons'
import { PointsWalletBusinessDetail } from '../PointsWalletBusinessDetail'
import {
  Container,
  SearchWrapper,
  // BusinessSelectOption,
  TableWrapper,
  BusinessTable,
  TBoday,
  BusinessInfoWrapper,
  WrapperImage,
  Image,
  CheckBoxWrapper,
  ModifiedWrapper,
  CheckBoxInnerWrapper
} from './styles'

const PointsWalletBusinessListUI = (props) => {
  const {
    businessList,
    handleParentSidebarMove,
    pointWallet,
    handleCheckBox,
    handleUpdateWalletBusiness,
    handleUpdateBusinessList,
    handleChangeSwitch,
    isCloseBusinessDetails,
    paginationProps,
    setPaginationProps,
    searchValue,
    handleChangeSearch
  } = props

  const history = useHistory()
  const location = useLocation()
  const query = new URLSearchParams(location.search)

  const replaceQuery = (mutate) => {
    const next = new URLSearchParams(location.search)
    mutate(next)
    const qs = next.toString()
    history.replace(qs ? `${location.pathname}?${qs}` : location.pathname)
  }
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const theme = useTheme()
  const { width } = useWindowSize()
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const [extraOpen, setExtraOpen] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState(null)

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleChangePage = (page) => {
    setPaginationProps(prev => ({ ...prev, currentPage: page }))
  }

  const handleChangePageSize = (pageSize) => {
    setPaginationProps(prev => ({ ...prev, pageSize, currentPage: 1 }))
  }

  const handleClickBusiness = (business, e) => {
    if (e?.target?.closest('.accumulates') || e?.target?.closest('.redeems') || e?.target?.closest('.wallet_enabled')) return
    if (!pointWallet) {
      setAlertState({ open: true, content: [t('YOU_MUST_CREATE_LOYALTY_PLAN', 'You must create a loyalty plan')] })
      return
    }
    if (!business?.wallet_enabled) {
      setAlertState({ open: true, content: t('DISABLED_BUSINESS', 'Disabled business') })
      return
    }
    setSelectedBusiness(business)
    setExtraOpen(true)
    replaceQuery((next) => {
      next.set('business_id', String(business?.id))
    })
    if (width >= 1100) {
      handleParentSidebarMove(550)
    }
  }

  const handleCloseBusinessDetail = () => {
    setExtraOpen(false)
    setSelectedBusiness(null)
    handleParentSidebarMove(0)
    replaceQuery((next) => {
      next.delete('business_id')
    })
  }

  const updateBusinessList = (changes) => {
    const updatedBusiness = { ...selectedBusiness, ...changes }
    setSelectedBusiness(updatedBusiness)
    handleUpdateBusinessList(selectedBusiness?.id, changes)
  }

  const handleUpdateStatus = (businessId, enabled) => {
    if (!enabled) handleCloseBusinessDetail()
    handleChangeSwitch && handleChangeSwitch(businessId, enabled)
  }

  useEffect(() => {
    if (width < 1100) {
      handleParentSidebarMove(0)
    } else {
      if (extraOpen) handleParentSidebarMove(550)
    }
  }, [width, extraOpen])

  useEffect(() => {
    if (!isCloseBusinessDetails) return
    setExtraOpen(false)
    setSelectedBusiness(null)
    replaceQuery((next) => {
      next.delete('business_id')
    })
  }, [isCloseBusinessDetails])

  useEffect(() => {
    if (businessList.loading) return
    const businessId = query.get('business_id')
    if (businessId) {
      const business = businessList.businesses.find(item => item.id === Number(businessId))
      if (business) {
        handleClickBusiness(business)
      }
    }
  }, [businessList])

  return (
    <Container>
      <SearchWrapper>
        <SearchBar
          search={searchValue}
          isCustomLayout
          lazyLoad
          onSearch={(value) => handleChangeSearch(value)}
          placeholder={t('SEARCH', 'Search')}
        />
      </SearchWrapper>

      {/* {pointWallet?.type !== 'credit_point' && (
        <BusinessSelectOption>
          <Button color='secundaryDark'>{t('SELECT_ALL', 'Select all')}</Button>
          <Button color='secundaryDark'>{t('SELECT_NONE', 'Select none')}</Button>
        </BusinessSelectOption>
      )} */}

      <TableWrapper>
        {businessList.loading
          ? (
            <BusinessTable>
              <thead>
                <tr>
                  <th className='business-info'>
                    <Skeleton width={100} height={17} />
                  </th>
                  <th><Skeleton width={60} height={17} /></th>
                  <th><Skeleton width={80} height={17} /></th>
                  <th><Skeleton width={90} height={17} /></th>
                  <th />
                </tr>
              </thead>
              {[...Array(7).keys()].map(i => (
                <TBoday key={i}>
                  <tr>
                    <td>
                      <BusinessInfoWrapper>
                        <WrapperImage isSkeleton>
                          <Skeleton width={38} height={38} />
                        </WrapperImage>
                        <Skeleton width={80} height={15} />
                      </BusinessInfoWrapper>
                    </td>
                    <td>
                      <CheckBoxWrapper>
                        <Skeleton width={40} height={20} />
                      </CheckBoxWrapper>
                    </td>
                    <td>
                      <CheckBoxWrapper>
                        <Skeleton width={20} height={20} />
                      </CheckBoxWrapper>
                    </td>
                    <td>
                      <CheckBoxWrapper>
                        <Skeleton width={20} height={20} />
                      </CheckBoxWrapper>
                    </td>
                    <td>
                      <ModifiedWrapper isSkeleton>
                        <Skeleton width={17} height={17} />
                        <Skeleton width={80} height={15} />
                      </ModifiedWrapper>
                    </td>
                  </tr>
                </TBoday>
              ))}
            </BusinessTable>)
          : (
            <BusinessTable>
              <thead>
                <tr>
                  <th className='business-info'>{t('BUSINESSES', 'Businesses')}</th>
                  <th>{t('ORDERS_BOX_STATUS_HEADER', 'Status')}</th>
                  <th>{t('REDEEEM', 'Redeeem')}</th>
                  <th>{t('ACCUMULATION', 'Accumulation')}</th>
                  <th />
                </tr>
              </thead>
              {businessList.businesses.map((business, i) => (
                <TBoday
                  key={i}
                  active={business?.id === selectedBusiness?.id}
                  onClick={(e) => handleClickBusiness(business, e)}
                >
                  <tr>
                    <td>
                      <BusinessInfoWrapper>
                        <WrapperImage>
                          <Image bgimage={optimizeImage(business?.logo || theme.images?.dummies?.businessLogo, 'h_120,c_limit')} />
                        </WrapperImage>
                        <span>{business?.name}</span>
                      </BusinessInfoWrapper>
                    </td>
                    <td>
                      <CheckBoxWrapper>
                        <Switch
                          className='wallet_enabled'
                          defaultChecked={business?.wallet_enabled}
                          onChange={val => handleUpdateStatus(business.id, val)}
                        />
                      </CheckBoxWrapper>
                    </td>
                    <td>
                      <CheckBoxWrapper>
                        <CheckBoxInnerWrapper
                          onClick={(e) => handleCheckBox(business.id, 'redeems', !business?.redeems)}
                          className='redeems'
                          noClick={!business?.wallet_enabled}
                        >
                          {business?.redeems ? <CheckSquareFill className='fill' /> : <Square />}
                        </CheckBoxInnerWrapper>
                      </CheckBoxWrapper>
                    </td>
                    <td>
                      <CheckBoxWrapper>
                        <CheckBoxInnerWrapper
                          onClick={(e) => handleCheckBox(business.id, 'accumulates', !business?.accumulates)}
                          className='accumulates'
                          noClick={!business?.wallet_enabled}
                        >
                          {business?.accumulates ? <CheckSquareFill className='fill' /> : <Square />}
                        </CheckBoxInnerWrapper>
                      </CheckBoxWrapper>
                    </td>
                    <td>
                      <ModifiedWrapper>
                        <ChevronRight />
                        {/* {business.name === 'Grilled' && (
                          <span>{t('MODIFIED', 'Modified')}</span>
                        )} */}
                      </ModifiedWrapper>
                    </td>
                  </tr>
                </TBoday>
              ))}
            </BusinessTable>)}
      </TableWrapper>
      {businessList.businesses?.length > 0 && (
        <Pagination
          currentPage={paginationProps.currentPage}
          totalPages={paginationProps.totalPages}
          handleChangePage={handleChangePage}
          defaultPageSize={paginationProps.pageSize}
          handleChangePageSize={handleChangePageSize}
        />
      )}

      {extraOpen && (
        <>
          {width >= 1100
            ? (
            <SideBar
              isBorderShow
              open={extraOpen}
              defaultSideBarWidth={550}
              sidebarId='loyaltyBusinessDetail'
              onClose={handleCloseBusinessDetail}
            >
              <PointsWalletBusinessDetail
                walletData={selectedBusiness}
                handleUpdateWalletBusiness={handleUpdateWalletBusiness}
                handleUpdateBusinessList={updateBusinessList}
                isBusiness
              />
            </SideBar>
              )
            : (
            <Modal
              width='70%'
              height='90vh'
              padding='0px'
              open={extraOpen}
              onClose={handleCloseBusinessDetail}
            >
              <PointsWalletBusinessDetail
                walletData={selectedBusiness}
                handleUpdateWalletBusiness={handleUpdateWalletBusiness}
                handleUpdateBusinessList={updateBusinessList}
                isBusiness
              />
            </Modal>
              )}
        </>
      )}
      <Alert
        title={t('POINTS_WALLET', 'Points wallet')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </Container>
  )
}

export const PointsWalletBusinessList = (props) => {
  const pointsWalletBusinessListProps = {
    ...props,
    propsToFetch: ['id', 'name', 'logo'],
    UIComponent: PointsWalletBusinessListUI
  }
  return <PointsWalletBusinessListController {...pointsWalletBusinessListProps} />
}
