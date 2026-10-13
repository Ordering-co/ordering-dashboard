import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  useLanguage,
  useConfig,
  BusinessPaymethods as BusinessPaymentMethodsController,
  useSession
} from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Modal, SearchBar, Alert, Confirm } from '../../Shared'
import { Button } from '../../../styles'
import { PaymentOptionStripeDirect } from '../PaymentOptionStripeDirect'
import { PaymentOptionStripeLink } from '../PaymentOptionStripeLink'
import { PaymentOption } from '../PaymentOption'
import { PaymethodOptionPaypalExpress } from '../PaymethodOptionPaypalExpress'
import { PaymethodOptionStripeConnect } from '../PaymethodOptionStripeConnect'
import { PaymentOptionPaypal } from '../PaymentOptionPaypal'
import { PaymentOptionSquare } from '../PaymentOptionSquare'
import { PaymentOptionMethods } from '../PaymentOptionMethods'
import { PaymentOptionCredomatic } from '../PaymentOptionCredomatic'
import { BusinessWalletsList } from '../BusinessWalletsList'
import { PaymentOptionGlobal } from '../PaymentOptionGlobal'
import { PaymentOptionMercadoPago } from '../PaymentOptionMercadoPago'
import { PaymentOptionEpayco } from '../PaymentOptionEpayco'
import { PaymentOptionConfig } from '../PaymentOptionConfig'
import { addQueryToUrl, removeQueryToUrl, capitalize } from '../../../utils'
import { useSelectedAccessRole } from '../../../hooks/useUserSelectedAccess'

import {
  MainContainer,
  PaymentMethodsContainer,
  PaymethodListWrapper,
  PaymethodOptionContainer,
  PaymethodOption,
  PaymethodName,
  SearchBarWrapper,
  ButtonGroup,
  Divider,
  CreditCardPaymentsContainer
} from './styles'
import { getUtils } from './utils'
import { consumePendingInstallOpen } from '../../../../../utils/paymentPluginCatalog'
import { getDisplayPaymethods } from './getDisplayPaymethods'
import { PaymethodRow } from './PaymethodRow'

const BusinessPaymentMethodsUI = (props) => {
  const {
    business,
    businessPaymethodsState,
    paymethodsList,
    handleClickPayment,
    handleSelectAllPaymethods,
    // handleSelectNonePaymethods,
    handleDeleteBusinessPaymethodOption,
    setIsExtendExtraOpen,
    actionState,
    changesState,
    sitesState,
    deviceState,
    stripeConnectData,
    handleChangeBusinessPaymentState,
    handleChangeStripeConnectData,
    cleanChangesState,
    handleChangeSandbox,
    handleChangeInput,
    handleSaveClick,
    handleStripeConnect,
    handleChangeStripeInput,
    handleStripeSave,
    isSuccessDeleted,
    setIsSuccessDeleted,
    handleSuccessPaymethodUpdate,
    handleSuccessUpdate,
    isTutorialMode,
    handleTutorialContinue,
    pluginsState,
    installingPluginKey,
    handleInstallPaymentPlugin
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const isSelectedAccessRole = useSelectedAccessRole()
  const { width } = useWindowSize()
  const { orderTypesValues, paymentsGlobalConfigs, checkBusinessPaymethodConfigs } = getUtils()
  const [isEdit, setIsEdit] = useState(false)
  const [selectedBusinessPaymethod, setSelectedBusinessPaymethod] = useState(null)
  const [selectedPaymethodGateway, setSelectedPaymethodGateway] = useState(null)
  const [searchValue, setSearchValue] = useState('')
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [installConfirm, setInstallConfirm] = useState({ open: false, pluginKey: null, name: '' })
  const [pendingOpenPluginKey, setPendingOpenPluginKey] = useState(null)
  const [isOpenWalletDetails, setIsOpenWalletDetails] = useState(false)
  const isWalletCashEnabled = configs?.wallet_enabled?.value === '1'
  const [excludePaymethods, setExcludedPaymethods] = useState([])
  const [creditCardPymethods, setCreditCardPaymethods] = useState([])
  const isAddonMercadoPago = configs?.mercadopago_sandbox_mode
  const orderTypes = orderTypesValues()

  const braintreePaymethods = ['braintree', 'google_pay_braintree', 'apple_pay_braintree', 'paypal_braintree']
  const methodsPay = ['google_pay', 'apple_pay']
  const globalPayments = ['global_google_pay', 'global_apple_pay', 'stripe', 'computop']
  const noKeyPayments = ['cash', 'card_delivery', 'izipay', 'physical_terminal', 'stripe_terminal', 'hyp', 'giftme']
  const stripeDirectMethods = ['stripe_checkout']
  const paymethodsWithDataTemplate = useMemo(() => paymethodsList?.paymethods?.filter(paymethod => paymethod?.data_template !== null).map(paymethod => paymethod?.gateway), [paymethodsList])

  const gatewayProviderLabels = {
    google_pay: 'Stripe',
    apple_pay: 'Stripe',
    google_pay_braintree: 'Braintree',
    apple_pay_braintree: 'Braintree',
    paypal_braintree: 'Braintree'
  }

  const getPaymethodDisplayName = (paymethod) => {
    const name = t(paymethod?.gateway?.toUpperCase(), paymethod?.name)
    const provider = gatewayProviderLabels[paymethod?.gateway]
    return provider ? `${name} (with ${provider})` : name
  }

  const displayPaymethods = useMemo(() => {
    return getDisplayPaymethods({
      paymethods: paymethodsList?.paymethods,
      plugins: pluginsState?.plugins,
      excludeGateways: excludePaymethods,
      isTutorialMode
    })
  }, [paymethodsList?.paymethods, pluginsState?.plugins, excludePaymethods, isTutorialMode])

  const matchesPaymethodSearch = (paymethod) => {
    const queryValue = searchValue?.toLowerCase() || ''
    if (!queryValue) return true
    const displayName = getPaymethodDisplayName(paymethod).toLowerCase()
    return displayName.includes(queryValue) || paymethod?.name?.toLowerCase().includes(queryValue)
  }

  const visiblePaymethods = displayPaymethods.filter(paymethod => (
    !creditCardPymethods.includes(paymethod.gateway) &&
    matchesPaymethodSearch(paymethod) &&
    (!isSelectedAccessRole || braintreePaymethods.includes(paymethod.gateway))
  ))

  const visibleCreditCardPaymethods = displayPaymethods.filter(paymethod => (
    creditCardPymethods.includes(paymethod.gateway) &&
    matchesPaymethodSearch(paymethod)
  ))

  const closeInstallConfirm = () => {
    setInstallConfirm({ open: false, pluginKey: null, name: '' })
  }

  const handleRequestInstall = (paymethod) => {
    setInstallConfirm({
      open: true,
      pluginKey: paymethod.pluginKey,
      name: getPaymethodDisplayName(paymethod)
    })
  }

  const handleAcceptInstall = async () => {
    const pluginKey = installConfirm.pluginKey
    closeInstallConfirm()
    if (!pluginKey) return
    const result = await handleInstallPaymentPlugin?.(pluginKey)
    if (result === pluginKey) setPendingOpenPluginKey(pluginKey)
  }

  const specialPayments = ['paypal',
    'paypal_express',
    'stripe_connect',
    'stripe_link',
    'square',
    'credomatic',
    'checkout_pro_mercadopago',
    'stripe_checkout',
    'epayco',
    ...paymethodsWithDataTemplate,
    ...globalPayments,
    ...methodsPay
  ]

  const paymethodSelected = useMemo(() => {
    return paymethodsList?.paymethods?.find(paymethod => selectedPaymethodGateway === paymethod?.gateway) || null
  }, [paymethodsList, selectedPaymethodGateway])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const isCheckEnableState = (id) => {
    const found = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === id)
    let valid = false
    if (found) {
      valid = found.enabled
    }
    return valid
  }

  const isCheckFoundBusinessPaymethod = (id) => {
    const found = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === id)
    return found
  }

  const handleOpenEdit = (e, paymethodId, paymethodGateway, isInitialRender) => {
    const inValid = e?.target?.closest('.paymethod-checkbox')
    if (inValid) return true
    if (!isTutorialMode && isCheckFoundBusinessPaymethod(paymethodId)) {
      setSelectedPaymethodGateway(paymethodGateway)
      const businessPaymethod = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === paymethodId)
      setSelectedBusinessPaymethod(businessPaymethod)
      setIsEdit(true)
      setIsExtendExtraOpen(true)
    } else if (!isTutorialMode && !isCheckFoundBusinessPaymethod(paymethodId)) {
      handleClickCheckBox(paymethodId, false)
      setSelectedPaymethodGateway(paymethodGateway)
      const businessPaymethod = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === paymethodId)
      setSelectedBusinessPaymethod(businessPaymethod)
      setIsEdit(true)
      setIsExtendExtraOpen(true)
    }
    if (!isInitialRender) {
      addQueryToUrl({ paymethod: paymethodId })
    }
  }

  useEffect(() => {
    const next = consumePendingInstallOpen(pendingOpenPluginKey, paymethodsList?.paymethods)
    if (!next.paymethod) return
    setPendingOpenPluginKey(null)
    handleOpenEdit(null, next.paymethod.id, next.paymethod.gateway)
  }, [pendingOpenPluginKey, paymethodsList?.paymethods])

  const handleClickCheckBox = (id, isCheckbox) => {
    let i = 0
    let currentPaymentData = null
    paymethodsList.paymethods.forEach(paymethod => {
      if (isCheckEnableState(paymethod.id)) {
        i += 1
      }
      if (paymethod.id === id) {
        currentPaymentData = paymethod
      }
    })

    if (isCheckEnableState(id) && i < 2) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_MIN_ARRAY', 'The _attribute_ must have at least _min_ items.').replace('_attribute_', t('PAYMETHODS', 'Payment methods')).replace('_min_', t('ONE', 'one'))
      })
      return
    }
    const businessPaymethod = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === id)

    if (
      globalPayments.includes(currentPaymentData?.gateway) &&
      paymentsGlobalConfigs[currentPaymentData?.gateway] &&
      user?.level !== 0
    ) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_STRIPE_PAYMENT', 'Please contact administrator')
      })
      return
    }
    const isDataTemplateRequired = !currentPaymentData?.data_template || (currentPaymentData?.data_template?.length && currentPaymentData?.data_template?.some(item => item?.required))
    if ((isDataTemplateRequired || !isCheckbox) && !noKeyPayments.includes(currentPaymentData?.gateway) && businessPaymethod &&
      !isCheckEnableState(id) && ((!globalPayments.includes(currentPaymentData?.gateway) && checkBusinessPaymethodConfigs(businessPaymethod)) ||
        (globalPayments.includes(currentPaymentData?.gateway) && paymentsGlobalConfigs[currentPaymentData?.gateway]))
    ) {
      setSelectedPaymethodGateway(currentPaymentData?.gateway)
      setSelectedBusinessPaymethod(businessPaymethod)
      setIsEdit(true)
      setIsExtendExtraOpen(true)
      addQueryToUrl({ paymethod: id })
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_EMPTY_DATA', 'Please fill all the data to activate the payment method (sandbox mode is opcional)')
      })
      return
    }

    handleClickPayment && handleClickPayment(id, (payment) => {
      setSelectedPaymethodGateway(currentPaymentData?.gateway)
      setSelectedBusinessPaymethod(payment)
      setIsEdit(true)
      setIsExtendExtraOpen(true)
      addQueryToUrl({ paymethod: id })
    })
  }

  const handleCloseEdit = () => {
    setIsExtendExtraOpen(false)
    setIsEdit(false)
    setSelectedBusinessPaymethod(null)
    setIsSuccessDeleted(false)
    removeQueryToUrl(['paymethod'])
  }

  useEffect(() => {
    if (!isSuccessDeleted) return
    handleCloseEdit()
  }, [isSuccessDeleted])

  useEffect(() => {
    if (!selectedBusinessPaymethod) return
    const updatedPaymethod = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === selectedBusinessPaymethod.paymethod_id)
    setSelectedBusinessPaymethod(updatedPaymethod)
  }, [businessPaymethodsState?.paymethods, selectedBusinessPaymethod])

  useEffect(() => {
    if (!selectedBusinessPaymethod) return
    const updatedPaymethod = businessPaymethodsState?.paymethods?.find(paymethod => paymethod?.paymethod_id === selectedBusinessPaymethod?.paymethod_id)
    let currentPaymentData = null
    paymethodsList.paymethods.forEach(paymethod => {
      if (paymethod.id === updatedPaymethod?.paymethod_id) {
        currentPaymentData = paymethod
      }
    })

    const isDataTemplateRequired = !currentPaymentData?.data_template || (currentPaymentData?.data_template?.length && currentPaymentData?.data_template?.some(item => item?.required))
    if (isDataTemplateRequired && isEdit && updatedPaymethod && !noKeyPayments.includes(selectedPaymethodGateway) &&
      isCheckEnableState(updatedPaymethod?.paymethod_id) && ((!globalPayments.includes(selectedPaymethodGateway) && checkBusinessPaymethodConfigs(updatedPaymethod)) ||
        (globalPayments.includes(selectedPaymethodGateway) && paymentsGlobalConfigs[selectedPaymethodGateway]))
    ) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_INCOMPLETE_PAYMENT_DATA', 'Payment method data is incomplete, make sure to configure correctly')
      })
    }
  }, [
    businessPaymethodsState?.paymethods,
    configs?.stripe_publishable?.value,
    configs?.stripe_publishable_sandbox?.value,
    configs?.stripe_secret?.value,
    configs?.stripe_secret_sandbox?.value,
    configs?.global_apple_pay_publishable?.value,
    configs?.global_apple_pay_publishable_sandbox?.value,
    configs?.global_apple_pay_secret?.value,
    configs?.global_apple_pay_secret_sandbox?.value,
    configs?.global_google_pay_publishable?.value,
    configs?.global_google_pay_publishable_sandbox?.value,
    configs?.global_google_pay_secret?.value,
    configs?.global_google_pay_secret_sandbox?.value,
    configs?.computop_merchant_id?.value,
    configs?.computop_blowfish_password?.value,
    configs?.computop_hmac_password?.value
  ])

  useEffect(() => {
    if (paymethodsList.loading || businessPaymethodsState.loading) return
    const paymethodId = query.get('paymethod')
    if (paymethodId) {
      const initPaymethod = paymethodsList.paymethods.find(paymethod => paymethod.id === Number(paymethodId))
      if (initPaymethod) {
        handleOpenEdit(null, initPaymethod.id, initPaymethod.gateway, true)
      }
    }
  }, [paymethodsList.loading, businessPaymethodsState.loading])

  useEffect(() => {
    const paymethodsNotAllowed = []
    const paymethodsCreditCard = []
    const paymentsCreditCards = [...methodsPay, 'stripe', 'stripe_checkout', 'paypal', 'stripe_link']
    paymethodsCreditCard.push(...paymentsCreditCards)
    if (!isAddonMercadoPago) {
      const paymentsToHide = ['checkout_pro_mercadopago']
      paymethodsNotAllowed.push(...paymentsToHide)
    }
    setExcludedPaymethods(paymethodsNotAllowed)
    setCreditCardPaymethods(paymethodsCreditCard)
  }, [])

  return (
    <MainContainer>
      <PaymentMethodsContainer isOpenWalletDetails={isOpenWalletDetails}>
        <h1>{t('PAYMETHODS', 'Payment methods')}</h1>
        <SearchBarWrapper>
          <SearchBar
            placeholder={t('SEARCH', 'Search')}
            isCustomLayout
            search={searchValue}
            onSearch={val => setSearchValue(val)}
          />
        </SearchBarWrapper>
        <ButtonGroup>
          <Button
            color='secundaryDark'
            onClick={() => handleSelectAllPaymethods()}
            disabled={(paymethodsList.loading || businessPaymethodsState.loading)}
          >
            {t('SELECT_ALL', 'Select all')}
          </Button>
          {/* <Button
            color='secundaryDark'
            onClick={() => handleSelectNonePaymethods()}
            disabled={(paymethodsList.loading || businessPaymethodsState.loading)}
          >
            {t('SELECT_NONE', 'Select none')}
          </Button> */}
        </ButtonGroup>

        {(paymethodsList.loading || businessPaymethodsState.loading)
          ? (
              [...Array(10).keys()].map(i => (
              <PaymethodOptionContainer key={i}>
                <PaymethodOption>
                  <Skeleton width={15} height={15} />
                  <PaymethodName>
                    <Skeleton width={120} height={24} />
                  </PaymethodName>
                </PaymethodOption>
              </PaymethodOptionContainer>
              ))
            )
          : (
            <PaymethodListWrapper>
              {visiblePaymethods.map(paymethod => (
                <PaymethodRow
                  key={paymethod.id || paymethod.pluginKey || paymethod.gateway}
                  paymethod={paymethod}
                  displayName={getPaymethodDisplayName(paymethod)}
                  isEnabled={isCheckEnableState(paymethod.id)}
                  showChevron={!isTutorialMode && isCheckFoundBusinessPaymethod(paymethod.id)}
                  installingPluginKey={installingPluginKey}
                  onOpenEdit={handleOpenEdit}
                  onToggle={handleClickCheckBox}
                  onRequestInstall={handleRequestInstall}
                  isTutorialMode={isTutorialMode}
                  active={paymethod.id === selectedBusinessPaymethod?.paymethod_id}
                />
              ))}
              {!isSelectedAccessRole && visibleCreditCardPaymethods.length > 0 && (
                <>
                  <Divider />
                  <CreditCardPaymentsContainer>
                    <h2>{t('CREDIT_CARD_PAYMENTS', 'Credit card payments')}</h2>
                    <div>
                      {visibleCreditCardPaymethods.map(paymethod => (
                        <PaymethodRow
                          key={paymethod.id || paymethod.pluginKey || paymethod.gateway}
                          paymethod={paymethod}
                          displayName={getPaymethodDisplayName(paymethod)}
                          isEnabled={isCheckEnableState(paymethod.id)}
                          showChevron={!isTutorialMode && isCheckFoundBusinessPaymethod(paymethod.id)}
                          installingPluginKey={installingPluginKey}
                          onOpenEdit={handleOpenEdit}
                          onToggle={handleClickCheckBox}
                          onRequestInstall={handleRequestInstall}
                          isTutorialMode={isTutorialMode}
                          active={paymethod.id === selectedBusinessPaymethod?.paymethod_id}
                        />
                      ))}
                    </div>
                  </CreditCardPaymentsContainer>
                </>
              )}
              {isWalletCashEnabled && !isSelectedAccessRole && (
                <BusinessWalletsList
                  business={business}
                  setIsOpenWalletDetails={setIsOpenWalletDetails}
                  setIsExtendExtraOpen={setIsExtendExtraOpen}
                  isClose={isEdit}
                  handleClosePaymethodDetails={handleCloseEdit}
                  handleSuccessUpdate={handleSuccessUpdate}
                />
              )}
            </PaymethodListWrapper>
            )}

        {isTutorialMode && (
          <Button
            borderRadius='8px'
            color='primary'
            onClick={() => handleTutorialContinue()}
          >
            {t('CONTINUE', 'Continue')}
          </Button>
        )}
      </PaymentMethodsContainer>
      {width >= 1000
        ? (
          <>
            {isEdit && (
              <>
                {
                  !specialPayments.includes(selectedPaymethodGateway) && (
                    <PaymentOption
                      sitesState={sitesState}
                      open={isEdit}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      deviceState={deviceState}
                      selectedPaymethodGateway={selectedPaymethodGateway}
                    />
                  )
                }
                {selectedPaymethodGateway === 'apple_pay' && (
                  <PaymentOptionMethods
                    sitesState={sitesState}
                    open={isEdit}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    id={selectedPaymethodGateway}
                    title='Apple pay'
                  />
                )}
                {selectedPaymethodGateway === 'google_pay' && (
                  <PaymentOptionMethods
                    sitesState={sitesState}
                    open={isEdit}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    id={selectedPaymethodGateway}
                    title='Google pay'
                  />
                )}
                {stripeDirectMethods.includes(selectedPaymethodGateway) && (
                  <PaymentOptionStripeDirect
                    paymethodTitle={selectedPaymethodGateway}
                    sitesState={sitesState}
                    open={isEdit}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                  />
                )}
                {selectedPaymethodGateway === 'stripe_link' && (
                  <PaymentOptionStripeLink
                    business={business}
                    paymethodTitle={selectedPaymethodGateway}
                    sitesState={sitesState}
                    open={isEdit}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    handleSuccessUpdate={handleSuccessUpdate}
                  />
                )}
                {selectedPaymethodGateway === 'paypal' && (
                  <PaymentOptionPaypal
                    open={isEdit}
                    sitesState={sitesState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                  />
                )}
                {selectedPaymethodGateway === 'paypal_express' && (
                  <PaymethodOptionPaypalExpress
                    open={isEdit}
                    sitesState={sitesState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                  />
                )}
                {globalPayments?.includes(selectedPaymethodGateway) && (
                  <PaymentOptionGlobal
                    sitesState={sitesState}
                    open={isEdit}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    selectedPaymethodGateway={selectedPaymethodGateway}
                  />
                )}
                {selectedPaymethodGateway === 'stripe_connect' && (
                  <PaymethodOptionStripeConnect
                    open={isEdit}
                    sitesState={sitesState}
                    business={business}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={stripeConnectData}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeStripeConnectData}
                    actionState={actionState}
                    handleStripeConnect={handleStripeConnect}
                    handleChangeStripeInput={handleChangeStripeInput}
                    handleStripeSave={handleStripeSave}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                  />
                )}
                {selectedPaymethodGateway === 'square' && (
                  <PaymentOptionSquare
                    open={isEdit}
                    sitesState={sitesState}
                    business={business}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    deviceState={deviceState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    businessPaymethods={businessPaymethodsState?.paymethods}
                    handleSuccessPaymethodUpdate={handleSuccessPaymethodUpdate}
                  />
                )}
                {selectedPaymethodGateway === 'credomatic' && (
                  <PaymentOptionCredomatic
                    open={isEdit}
                    sitesState={sitesState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                  />
                )}
                {selectedPaymethodGateway === 'checkout_pro_mercadopago' && (
                  <PaymentOptionMercadoPago
                    open={isEdit}
                    sitesState={sitesState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                  />
                )}
                {selectedPaymethodGateway === 'epayco' && (
                  <PaymentOptionEpayco
                    open={isEdit}
                    sitesState={sitesState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    configs={business?.configs}
                  />
                )}
                {paymethodSelected?.data_template !== null && (
                  <PaymentOptionConfig
                    business={business}
                    paymethodTitle={paymethodSelected?.name}
                    open={isEdit}
                    sitesState={sitesState}
                    onClose={() => handleCloseEdit()}
                    businessPaymethod={selectedBusinessPaymethod}
                    changesState={changesState}
                    orderTypes={orderTypes}
                    handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                    cleanChangesState={cleanChangesState}
                    actionState={actionState}
                    handleChangeSandbox={handleChangeSandbox}
                    handleChangeInput={handleChangeInput}
                    handleSaveClick={handleSaveClick}
                    handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    defaultPaymethodState={paymethodSelected}
                  />
                )}
              </>
            )}
          </>
          )
        : (
          <>
            {isEdit && (
              <>
                <Modal
                  width='80%'
                  open={isEdit}
                  onClose={() => handleCloseEdit()}
                >
                  {
                    !specialPayments.includes(selectedPaymethodGateway) && (
                      <PaymentOption
                        sitesState={sitesState}
                        open={isEdit}
                        onClose={() => handleCloseEdit()}
                        businessPaymethod={selectedBusinessPaymethod}
                        changesState={changesState}
                        orderTypes={orderTypes}
                        handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                        cleanChangesState={cleanChangesState}
                        actionState={actionState}
                        handleChangeSandbox={handleChangeSandbox}
                        handleChangeInput={handleChangeInput}
                        handleSaveClick={handleSaveClick}
                        handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      />
                    )
                  }
                  {(methodsPay.includes(selectedPaymethodGateway)) && (
                    <PaymentOptionMethods
                      sitesState={sitesState}
                      open={isEdit}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      id={selectedPaymethodGateway}
                      title={capitalize(selectedPaymethodGateway).replace('_', ' ')}
                    />
                  )}
                  {stripeDirectMethods.includes(selectedPaymethodGateway) && (
                    <PaymentOptionStripeDirect
                      paymethodTitle={selectedPaymethodGateway}
                      sitesState={sitesState}
                      open={isEdit}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    />
                  )}
                  {selectedPaymethodGateway === 'stripe_link' && (
                    <PaymentOptionStripeLink
                      business={business}
                      paymethodTitle={selectedPaymethodGateway}
                      sitesState={sitesState}
                      open={isEdit}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      handleSuccessUpdate={handleSuccessUpdate}
                    />
                  )}
                  {selectedPaymethodGateway === 'paypal' && (
                    <PaymentOptionPaypal
                      open={isEdit}
                      sitesState={sitesState}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    />
                  )}
                  {selectedPaymethodGateway === 'paypal_express' && (
                    <PaymethodOptionPaypalExpress
                      open={isEdit}
                      sitesState={sitesState}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    />
                  )}
                  {globalPayments?.includes(selectedPaymethodGateway) && (
                    <PaymentOptionGlobal
                      sitesState={sitesState}
                      open={isEdit}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      selectedPaymethodGateway={selectedPaymethodGateway}
                    />
                  )}
                  {selectedPaymethodGateway === 'stripe_connect' && (
                    <PaymethodOptionStripeConnect
                      open={isEdit}
                      sitesState={sitesState}
                      business={business}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleStripeConnect={handleStripeConnect}
                      handleChangeStripeInput={handleChangeStripeInput}
                      handleStripeSave={handleStripeSave}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    />
                  )}
                  {selectedPaymethodGateway === 'square' && (
                    <PaymentOptionSquare
                      open={isEdit}
                      sitesState={sitesState}
                      business={business}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      businessPaymethods={businessPaymethodsState?.paymethods}
                      handleSuccessPaymethodUpdate={handleSuccessPaymethodUpdate}
                    />
                  )}
                  {selectedPaymethodGateway === 'credomatic' && (
                    <PaymentOptionCredomatic
                      open={isEdit}
                      sitesState={sitesState}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    />
                  )}
                  {selectedPaymethodGateway === 'checkout_pro_mercadopago' && (
                    <PaymentOptionMercadoPago
                      open={isEdit}
                      sitesState={sitesState}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                    />
                  )}
                  {selectedPaymethodGateway === 'epayco' && (
                    <PaymentOptionEpayco
                      open={isEdit}
                      sitesState={sitesState}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      configs={business?.configs}
                    />
                  )}
                  {paymethodSelected?.data_template !== null && (
                    <PaymentOptionConfig
                      business={business}
                      paymethodTitle={paymethodSelected?.name}
                      open={isEdit}
                      sitesState={sitesState}
                      onClose={() => handleCloseEdit()}
                      businessPaymethod={selectedBusinessPaymethod}
                      changesState={changesState}
                      orderTypes={orderTypes}
                      handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
                      cleanChangesState={cleanChangesState}
                      actionState={actionState}
                      handleChangeSandbox={handleChangeSandbox}
                      handleChangeInput={handleChangeInput}
                      handleSaveClick={handleSaveClick}
                      handleDeletePaymethod={handleDeleteBusinessPaymethodOption}
                      defaultPaymethodState={paymethodSelected}
                    />
                  )}
                </Modal>
              </>
            )}
          </>
          )}
      <Alert
        title={t('PAYMETHODS', 'Payment methods')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      <Confirm
        title={t('INSTALL_PAYMENT_PLUGIN_TITLE', 'Install payment method')}
        content={t('INSTALL_PAYMENT_PLUGIN_CONFIRM', 'This installs _name_ for the whole project. You can enable it for this store after that.').replace('_name_', installConfirm.name)}
        acceptText={t('INSTALL', 'Install')}
        open={installConfirm.open}
        onClose={closeInstallConfirm}
        onCancel={closeInstallConfirm}
        onAccept={handleAcceptInstall}
        closeOnBackdrop={false}
      />
    </MainContainer>
  )
}

export const BusinessPaymentMethods = (props) => {
  const businessPaymethodProps = {
    ...props,
    UIComponent: BusinessPaymentMethodsUI
  }
  return <BusinessPaymentMethodsController {...businessPaymethodProps} />
}
