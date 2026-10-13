import React, { useState, useEffect, useRef } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useHistory, useLocation } from 'react-router-dom'
import BsChevronRight from '@meronex/icons/bs/BsChevronRight'
import { ArrowsAngleContract, ArrowsAngleExpand } from 'react-bootstrap-icons'
import { useLanguage, CheckoutFieldsSetting as CheckoutFieldsSettingController } from '../../../../../index'
import { IconButton, Switch } from '../../../styles'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { SideBar, Alert } from '../../Shared'
import { getCodeNames } from '../../../utils'

import {
  CheckoutFieldsDetailsContainer,
  FieldContainer,
  SitesListContainer,
  Header,
  SitesWrapper,
  SiteItem
} from './styles'

const CheckoutFieldsSettingUI = (props) => {
  const {
    checkoutFieldsState,
    handleChangeCheckoutFieldSetting,
    sitesState,
    setMoveDistance,
    selectedSiteId,
    setSelectedSiteId,
    actionState,
    avoidExpand,
    sidebarSettingContainer
  } = props

  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const history = useHistory()
  const container = useRef(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const query = new URLSearchParams(useLocation().search)

  const [isExpand, setIsExpand] = useState(false)

  const orderValidationFields = ['name', 'middle_name', 'lastname', 'second_lastname', 'email', 'mobile_phone', 'city_dropdown_option', 'address', 'zipcode', 'address_notes', 'coupon', 'driver_tip', 'comments', 'birthdate']

  const handleOpenSiteSettingDetails = (siteId, isInitialRender) => {
    // handleGetSiteConfigs(siteId)
    setSelectedSiteId(siteId)
    setMoveDistance && setMoveDistance(500)
    if (!isInitialRender) {
      const category = query.get('category')
      history.replace(`${location.pathname}?category=${category}&site=${siteId}`)
    }
  }

  const expandSideBar = () => {
    const element = document.getElementById('sideSlider')
    if (isExpand) element.style.width = '500px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  const handleCloseDetails = () => {
    setSelectedSiteId(null)
    setMoveDistance && setMoveDistance(0)
    const category = query.get('category')
    history.replace(`${location.pathname}?category=${category}`)
  }

  useEffect(() => {
    if (!actionState?.error) return
    setAlertState({
      open: true,
      content: actionState?.error
    })
  }, [actionState?.error])

  return (
    <>
      <SitesListContainer>
        <Header>
          <h1>{t('CART_CUSTOMER_FIELDS', 'Cart and Customer fields')}</h1>
          {!avoidExpand && width > 576 && !selectedSiteId && (
            <IconButton
              color='black'
              onClick={expandSideBar}
            >
              {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
            </IconButton>
          )}
        </Header>
        {sitesState.loading
          ? (
          <SitesWrapper>
            {[...Array(5).keys()].map(i => (
              <SiteItem key={i}>
                <Skeleton width={100} height={14} />
              </SiteItem>
            ))}
          </SitesWrapper>
            )
          : (
          <SitesWrapper ref={container}>
            {sitesState.sites.map(site => (
              <SiteItem
                key={site.id}
                active={site.id === selectedSiteId}
                onClick={() => handleOpenSiteSettingDetails(site.id)}
              >
                <span>{getCodeNames(site.code, t)}</span>
                <BsChevronRight />
              </SiteItem>
            ))}
          </SitesWrapper>
            )}
      </SitesListContainer>
      {selectedSiteId && (
        <SideBar
          isBorderShow
          isCloseOutsideClick
          containerRef={container}
          sidebarSettingContainer={sidebarSettingContainer}
          open={selectedSiteId}
          onClose={() => handleCloseDetails()}
        >
          <CheckoutFieldsDetailsContainer>
            <h1>{t('SETTINGS', 'Settings')}</h1>
            <FieldContainer isHeader>
              <div className='name'>{t('FIELD', 'Field')}</div>
              <div className='required'>{t('REQUIRED', 'Required')}</div>
              <div className='status'>{t('STATE', 'Status')}</div>
            </FieldContainer>
            {(actionState?.loading && actionState?.isPost)
              ? (
                  [...Array(10).keys()].map(i => (
                <FieldContainer key={i}>
                  <div className='name'><Skeleton width={120} /></div>
                  <div className='required'>
                    <Skeleton width={30} style={{ borderRadius: 20 }} />
                  </div>
                  <div className='status'>
                    <Skeleton width={30} style={{ borderRadius: 20 }} />
                  </div>
                </FieldContainer>
                  ))
                )
              : (
              <>
                {checkoutFieldsState.fields
                  .filter(item => item?.site_id === parseInt(selectedSiteId))
                  .sort((a, b) => {
                    const indexA = orderValidationFields.indexOf(a?.validation_field.code)
                    const indexB = orderValidationFields.indexOf(b?.validation_field.code)
                    return indexA - indexB
                  })
                  .map(field => (
                    <FieldContainer key={field.id}>
                      <div className='name'>{t(field?.validation_field?.code.toUpperCase(), field?.validation_field?.name)}</div>
                      <div className='required'>
                        <Switch
                          defaultChecked={field.required}
                          disabled={field?.validation_field?.code === 'email'}
                          onChange={(val) => handleChangeCheckoutFieldSetting(field.validation_field_id, selectedSiteId, { required: val })}
                        />
                      </div>
                      <div className='status'>
                        <Switch
                          defaultChecked={field.enabled}
                          disabled={field?.validation_field?.code === 'email'}
                          onChange={(val) => handleChangeCheckoutFieldSetting(field.validation_field_id, selectedSiteId, { enabled: val })}
                        />
                      </div>
                    </FieldContainer>
                  ))}
              </>
                )}
          </CheckoutFieldsDetailsContainer>
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
export const CheckoutFieldsSetting = (props) => {
  const checkoutFieldsProps = {
    ...props,
    UIComponent: CheckoutFieldsSettingUI
  }
  return <CheckoutFieldsSettingController {...checkoutFieldsProps} />
}
