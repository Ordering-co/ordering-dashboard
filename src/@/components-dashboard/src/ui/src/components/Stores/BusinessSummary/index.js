import React, { useState, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import BsChevronRight from '@meronex/icons/bs/BsChevronRight'
import { useTheme } from 'styled-components'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { XLg, ThreeDots, ArrowsAngleExpand, ArrowsAngleContract, BoxArrowUpRight } from 'react-bootstrap-icons'
import { useLanguage, useUtils, useEvent, useApi, useConfig, useSession } from '~components'
import { Button, IconButton, Switch, Input, ButtonLink } from '../../../styles'
import { Confirm, Modal, Alert, useWindowSize } from '~ui'
import { SnoozeComponent } from '../SnoozeComponent'

import {
  BusinessDetailsContainer,
  DetailsHeader,
  BusinessName,
  LeftHeader,
  RightHeader,
  HeaderCenter,
  ConnectionBadge,
  BusinessHeader,
  BusinessLogo,
  BusinessDetailsContent,
  BusinessDescription,
  BusinessConfigsContainer,
  BusinessConfigItem,
  ActionSelectorWrapper,
  ButtonWrapper
} from './styles'
import { getBusinessConfigSections } from '../../../../../utils/businessConfigSections'
import { EATSTREET_PROJECTS, isBusinessSectionEnabled } from '../../../../../utils/businessDetailSections'
import { useSelectedAccessRole } from '../../../hooks/useUserSelectedAccess'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'

export const BusinessSummary = (props) => {
  const {
    isAdmin,
    businessState,
    actionSidebar,
    handleChangeActiveBusiness,
    selectedItem,
    handleSelectedItem,
    handleDuplicateBusiness,
    handleDeleteBusiness,
    handleUpdateBusinessClick,
    extraOpen,
    spoonityConfig,
    isExpand,
    setIsExpand,
    formState,
    setFormState,
    handleSyncClover,
    cloverState,
    handleInstallClover,
    streamConnectionState
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [events] = useEvent()
  const [{ configs }] = useConfig()

  const theme = useTheme()
  const [ordering] = useApi()
  const { width } = useWindowSize()
  const [isBusinessSnooze, setIsBusinessSnooze] = useState(false)
  const [sessionState] = useSession()
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [alertState, setAlertState] = useState({ open: false, content: [], success: false })

  const isEnabledWhiteLabelModule = configs?.white_label_module?.value
  const isAllowRegisteredBusiness = ((sessionState?.user?.level === 0) || (sessionState?.user?.level === 2 && configs?.allow_business_owner_register_business?.value === '1'))
  const isShowMetafields = configs?.show_metafields && (configs?.show_metafields?.value || configs?.show_metafields?.value === '1')
  const isWebsite26Enabled = !!configs?.web_marketplace_26?.value
  const isReservationsEnabled = configs?.reservation_enabled?.value === '1' && isWebsite26Enabled
  const hasBusinessConfigSections = getBusinessConfigSections(businessState?.business?.configs).length > 0
  const isWhiteLabelStoresEnabled = configs?.whitelabel_stores_sites?.value === '1' || configs?.whitelabel_stores_sites?.value === true ||
    ['luisv4plus', 'eatstreetstaging'].includes(ordering?.project)
  let timeout = null

  const handleOpenCategory = (e) => {
    e.preventDefault()
    events.emit('go_to_page', { page: 'store', params: { store: businessState?.business?.slug } })
  }

  const storeUrl = useStoreWebsiteUrl(businessState?.business?.slug)

  const handleOpenSite = () => {
    if (!storeUrl || businessState?.loading) return
    window.open(storeUrl, '_blank')
  }

  const isEatstreetProject = EATSTREET_PROJECTS.includes(ordering?.project)
  const isSelectedAccessRole = useSelectedAccessRole()

  const isEnabled = (key) => isBusinessSectionEnabled(key, {
    isAdmin,
    isSelectedAccessRole,
    project: ordering?.project,
    configs,
    hasSpoonity: !!spoonityConfig
  })

  const changeCustomSlug = (slug) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (slug === '') {
        setAlertState({
          ...alertState,
          open: true,
          content: [t('SLUG_REQUIRED', 'Slug is required')]
        })
        return
      }
      setFormState({
        ...formState,
        changes: { slug }
      })
    }, 750)
  }

  const closeAlert = () => {
    setAlertState({
      ...alertState,
      open: false,
      content: []
    })
  }
  const businessConfigs = [
    {
      key: 'store_details',
      value: t('STORE_DETAILS', 'Store details'),
      enabled: isEnabled('store_details')
    },
    {
      key: 'schedule',
      value: t('SCHEDULE', 'Schedule'),
      enabled: isEnabled('schedule')
    },
    {
      key: 'menu',
      value: t('MENU_V21', 'Menu'),
      enabled: isEnabled('menu')
    },
    {
      key: 'delivery_pickup_more',
      value: t('DELIVERY_PICKUP_MORE', 'Delivery, pickup & more'),
      enabled: isEnabled('delivery_pickup_more')
    },
    {
      key: 'notifications',
      value: t('NOTIFICATIONS', 'Notifications'),
      enabled: isEnabled('notifications')
    },
    {
      key: 'payment_methods',
      value: t('PAYMENTS_METHODS', 'Payment methods'),
      enabled: isEnabled('payment_methods')
    },
    {
      key: 'tax_fees',
      value: t('TAX_AND_FEES', 'Tax & fees'),
      enabled: isEnabled('tax_fees')
    },
    {
      key: 'promotions',
      value: t('PROMOTIONS', 'Promotions'),
      enabled: isEnabled('promotions')
    },
    {
      key: 'preorder',
      value: t('PREORDERS_SETTING', 'Preorders and lead times'),
      enabled: isEnabled('preorder')
    },
    {
      key: 'custom_fields',
      value: t('CUSTOM_FIELDS', 'Custom fields'),
      enabled: isEnabled('custom_fields') && isShowMetafields
    },
    {
      key: 'personalization',
      value: t('PERSONALIZATION', 'Personalization'),
      enabled: false
    },
    {
      key: 'ordering_channels',
      value: t('ORDERING_CHANNELS', 'Ordering channels'),
      enabled: isEnabled('ordering_channels')
    },
    {
      key: 'publishing',
      value: t('QR_CODES', 'QR Codes'),
      enabled: isEnabled('publishing')
    },
    {
      key: 'sales_channels',
      value: t('SALES_CHANNELS', 'Sales channels'),
      enabled: isEnabled('sales_channels')
    },
    {
      key: 'layout',
      value: t('LAYOUT', 'Layout'),
      enabled: isEnabled('layout')
    },
    {
      key: 'webhooks',
      value: t('WEBHOOKS', 'Webhooks'),
      enabled: isEnabled('webhooks')
    },
    {
      key: 'places',
      value: t('PLACES', 'Places'),
      enabled: false
    },
    {
      key: 'spoonity_key',
      value: t('SPOONITY_KEY', 'Spoonity key'),
      enabled: spoonityConfig
    },
    {
      key: 'logs',
      value: t('LOGS', 'Logs'),
      enabled: isEnabled('logs')
    },
    {
      key: 'reservations',
      value: t('RESERVATIONS', 'Reservations'),
      enabled: isReservationsEnabled
    },
    {
      key: 'configs',
      value: t('INTEGRATIONS_SETTINGS', 'Integrations settings'),
      enabled: isEnabled('configs') && isAdmin && hasBusinessConfigSections
    },
    {
      key: 'markups',
      value: t('MARKUPS', 'Markups'),
      enabled: isEnabled('markups') && isAdmin
    },
    {
      key: 'business_fees',
      value: t('BUSINESS_FEES', 'Business Fees'),
      enabled: isAdmin
    },
    {
      key: 'business_payment_account',
      value: t('BUSINESS_PAYMENT_ACCOUNT', 'Business Payment Account'),
      enabled: !isSelectedAccessRole
    },
    {
      key: 'white_label',
      value: t('WHITE_LABEL', 'White Label'),
      enabled: isAdmin && isWhiteLabelStoresEnabled
    }
  ]

  const onClickDeleteBusiness = () => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_BUSINESS', 'Are you sure that you want to delete this business?'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteBusiness()
      }
    })
  }

  const onClickInstallClover = () => {
    setConfirm({
      open: true,
      content: t('INSTALL_CLOVER_CONFIRM', 'This installs Clover for the whole project. You can connect this store right after.'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleInstallClover()
      }
    })
  }

  const expandSideBar = () => {
    const element = document.getElementById('business_details_bar')
    if (!element) return

    if (isExpand) element.style.width = '500px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  useEffect(() => {
    if (formState.loading || Object.keys(formState?.changes).length === 0 || extraOpen) return
    handleUpdateBusinessClick()
  }, [formState?.changes?.slug, extraOpen])

  const getStreamConnectionLabel = (status) => {
    switch (status) {
      case 'connected':
        return t('CONNECTION_OK', 'Correct connection')
      case 'paused':
        return t('CONNECTION_PAUSED', 'Connection paused')
      case 'disconnected':
        return t('CONNECTION_DISCONNECTED', 'Connection disconnected')
      default:
        return t('CONNECTION', 'Connection')
    }
  }

  return (
    <>
      <BusinessDetailsContainer>
        <DetailsHeader>
          <LeftHeader>
            {businessState?.loading
              ? (
              <BusinessName>
                <Skeleton width={100} />
              </BusinessName>
                )
              : (
              <BusinessName>
                {businessState?.business?.name}
              </BusinessName>
                )}
            {businessState?.loading
              ? (
              <Skeleton width={50} />
                )
              : (
              <Switch
                defaultChecked={businessState?.business?.enabled}
                onChange={handleChangeActiveBusiness}
              />
                )}
          </LeftHeader>
          <RightHeader>
            {width > 576 && !extraOpen && (
              <IconButton
                color='black'
                onClick={() => expandSideBar()}
              >
                {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
              </IconButton>
            )}
            <ActionSelectorWrapper>
              <DropdownButton
                menuAlign={theme?.rtl ? 'left' : 'right'}
                title={<ThreeDots />}
                id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
              >
                <Dropdown.Item
                  onClick={handleOpenSite}
                  disabled={!storeUrl || businessState?.loading}
                >
                  {t('PREVIEW', 'Preview')}
                </Dropdown.Item>
                {isAllowRegisteredBusiness &&
                  <Dropdown.Item
                    onClick={() => handleDuplicateBusiness()}
                  >
                    {t('DUPLICATE', 'Duplicate')}
                  </Dropdown.Item>
                }
                {/* {!isEnabledWhiteLabelModule && (
                  <Dropdown.Item
                    onClick={() => handleSelectedItem('personalization')}
                  >
                    {t('PERSONALIZATION', 'Personalization')}
                  </Dropdown.Item>
                )} */}
                <Dropdown.Item
                  onClick={() => handleSelectedItem('custom_fields')}
                >
                  {t('CUSTOM_FIELDS', 'Custom fields')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => onClickDeleteBusiness()}
                >
                  {t('DELETE', 'Delete')}
                </Dropdown.Item>
              </DropdownButton>
            </ActionSelectorWrapper>
            <IconButton
              color='black'
              onClick={() => actionSidebar(false)}
            >
              <XLg />
            </IconButton>
          </RightHeader>
        </DetailsHeader>
        {streamConnectionState?.enabled && !businessState?.loading && (
          <HeaderCenter>
            {streamConnectionState?.loading && (
              <Skeleton width={130} height={24} />
            )}
            {streamConnectionState?.status && (
              <ConnectionBadge status={streamConnectionState.status}>
                {getStreamConnectionLabel(streamConnectionState.status)}
              </ConnectionBadge>
            )}
          </HeaderCenter>
        )}
        {businessState?.loading
          ? (
          <BusinessHeader isSkeleton>
            <BusinessLogo>
              <Skeleton width={60} height={60} />
            </BusinessLogo>
          </BusinessHeader>
            )
          : (
          <BusinessHeader bgimage={optimizeImage(businessState?.business?.header, 'h_200,c_limit')}>
            <BusinessLogo bgimage={optimizeImage(businessState?.business?.logo || theme.images?.dummies?.businessLogo, 'h_100,c_limit')} />
          </BusinessHeader>
            )}

        <BusinessDetailsContent>
          <ButtonWrapper flexEnd>
            {sessionState?.user?.level === 0 && (cloverState?.installed || cloverState?.error || cloverState?.loading
              ? (
                <Button
                  color='lightPrimary'
                  borderRadius='8px'
                  onClick={() => handleSyncClover()}
                  disabled={businessState?.loading || formState?.loading || cloverState?.loading}
                >
                  {t('CONNECT_CLOVER', 'Connect clover')}
                </Button>
                )
              : (
                <Button
                  color='lightPrimary'
                  borderRadius='8px'
                  onClick={onClickInstallClover}
                  disabled={businessState?.loading || formState?.loading || cloverState?.installing}
                >
                  {cloverState?.installing ? t('INSTALLING', 'Installing...') : t('INSTALL_CLOVER', 'Install Clover')}
                </Button>
                ))}
            <Button
              color='lightGreen'
              borderRadius='8px'
              onClick={() => setIsBusinessSnooze(true)}
              disabled={businessState?.loading}
            >
              {t('SNOOZE', 'Snooze')}
            </Button>
          </ButtonWrapper>
          <ButtonWrapper>
            <ButtonLink
              color='lightPrimary'
              borderRadius='8px'
              onClick={handleOpenCategory}
              disabled={businessState?.loading}
              href={`/stores/products/${businessState?.business?.slug}`}
              role='link'
            >
              {t('CATEGORIES_AND_PRODUCTS', 'Categories & products')}
            </ButtonLink>
            {!(!isAdmin && isEatstreetProject) && (
              <Input
                type='text'
                defaultValue={businessState?.business?.slug || ''}
                placeholder={t('SLUG', 'Slug')}
                onChange={(e) => changeCustomSlug(e.target.value)}
                onKeyPress={(e) => {
                  if (!/^[0-9a-zA-Z]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            )}
            {!isEnabledWhiteLabelModule && (
              <IconButton
                className='redirect-website'
                disabled={businessState?.loading || !storeUrl}
                onClick={handleOpenSite}
              >
              <BoxArrowUpRight />
            </IconButton>
            )}
          </ButtonWrapper>
          <BusinessDescription>
            {businessState?.loading
              ? (
              <Skeleton width={300} />
                )
              : (
                  businessState?.business?.description
                )}
          </BusinessDescription>
          <BusinessConfigsContainer isLoading={businessState?.loading}>
            {businessConfigs.map(config => (
              config.enabled && (
                <BusinessConfigItem
                  key={config.key}
                  active={selectedItem === config.key}
                  onClick={() => handleSelectedItem(config.key)}
                >
                  <span>{config.value}</span>
                  <BsChevronRight />
                </BusinessConfigItem>
              ))
            )}
          </BusinessConfigsContainer>
        </BusinessDetailsContent>
      </BusinessDetailsContainer>
      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
      <Alert
        title={t('BUSINESS', 'Business')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      <Modal
        width='85%'
        maxWidth='1000px'
        open={isBusinessSnooze}
        onClose={() => setIsBusinessSnooze(false)}
        closeOnBackdrop={false}
      >
        <SnoozeComponent
          dataState={businessState?.business}
          handleUpdate={handleUpdateBusinessClick}
          setFormState={setFormState}
          formState={formState}
          onClose={() => setIsBusinessSnooze(false)}
        />
      </Modal>
    </>
  )
}
