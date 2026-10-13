import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useApi, useLanguage, useSession } from '../../../../../index'
import RiCheckboxBlankLine from '@meronex/icons/ri/RiCheckboxBlankLine'
import RiCheckboxFill from '@meronex/icons/ri/RiCheckboxFill'
import { Button, IconButton, Checkbox } from '../../../styles'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useTheme } from 'styled-components'
import { ThreeDots, XLg, Eye, EyeSlash, Link } from 'react-bootstrap-icons'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { Alert, Confirm } from '../../Shared'
import { addQueryToUrl } from '../../../utils'
import { filterPaymethodFieldsByRole, getMercadoPagoSetupUrl, isMercadoPagoConnectGateway, openMercadoPagoSetupPopup } from '../../../utils/mercadoPagoConnect'

import {
  Container,
  SandboxWrapper,
  Header,
  CloseButton,
  ActionSelectorWrapper,
  BodyContainer,
  FormContainer,
  PasswordInputWrapper,
  ConnectButton
} from './styles'

import { Tab, TabsContainer } from '../BusinessMenu/styles'
import { TabOption, TabOptionName } from '../PaymentOptionStripeDirect/styles'
import { FormGroupText, Description, GeneralContainer } from '../../Settings/SettingsList/styles'
import { useForm } from 'react-hook-form'

export const PaymentOptionConfig = (props) => {
  const {
    business,
    open,
    onClose,
    changesState,
    cleanChangesState,
    actionState,
    sitesState,
    orderTypes,
    handleSaveClick,
    businessPaymethod,
    handleChangeBusinessPaymentState,
    handleDeletePaymethod,
    defaultPaymethodState,
    handleChangeInput,
    handleChangeSandbox,
    paymethodTitle
  } = props

  const query = new URLSearchParams(useLocation().search)
  const theme = useTheme()
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ user }] = useSession()
  const { width } = useWindowSize()
  const formMethods = useForm()
  const mercadoPagoSetupUrl = isMercadoPagoConnectGateway(defaultPaymethodState?.gateway)
    ? getMercadoPagoSetupUrl({ project: ordering?.project, businessId: business?.id })
    : null
  const [alertState, setAlertState] = useState({ open: false, content: null })
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [paymentTabs, setPaymentTabs] = useState(0)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [localState, setLocalState] = useState({ allowed_order_types: businessPaymethod?.allowed_order_types, sites: businessPaymethod?.sites })
  const filteredOptions = localState?.sites ?? businessPaymethod?.sites?.filter(a => sitesState?.sites?.find(b => a.id === b.id))
  const [all, setAll] = useState(!filteredOptions?.length)
  const [showPasswordFields, setShowPasswordFields] = useState({})

  const mapDataTemplate = useCallback((template, prefix) =>
    filterPaymethodFieldsByRole(template, { gateway: defaultPaymethodState?.gateway, userLevel: user?.level }).map(i => ({
      name: t(`${defaultPaymethodState?.gateway?.toUpperCase()}_${i.name?.toUpperCase()}`, i.name),
      key: i.key,
      formKey: `${prefix}_${i.key}`,
      type: i.type,
      defaultValue: i.default_value,
      required: i.required
    })), [defaultPaymethodState?.gateway, user?.level])

  const inputs = useMemo(() =>
    mapDataTemplate(defaultPaymethodState?.data_template, 'data'),
  [defaultPaymethodState, mapDataTemplate])

  const sandboxInputs = useMemo(() =>
    mapDataTemplate(defaultPaymethodState?.data_template, 'data_sandbox'),
  [defaultPaymethodState, mapDataTemplate])

  const actionSidebar = (value) => {
    if (!value) {
      props.onClose()
    }
    setIsMenuOpen(value)
  }

  const togglePasswordVisibility = (fieldKey) => {
    setShowPasswordFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }))
  }

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

  const onClickDeletePaymethod = () => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('PAYMETHOD_ID', 'Paymethod')),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeletePaymethod(businessPaymethod?.paymethod?.id)
      }
    })
  }

  const onSubmit = () => {
    const data = JSON.parse(JSON.stringify(changesState?.data || {}))
    const dataSandbox = JSON.parse(JSON.stringify(changesState?.data_sandbox || {}))
    const isSandbox = changesState?.sandbox ?? businessPaymethod?.sandbox

    const validateRequiredFields = (inputFields, dataObj) => {
      const missingFields = inputFields.filter(input =>
        input.required && (dataObj[input.key] === '' || dataObj[input.key] === null || dataObj[input.key] === undefined)
      )

      if (missingFields.length > 0) {
        setAlertState({
          open: true,
          content: missingFields.map(field =>
            t(`VALIDATION_ERROR_${field.name}_REQUIRED`,
              `The field ${field.name.replace(/_/g, ' ')} is required`)
          )
        })
        return false
      }
      return true
    }

    // Validate fields based on sandbox mode
    if ((isSandbox && !validateRequiredFields(sandboxInputs, dataSandbox)) ||
      (!isSandbox && !validateRequiredFields(inputs, data))) {
      return
    }

    // All validations passed, save changes
    handleSaveClick(businessPaymethod.id, {
      notUpdateData: isSandbox,
      notUpdateDataSandbox: !isSandbox
    })
  }

  useEffect(() => {
    if (isMenuOpen) {
      if (width < 1000) {
        document.getElementById('payment_config').style.width = '100%'
      } else {
        document.getElementById('payment_config').style.width = '500px'
      }
    }
  }, [width])

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open])

  useEffect(() => {
    if (actionState?.loading) return
    const initState = {
      sandbox: businessPaymethod?.sandbox,
      allowed_order_types: businessPaymethod?.allowed_order_types || [1, 2, 3, 4, 5]
    }
    if (businessPaymethod?.data) {
      initState.data = businessPaymethod.data
    }
    if (businessPaymethod?.data_sandbox) {
      initState.data_sandbox = businessPaymethod.data_sandbox
    }
    cleanChangesState(initState)
  }, [actionState?.loading])

  useEffect(() => {
    const changes = {}
    if (changesState?.allowed_order_types) changes.allowed_order_types = changesState?.allowed_order_types
    if (changesState?.sites) changes.sites = changesState?.sites
    if (Object.keys(changes).length > 0) setLocalState(JSON.parse(JSON.stringify(changes)))
  }, [changesState?.sites, changesState?.allowed_order_types])

  const handleTabClick = (tab, isInitialRender) => {
    setPaymentTabs(tab)
    if (!isInitialRender) {
      addQueryToUrl({ paymethod_tab: tab })
    }
  }

  useEffect(() => {
    const payemthodTab = query.get('paymethod_tab')
    if (payemthodTab) {
      handleTabClick(Number(payemthodTab), true)
    } else {
      handleTabClick(0)
    }
  }, [])

  useEffect(() => {
    if (Object.keys(formMethods.errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(formMethods.errors).map(error => error.message)
      })
    }
  }, [formMethods.errors])

  return (
    <>
      <Container id='payment_config'>
        <Header>
          <h1>{paymethodTitle}</h1>
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
          <Tab
            active={paymentTabs === 0}
            onClick={() => handleTabClick(0)}
          >
            {t('GENERAL', 'General')}
          </Tab>
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
        <BodyContainer>
          {paymentTabs === 0 && (
            <>
              {
                defaultPaymethodState && (
                  <GeneralContainer>
                    <FormContainer onSubmit={formMethods.handleSubmit(onSubmit)}>
                      {mercadoPagoSetupUrl && (
                        <ConnectButton
                          type='button'
                          onClick={() => openMercadoPagoSetupPopup(mercadoPagoSetupUrl)}
                        >
                          <span><Link /></span>
                          <span>{t('CONNECT_WITH_MERCADO_PAGO', 'Connect with Mercado Pago')}</span>
                        </ConnectButton>
                      )}
                      <SandboxWrapper>
                        <Checkbox
                          checked={changesState?.sandbox ?? businessPaymethod?.sandbox}
                          onChange={e => handleChangeSandbox(e.target.checked)}
                        />
                        <span>{t('SANDBOX_MODE', 'Sandbox Mode')}</span>
                      </SandboxWrapper>
                      {
                        (changesState?.sandbox ?? businessPaymethod?.sandbox) && sandboxInputs.length > 0 && sandboxInputs.map((input, i) => (
                          <div key={i}>
                            {
                              (input.type === 'text' || input.type === 'password') && (
                                <FormGroupText className='form-group'>
                                  <label>{input?.name}</label>
                                  {input?.description && <Description>{input?.description}</Description>}
                                  {input.type === 'password'
                                    ? (
                                    <PasswordInputWrapper>
                                      <input
                                        type={showPasswordFields[`sandbox_${input?.key}`] ? 'text' : 'password'}
                                        name={input?.formKey}
                                        defaultValue={typeof changesState?.data_sandbox?.[input?.key] === 'string'
                                          ? changesState?.data_sandbox?.[input?.key]
                                          : businessPaymethod?.data_sandbox?.[input?.key]}
                                        onChange={(e) => handleChangeInput({ target: { name: input?.key, value: e.target?.value } }, true)}
                                        className='form-control'
                                        placeholder={input?.name}
                                      />
                                      <button
                                        type='button'
                                        onClick={() => togglePasswordVisibility(`sandbox_${input?.key}`)}
                                      >
                                        {showPasswordFields[`sandbox_${input?.key}`] ? <EyeSlash /> : <Eye />}
                                      </button>
                                    </PasswordInputWrapper>
                                      )
                                    : (
                                    <input
                                      type='text'
                                      name={input?.formKey}
                                      defaultValue={typeof changesState?.data_sandbox?.[input?.key] === 'string'
                                        ? changesState?.data_sandbox?.[input?.key]
                                        : businessPaymethod?.data_sandbox?.[input?.key]}
                                      onChange={(e) => handleChangeInput({ target: { name: input?.key, value: e.target?.value } }, true)}
                                      className='form-control'
                                      placeholder={input?.name}
                                    />
                                      )}
                                </FormGroupText>
                              )
                            }
                          </div>
                        ))
                      }
                      {
                        !(changesState?.sandbox ?? businessPaymethod?.sandbox) && inputs.length > 0 && inputs.map((input, i) => (
                          <div key={i}>
                            {
                              (input.type === 'text' || input.type === 'password') && (
                                <FormGroupText className='form-group'>
                                  <label>{input?.name}</label>
                                  {input?.description && <Description>{input?.description}</Description>}
                                  {input.type === 'password'
                                    ? (
                                    <PasswordInputWrapper>
                                      <input
                                        type={showPasswordFields[input?.key] ? 'text' : 'password'}
                                        name={input?.formKey}
                                        defaultValue={changesState?.data?.[input?.key]
                                          ? changesState?.data?.[input?.key]
                                          : businessPaymethod?.data?.[input?.key]}
                                        onChange={(e) => handleChangeInput({ target: { name: input?.key, value: e.target?.value } }, false)}
                                        ref={formMethods.register({
                                          required: input?.required ? t(`VALIDATION_ERROR_${input.key}_REQUIRED`, `The field ${input.key.replace(/_/g, ' ')} is required`) : null
                                        })}
                                        className='form-control'
                                        placeholder={input?.name}
                                      />
                                      <button
                                        type='button'
                                        onClick={() => togglePasswordVisibility(input?.key)}
                                      >
                                        {showPasswordFields[input?.key] ? <EyeSlash /> : <Eye />}
                                      </button>
                                    </PasswordInputWrapper>
                                      )
                                    : (
                                    <input
                                      type='text'
                                      name={input?.formKey}
                                      defaultValue={changesState?.data?.[input?.key]
                                        ? changesState?.data?.[input?.key]
                                        : businessPaymethod?.data?.[input?.key]}
                                      onChange={(e) => handleChangeInput({ target: { name: input?.key, value: e.target?.value } }, false)}
                                      ref={formMethods.register({
                                        required: input?.required ? t(`VALIDATION_ERROR_${input.key}_REQUIRED`, `The field ${input.key.replace(/_/g, ' ')} is required`) : null
                                      })}
                                      className='form-control'
                                      placeholder={input?.name}
                                    />
                                      )}
                                </FormGroupText>
                              )
                            }
                          </div>
                        ))
                      }
                      <Button
                        borderRadius='5px'
                        color='primary'
                        disabled={actionState.loading || Object.keys(changesState).length === 0}
                        type='submit'
                      >
                        {actionState.loading ? t('LOADING', 'Loading') : t('SAVE', 'Save')}
                      </Button>
                    </FormContainer>
                  </GeneralContainer>
                )
              }
            </>
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

        </BodyContainer>
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
      <Alert
        width='800px'
        title={t('INTERSWITCH', 'Interswitch')}
        content={alertState.content}
        acceptText={t('ACCEPT')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}
