import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import RiCheckboxBlankLine from '@meronex/icons/ri/RiCheckboxBlankLine'
import RiCheckboxFill from '@meronex/icons/ri/RiCheckboxFill'
import { useTheme } from 'styled-components'
import { ThreeDots, XLg } from 'react-bootstrap-icons'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { useConfig, useLanguage, useSession } from '../../../../../index'
import { Button, IconButton } from '../../../styles'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Tab, TabsContainer } from '../BusinessMenu/styles'
import { Confirm } from '../../Shared'
import { addQueryToUrl } from '../../../utils'
import {
  getPaymentGatewayKeyStatus,
  getPaymentGatewaySettingsPath
} from '../../../../../utils/settingsExternalEditors'

import {
  Container,
  Header,
  CloseButton,
  TabOption,
  TabOptionName,
  ActionSelectorWrapper,
  GatewayStatus
} from './styles'

export const PaymentOptionGlobal = (props) => {
  const {
    open,
    onClose,
    orderTypes,
    sitesState,
    changesState,
    handleChangeBusinessPaymentState,
    cleanChangesState,
    actionState,
    handleSaveClick,
    businessPaymethod,
    handleDeletePaymethod,
    selectedPaymethodGateway
  } = props

  const query = new URLSearchParams(useLocation().search)
  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const { width } = useWindowSize()
  const gatewayStatus = getPaymentGatewayKeyStatus({
    gateway: selectedPaymethodGateway,
    configs
  })
  const gatewaySettingsPath = getPaymentGatewaySettingsPath(selectedPaymethodGateway)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const [paymentTabs, setPaymentTabs] = useState(2)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [localState, setLocalState] = useState({ allowed_order_types: businessPaymethod?.allowed_order_types, sites: businessPaymethod?.sites, devices: businessPaymethod?.devices })
  const filteredOptions = localState?.sites ?? businessPaymethod?.sites?.filter(a => sitesState?.sites?.find(b => a.id === b.id))
  const [all, setAll] = useState(!filteredOptions?.length)

  const setPaymethodInfo = (values) => {
    const data = {}
    if (values?.value === 'All') {
      data[values.key] = []
      setAll(!all)
    } else {
      let array = changesState?.[values.key] ?? (values.key === 'allowed_order_types'
        ? businessPaymethod?.[values.key]
        : businessPaymethod?.[values.key]?.map(i => i.id)) ?? []

      array = [...new Set(
        array.includes(values.value)
          ? array.filter(item => item !== values.value)
          : [...array, values.value]
      )]

      data[values.key] = array.length > 0 ? array : []
      if (values.key === 'sites') {
        setAll(!data?.sites?.length)
      }
    }
    handleChangeBusinessPaymentState(data)
  }

  const actionSidebar = (value) => {
    if (!value) {
      props.onClose()
    }
    setIsMenuOpen(value)
  }

  const onClickDeletePaymethod = () => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('PAYMETHOD_ID', 'Paymethod')),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeletePaymethod(businessPaymethod?.paymethod?.id ?? businessPaymethod?.paymethod_id)
      }
    })
  }

  useEffect(() => {
    if (isMenuOpen) {
      if (width < 1000) {
        document.getElementById('payment_method_option').style.width = '100%'
      } else {
        document.getElementById('payment_method_option').style.width = '500px'
      }
    }
  }, [width])

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open])

  useEffect(() => {
    setPaymentTabs(user?.level === 0 ? 0 : 1)
  }, [sitesState])

  useEffect(() => {
    cleanChangesState({
      sandbox: businessPaymethod?.sandbox,
      allowed_order_types: businessPaymethod?.allowed_order_types || [1, 2, 3, 4, 5]
    })
  }, [businessPaymethod?.id, businessPaymethod?.sandbox, businessPaymethod?.allowed_order_types])

  useEffect(() => {
    const changes = {}
    if (changesState?.allowed_order_types) changes.allowed_order_types = changesState?.allowed_order_types
    if (changesState?.sites) changes.sites = changesState?.sites
    if (Object.keys(changes).length > 0) setLocalState(JSON.parse(JSON.stringify(changes)))
  }, [changesState?.allowed_order_types, changesState?.sites, changesState?.devices])

  const handleTabClick = (tab, isInitialRender) => {
    setPaymentTabs(tab)
    if (!isInitialRender) {
      addQueryToUrl({ paymethod_tab: tab })
    }
  }

  useEffect(() => {
    const payemthodTab = query.get('paymethod_tab')
    if (payemthodTab) {
      const _payemthodTab = Number(payemthodTab)
      handleTabClick(_payemthodTab, true)
    } else {
      handleTabClick(user?.level === 0 ? 0 : 1)
    }
  }, [])

  return (
    <>
      <Container id='payment_method_option'>
        <div>
          <Header>
            <h1>{t(businessPaymethod?.paymethod?.gateway?.toUpperCase() ?? 'PAYMETHOD', businessPaymethod?.paymethod?.name ?? 'Paymethod')}</h1>
            <ActionSelectorWrapper>
              <DropdownButton
                menuAlign={theme?.rtl ? 'left' : 'right'}
                title={<ThreeDots />}
                id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
              >
                <Dropdown.Item
                  onClick={() => onClickDeletePaymethod()}
                >
                  {t('DELETE', 'Delete')}
                </Dropdown.Item>
              </DropdownButton>
            </ActionSelectorWrapper>
            <CloseButton>
              <IconButton
                color='black'
                onClick={() => onClose()}
              >
                <XLg />
              </IconButton>
            </CloseButton>
          </Header>

          <TabsContainer>
            {user?.level === 0 && (
              <Tab
                active={paymentTabs === 0}
                onClick={() => handleTabClick(0)}
              >
                {t('GENERAL', 'General')}
              </Tab>
            )}
            {sitesState?.sites?.length > 0 && (
              <Tab
                active={paymentTabs === 1}
                onClick={() => handleTabClick(1)}
              >
                {t('CHANNELS', 'Channels')}
              </Tab>
            )}
            <Tab
              active={paymentTabs === 2}
              onClick={() => handleTabClick(2)}
            >
              {t('ORDER_TYPE', 'Order type')}
            </Tab>
          </TabsContainer>

          {paymentTabs === 0 && (
            <GatewayStatus>
              <p>
                {gatewayStatus.configured
                  ? t('SETTINGS_PAYMENT_KEYS_CONFIGURED', 'API keys configured')
                  : t('SETTINGS_PAYMENT_KEYS_MISSING', 'API keys missing')}
              </p>
              <Link to={gatewaySettingsPath}>
                {t('SETTINGS_PAYMENT_KEYS_LINK', 'Edit in Settings')}
              </Link>
            </GatewayStatus>
          )}

          {paymentTabs === 1 && sitesState?.sites?.length > 0 && (
            <>
              <TabOption
                key='all'
                onClick={() => setPaymethodInfo({ key: 'sites', value: 'All' })}
              >
                {all
                  ? (
                    <RiCheckboxFill className='fill' />
                    )
                  : (
                    <RiCheckboxBlankLine />
                    )}
                <TabOptionName>{t('ALL', 'All')}</TabOptionName>
              </TabOption>
              {!all && sitesState?.sites.map(site => (
                <TabOption
                  key={site.id}
                  onClick={() => setPaymethodInfo({ key: 'sites', value: site.id })}
                >
                  {(localState?.sites ?? businessPaymethod?.sites?.map(s => s.id))?.includes(site.id)
                    ? (
                      <RiCheckboxFill className='fill' />
                      )
                    : (
                      <RiCheckboxBlankLine />
                      )}
                  <TabOptionName>{site.name}</TabOptionName>
                </TabOption>
              ))}
            </>
          )}

          {paymentTabs === 2 && (
            orderTypes.map(type => (
              <TabOption
                key={type.value}
                onClick={() => setPaymethodInfo({ key: 'allowed_order_types', value: type.value })}
              >
                {(localState?.allowed_order_types ?? businessPaymethod?.allowed_order_types)?.includes(type.value)
                  ? (
                    <RiCheckboxFill className='fill' />
                    )
                  : (
                    <RiCheckboxBlankLine />
                    )}
                <TabOptionName>{type.text}</TabOptionName>
              </TabOption>
            ))
          )}
          {paymentTabs !== 0 && (
            <Button
              borderRadius='5px'
              color='primary'
              disabled={actionState.loading || Object.keys(changesState).length === 0}
              onClick={() => handleSaveClick(businessPaymethod.id)}
            >
              {actionState.loading ? t('LOADING', 'Loading') : t('SAVE', 'Save')}
            </Button>
          )}

        </div>
      </Container>
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
    </>
  )
}
