import React, { useState, useEffect, useRef } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useHistory, useLocation } from 'react-router-dom'
import { ChevronRight } from '../../Shared/Icon'
import { ArrowsAngleContract, ArrowsAngleExpand } from 'react-bootstrap-icons'
import { useLanguage, CheckoutFieldsSetting as CheckoutFieldsSettingController } from '../../../../../index'
import { IconButton } from '../../../styles'
import { Switch } from '../../Shared/Product/Switch'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { SideBar, Alert } from '../../Shared'
import { getCodeNames } from '../../../utils'
import { validationFieldLabel } from '../../../utils/validationFieldLabel'

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

  // the panel says which channel it is, and each switch which field and column it is
  const selectedSite = (sitesState?.sites || []).find(site => site.id === selectedSiteId)
  const panelTitle = selectedSite?.code
    ? t('CHECKOUT_FIELDS_SITE_SETTINGS', 'Settings for _site_').replace('_site_', getCodeNames(selectedSite.code, t))
    : t('SETTINGS', 'Settings')
  const switchName = (column, fieldName) => t('CHECKOUT_FIELD_SWITCH_NAME', '_column_: _field_').replace('_column_', column).replace('_field_', fieldName)

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
          <h1>{t('CART_CUSTOMER_FIELDS', 'Cart and customer fields')}</h1>
          {!avoidExpand && width > 576 && !selectedSiteId && (
            <IconButton
              color='black'
              aria-label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
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
                <ChevronRight />
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
            <h1>{panelTitle}</h1>
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
                  .map(field => {
                    const fieldName = validationFieldLabel(t, field?.validation_field)
                    return (
                    <FieldContainer key={field.id}>
                      <div className='name'>{fieldName}</div>
                      <div className='required'>
                        <Switch
                          label={switchName(t('REQUIRED', 'Required'), fieldName)}
                          defaultChecked={field.required}
                          disabled={field?.validation_field?.code === 'email'}
                          onCheckedChange={(val) => handleChangeCheckoutFieldSetting(field.validation_field_id, selectedSiteId, { required: val })}
                        />
                      </div>
                      <div className='status'>
                        <Switch
                          label={switchName(t('STATE', 'Status'), fieldName)}
                          defaultChecked={field.enabled}
                          disabled={field?.validation_field?.code === 'email'}
                          onCheckedChange={(val) => handleChangeCheckoutFieldSetting(field.validation_field_id, selectedSiteId, { enabled: val })}
                        />
                      </div>
                    </FieldContainer>
                    )
                  })}
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
