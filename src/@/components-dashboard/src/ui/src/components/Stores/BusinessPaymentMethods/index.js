import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import {
  useLanguage,
  useConfig,
  BusinessPaymethods as BusinessPaymentMethodsController,
  useSession
} from '../../../../../index'
import { Ellipsis, TriangleAlert } from '../../Shared/Icon'
import {
  Button,
  ConfirmDialog,
  InlineNotice,
  Menu,
  SearchField,
  SectionSplit,
  Skeleton
} from '../../Shared/Product'
import { PaymentOptionStripeDirect } from '../PaymentOptionStripeDirect'
import { PaymentOptionStripeLink } from '../PaymentOptionStripeLink'
import { PaymentOption } from '../PaymentOption'
import { PaymethodOptionStripeConnect } from '../PaymethodOptionStripeConnect'
import { PaymentOptionStripeConnectV2 } from '../PaymentOptionStripeConnectV2'
import { PaymentOptionPaypal } from '../PaymentOptionPaypal'
import { PaymentOptionSquare } from '../PaymentOptionSquare'
import { PaymentOptionMethods } from '../PaymentOptionMethods'
import { PaymentOptionCredomatic } from '../PaymentOptionCredomatic'
import { BusinessWalletsList } from '../BusinessWalletsList'
import { PaymentOptionGlobal } from '../PaymentOptionGlobal'
import { PaymentOptionMercadoPago } from '../PaymentOptionMercadoPago'
import { PaymentOptionEpayco } from '../PaymentOptionEpayco'
import { PaymentOptionConfig } from '../PaymentOptionConfig'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { useSelectedAccessRole } from '../../../hooks/useUserSelectedAccess'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { consumePendingInstallOpen } from '../../../../../utils/paymentPluginCatalog'
import { getUtils } from './utils'
import { getDisplayPaymethods } from './getDisplayPaymethods'
import { PaymethodRow } from './PaymethodRow'
import {
  BRAINTREE_GATEWAYS,
  CREDIT_CARD_GATEWAYS,
  GLOBAL_GATEWAYS,
  METHODS_PAY_GATEWAYS,
  NO_KEY_GATEWAYS,
  getSelectAllPlan,
  getToggleDecision,
  hasMissingCredentials,
  humanizeFieldKey,
  isTemplated,
  needsCredentials
} from './paymethodModel'
import './payment-methods.css'

// redesign stores 5.9: the Payment methods section on P/SectionSplit. The list (a switch per gateway, search, Select all) and
// the detail of the open gateway side by side from 1000px of window (`EDITOR_PANEL_WIDE_FROM`, as `main`'s editor) and stacked below it.
// ONE branch for every width: the old `width >= 1000` / `Modal` pair is gone. Rows, groups, order, add-on rule and install flow are
// today's; what changes is how a row is turned on or off (an `AsyncSwitch` that answers `{ ok, error }`, confirmations for the money
// actions, guards under the switch instead of a modal Alert) and that the detail is a panel, not a SideBar.

// redesign stores 5.10a / 5.10b (): paypal, stripe_checkout, stripe_link, checkout_pro_mercadopago, epayco, credomatic and
// square are on ProviderPanel: they take the new props contract through `renderProviderForm`, like the four of 5.9
// redesign stores 5.11: stripe_connect too, with `onConnect` (the OAuth window) and its own save (`handleSaveStripeConnect`)
const PROVIDER_FORMS = {
  paypal: PaymentOptionPaypal,
  stripe_checkout: PaymentOptionStripeDirect,
  stripe_link: PaymentOptionStripeLink,
  checkout_pro_mercadopago: PaymentOptionMercadoPago,
  epayco: PaymentOptionEpayco,
  credomatic: PaymentOptionCredomatic,
  square: PaymentOptionSquare,
  stripe_connect: PaymethodOptionStripeConnect,
  // main, the store's Stripe account, its platform fee and its payouts, as tabs of its own before the common ones
  stripe_connect_v2: PaymentOptionStripeConnectV2
}

const GATEWAY_PROVIDER_LABELS = {
  google_pay: 'Stripe',
  apple_pay: 'Stripe',
  google_pay_braintree: 'Braintree',
  apple_pay_braintree: 'Braintree',
  paypal_braintree: 'Braintree'
}

// the tab the URL asks for (`?paymethod_tab=`), or undefined when it does not
const readUrlTab = () => {
  const raw = new URLSearchParams(window.location.search).get('paymethod_tab')
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

const BusinessPaymentMethodsUI = (props) => {
  const {
    business,
    businessPaymethodsState,
    paymethodsList,
    handleClickPayment,
    handleSelectAllPaymethods,
    handleTogglePaymethod,
    handleSavePaymethod,
    handleDeleteBusinessPaymethodOption,
    setIsExtendExtraOpen,
    sitesState,
    deviceState,
    cleanChangesState,
    handleStripeConnect,
    handleSaveStripeConnect,
    getDraftBusinessPaymethod,
    handleCreatePaymethodOnSave,
    isSuccessDeleted,
    setIsSuccessDeleted,
    handleSuccessUpdate,
    pluginsState,
    installingPluginKey,
    handleInstallPaymentPlugin
  } = props

  const query = new URLSearchParams(useLocation().search)
  const history = useHistory()
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const isSelectedAccessRole = useSelectedAccessRole()
  const { orderTypesValues, paymentsGlobalConfigs, checkBusinessPaymethodConfigs } = getUtils()
  const groupId = useId()
  const sectionSplitRef = useRef(null)
  const selectedIdRef = useRef(null)
  // redesign bugs F row 15: counts every open and close of the detail; a toggle that opens its gateway when the POST
  // answers does it only if the count is still the one it saw when it started
  const openTokenRef = useRef(0)
  const [isEdit, setIsEdit] = useState(false)
  const [selectedPaymethodId, setSelectedPaymethodId] = useState(null)
  const [createdRecord, setCreatedRecord] = useState(null) // the record a toggle just created, until the list state shows it
  // redesign bugs C: the record a gateway the store does not have starts from, written by its first Save
  const [draftRecord, setDraftRecord] = useState(null)
  const [initialTab, setInitialTab] = useState(undefined)
  const [emptyDataId, setEmptyDataId] = useState(null) // the gateway whose detail opened because its data is missing
  const [listNotice, setListNotice] = useState(null)
  const [searchValue, setSearchValue] = useState('')
  const [installConfirm, setInstallConfirm] = useState({ open: false, pluginKey: null, name: '' })
  const [pendingOpenPluginKey, setPendingOpenPluginKey] = useState(null)
  const [turnOff, setTurnOff] = useState({ open: false, busy: false, name: '', resolve: null })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, busy: false, name: '', paymethodId: null })
  const [selectAll, setSelectAll] = useState({ open: false, busy: false, ids: [], missing: 0 })
  const isWalletCashEnabled = configs?.wallet_enabled?.value === '1'
  const isAdmin = user?.level === 0
  // Mercado Pago is an add-on: `main` listed it when the config EXISTS, whatever its value ('0' is production). Decision S-8: kept.
  const isAddonMercadoPago = configs?.mercadopago_sandbox_mode
  const orderTypes = orderTypesValues()
  const isLoading = !!(paymethodsList.loading || businessPaymethodsState.loading)

  // redesign stores 1.B (G4-26): a host may mount this section without `setIsExtendExtraOpen`.
  // The piece tells the shell to extend the section while a gateway is open. redesign stores 5.11 (B-3): the wallets are
  // edited in line, so no other detail asks for the extension any more.
  const extendExtraOpen = (value) => setIsExtendExtraOpen?.(value)

  // redesign stores 1.B (G4-03, G4-20): opening another gateway mounts a fresh form (`key` of the detail) on clean
  // changes, and does not carry the previous gateway's tab in the URL. The ref, not state, so a create callback that
  // lands later compares with the gateway open now.
  // The legacy forms read `paymethod_tab` from the router, which `removeQueryToUrl` (replaceState) does not reach: a tab that
  // came in a deep link lives there, so it is dropped from the router too.
  const dropUrlTab = (keys = ['paymethod_tab']) => {
    removeQueryToUrl(keys)
    if (query.get('paymethod_tab') !== null) history.replace(`${window.location.pathname}${window.location.search}`)
  }

  const findRecord = (paymethodId) => businessPaymethodsState?.paymethods?.find(item => item.paymethod_id === paymethodId)
  const isCheckEnableState = (paymethodId) => !!findRecord(paymethodId)?.enabled
  const findPaymethod = (paymethodId) => paymethodsList?.paymethods?.find(item => item.id === paymethodId) || null

  const showPaymethodDetail = (paymethod, { missingData = false } = {}) => {
    openTokenRef.current += 1
    if (selectedIdRef.current !== null && selectedIdRef.current !== paymethod.id) {
      cleanChangesState({})
      dropUrlTab()
    }
    selectedIdRef.current = paymethod.id
    setSelectedPaymethodId(paymethod.id)
    setEmptyDataId(missingData ? paymethod.id : null)
    setInitialTab(readUrlTab())
    setIsEdit(true)
  }

  const leaveThen = (proceed) => {
    if (sectionSplitRef.current) sectionSplitRef.current.requestLeave(proceed)
    else proceed()
  }

  const getPaymethodDisplayName = (paymethod) => {
    const name = t(paymethod?.gateway?.toUpperCase(), paymethod?.name)
    const provider = GATEWAY_PROVIDER_LABELS[paymethod?.gateway]
    return provider ? `${name} (with ${provider})` : name
  }

  const excludedGateways = useMemo(() => (isAddonMercadoPago ? [] : ['checkout_pro_mercadopago']), [isAddonMercadoPago])

  const displayPaymethods = useMemo(() => {
    return getDisplayPaymethods({
      paymethods: paymethodsList?.paymethods,
      plugins: pluginsState?.plugins,
      excludeGateways: excludedGateways,
      canInstall: user?.level === 0
    })
  }, [paymethodsList?.paymethods, pluginsState?.plugins, excludedGateways, user?.level])

  const matchesPaymethodSearch = (paymethod) => {
    const queryValue = searchValue?.toLowerCase() || ''
    if (!queryValue) return true
    const displayName = getPaymethodDisplayName(paymethod).toLowerCase()
    return displayName.includes(queryValue) || paymethod?.name?.toLowerCase().includes(queryValue)
  }

  // the rows the list can show, search aside: the main group (one Braintree-only list for the selected-access role) and the
  // credit card group (hidden for that role)
  const mainRows = displayPaymethods.filter(paymethod => (
    !CREDIT_CARD_GATEWAYS.includes(paymethod.gateway) &&
    (!isSelectedAccessRole || BRAINTREE_GATEWAYS.includes(paymethod.gateway))
  ))
  const creditCardRows = isSelectedAccessRole
    ? []
    : displayPaymethods.filter(paymethod => CREDIT_CARD_GATEWAYS.includes(paymethod.gateway))
  const visibleMain = mainRows.filter(matchesPaymethodSearch)
  const visibleCreditCard = creditCardRows.filter(matchesPaymethodSearch)

  // «Select all» works on what the list shows (the box is ignored, as it was), without the catalog rows. The model skips any row that
  // carries an `installState`, and every API row gets 'ready' from the catalog merge: so it gets the rows as the API sent them.
  const selectAllPlan = getSelectAllPlan({
    paymethods: [...mainRows, ...creditCardRows]
      .filter(paymethod => paymethod.source === 'api')
      .map(({ pluginKey, installUrl, source, installState, ...paymethod }) => paymethod),
    businessPaymethods: businessPaymethodsState?.paymethods,
    isAdmin,
    configs
  })

  const enabledCount = (paymethodsList?.paymethods || []).filter(paymethod => isCheckEnableState(paymethod.id)).length

  // ── Install ──
  const closeInstallConfirm = () => setInstallConfirm(previous => ({ ...previous, open: false }))

  const handleRequestInstall = (paymethod) => {
    setInstallConfirm({ open: true, pluginKey: paymethod.pluginKey, name: getPaymethodDisplayName(paymethod) })
  }

  const handleAcceptInstall = async () => {
    const pluginKey = installConfirm.pluginKey
    closeInstallConfirm()
    if (!pluginKey) return
    const result = await handleInstallPaymentPlugin?.(pluginKey)
    if (result === pluginKey) setPendingOpenPluginKey(pluginKey)
  }

  // ── Open and close the detail ──
  // redesign bugs C (decision 4 of Stores): a gateway without a record opens on a draft and writes nothing (main created
  // a disabled record on open, also from the address); its first Save creates it (no gateway is left out, PayPal Express was dead code).
  const openPaymethod = (paymethod, { fromUrl } = {}) => {
    const writeUrl = () => {
      if (!fromUrl) addQueryToUrl({ paymethod: paymethod.id })
    }
    if (findRecord(paymethod.id)) {
      showPaymethodDetail(paymethod)
      writeUrl()
      return
    }
    const decision = getToggleDecision({ paymethod, businessPaymethod: undefined, next: false, enabledCount, isAdmin, configs })
    if (decision.type === 'block') {
      setListNotice(t('VALIDATION_ERROR_STRIPE_PAYMENT', 'Please contact administrator'))
      return
    }
    if (getDraftBusinessPaymethod) {
      showPaymethodDetail(paymethod)
      setDraftRecord(getDraftBusinessPaymethod(paymethod.id))
      writeUrl()
      return
    }
    handleClickPayment?.(paymethod.id, () => {
      showPaymethodDetail(paymethod)
      writeUrl()
    })
  }

  const handleOpenRow = (paymethod) => {
    setListNotice(null)
    if (isEdit && selectedIdRef.current === paymethod.id) return
    leaveThen(() => openPaymethod(paymethod))
  }

  // the detail of a gateway whose data is missing: with the notice that says so
  const openWithMissingData = (paymethod) => {
    leaveThen(() => {
      showPaymethodDetail(paymethod, { missingData: true })
      addQueryToUrl({ paymethod: paymethod.id })
    })
  }

  useEffect(() => {
    const next = consumePendingInstallOpen(pendingOpenPluginKey, paymethodsList?.paymethods)
    if (!next.paymethod) return
    setPendingOpenPluginKey(null)
    const paymethod = findPaymethod(next.paymethod.id)
    if (paymethod) leaveThen(() => openPaymethod(paymethod))
  }, [pendingOpenPluginKey, paymethodsList?.paymethods])

  const handleCloseEdit = () => {
    openTokenRef.current += 1
    setIsEdit(false)
    setSelectedPaymethodId(null)
    setCreatedRecord(null)
    setDraftRecord(null)
    setEmptyDataId(null)
    setIsSuccessDeleted?.(false)
    dropUrlTab(['paymethod', 'paymethod_tab'])
  }

  useEffect(() => {
    if (!isSuccessDeleted) return
    handleCloseEdit()
  }, [isSuccessDeleted])

  useEffect(() => {
    if (paymethodsList.loading || businessPaymethodsState.loading) return
    const paymethodId = query.get('paymethod')
    if (paymethodId) {
      const initPaymethod = findPaymethod(Number(paymethodId))
      if (initPaymethod) openPaymethod(initPaymethod, { fromUrl: true })
    }
  }, [paymethodsList.loading, businessPaymethodsState.loading])

  // ── The switch of a row (decision 6 and S-5/S-6/S-7) ──
  const onToggleRow = async (paymethod, next) => {
    setListNotice(null)
    const record = findRecord(paymethod.id)
    const decision = getToggleDecision({ paymethod, businessPaymethod: record, next, enabledCount, isAdmin, configs })
    switch (decision.type) {
      case 'block':
        return {
          ok: false,
          error: decision.reason === 'min'
            ? t('VALIDATION_ERROR_MIN_ARRAY', 'The _attribute_ must have at least _min_ items.').replace('_attribute_', t('PAYMETHODS', 'Payment methods')).replace('_min_', t('ONE', 'one'))
            : t('VALIDATION_ERROR_STRIPE_PAYMENT', 'Please contact administrator')
        }
      case 'confirm-off':
        return new Promise(resolve => {
          setTurnOff({ open: true, busy: false, name: getPaymethodDisplayName(paymethod), paymethodId: paymethod.id, resolve })
        })
      case 'open':
        openWithMissingData(paymethod)
        return { ok: true }
      case 'create-open': {
        const token = openTokenRef.current
        const result = await handleTogglePaymethod(paymethod.id, false)
        if (result?.ok) {
          setCreatedRecord(result.created || null)
          // redesign bugs F row 15: the person opened (or closed) a detail while the POST was pending: keep what they chose
          if (token === openTokenRef.current) openWithMissingData(paymethod)
        }
        return result
      }
      case 'create':
        return handleTogglePaymethod(paymethod.id, true)
      default: {
        const result = await handleTogglePaymethod(paymethod.id, next)
        // owner decision 5 C (W1): it turned on (nothing blocks it); the notice only says which Sandbox fields are missing
        if (result?.ok && decision.warnSandbox?.length) {
          setListNotice(t('PAYMETHOD_SANDBOX_DATA_MISSING', 'Missing in Sandbox: _fields_').replace('_fields_', decision.warnSandbox.map(humanizeFieldKey).join(', ')))
        }
        return result
      }
    }
  }

  const cancelTurnOff = () => {
    if (turnOff.busy) return
    turnOff.resolve?.({ ok: true })
    setTurnOff(previous => ({ ...previous, open: false, resolve: null }))
  }

  const confirmTurnOff = async () => {
    const { resolve, paymethodId } = turnOff
    setTurnOff(previous => ({ ...previous, busy: true }))
    let result
    try {
      result = await handleTogglePaymethod(paymethodId, false)
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    setTurnOff(previous => ({ ...previous, open: false, busy: false, resolve: null }))
    resolve?.(result)
  }

  // ── Select all ──
  const openSelectAll = () => {
    setSelectAll({ open: true, busy: false, ids: selectAllPlan.targets, missing: selectAllPlan.missingCredentials })
  }

  const confirmSelectAll = async () => {
    setSelectAll(previous => ({ ...previous, busy: true }))
    try {
      await handleSelectAllPaymethods(selectAll.ids)
    } finally {
      setSelectAll(previous => ({ ...previous, open: false, busy: false }))
    }
  }

  // ── Delete (the header menu of the detail) ──
  const confirmDelete = async () => {
    setDeleteDialog(previous => ({ ...previous, busy: true }))
    try {
      await handleDeleteBusinessPaymethodOption(deleteDialog.paymethodId)
    } finally {
      setDeleteDialog(previous => ({ ...previous, open: false, busy: false }))
    }
  }

  // ── The detail ──
  const selectedPaymethod = isEdit ? findPaymethod(selectedPaymethodId) : null
  const selectedRecord = isEdit
    ? (findRecord(selectedPaymethodId) ||
      (createdRecord?.paymethod_id === selectedPaymethodId ? createdRecord : null) ||
      (draftRecord?.paymethod_id === selectedPaymethodId ? draftRecord : null))
    : null
  const selectedName = selectedPaymethod ? getPaymethodDisplayName(selectedPaymethod) : ''

  const templatedGateways = (paymethodsList?.paymethods || []).filter(isTemplated).map(paymethod => paymethod.gateway)
  const specialGateways = [...Object.keys(PROVIDER_FORMS), ...templatedGateways, ...GLOBAL_GATEWAYS, ...METHODS_PAY_GATEWAYS]

  // today's rule: an ENABLED gateway whose required data is incomplete. redesign bugs C: not a gateway with no fields
  const isIncompleteEnabled = () => {
    if (!isEdit || !selectedPaymethod || !selectedRecord || !selectedRecord.enabled) return false
    if (!needsCredentials(selectedPaymethod)) return false
    const gateway = selectedPaymethod.gateway
    const template = selectedPaymethod.data_template
    const isDataTemplateRequired = !template || (template.length && template.some(item => item?.required))
    if (!isDataTemplateRequired || NO_KEY_GATEWAYS.includes(gateway)) return false
    return GLOBAL_GATEWAYS.includes(gateway)
      ? !!paymentsGlobalConfigs[gateway]
      : checkBusinessPaymethodConfigs(selectedRecord)
  }

  let noticeText = null
  if (isIncompleteEnabled()) {
    noticeText = t('VALIDATION_ERROR_INCOMPLETE_PAYMENT_DATA', 'Payment method data is incomplete, make sure to configure correctly')
  } else if (selectedRecord && emptyDataId === selectedPaymethodId && hasMissingCredentials(selectedPaymethod, selectedRecord, configs)) {
    noticeText = t('VALIDATION_ERROR_EMPTY_DATA', 'Please fill all the data to activate the payment method (sandbox mode is opcional)')
  }

  const renderDetailForm = (paymethod, record) => {
    const gateway = paymethod.gateway
    const sites = Array.isArray(sitesState?.sites) ? sitesState.sites : []
    const devices = Array.isArray(deviceState?.devices) ? deviceState.devices : []
    // explicit props, no spreads: the brand guard reads each one (l4-b8)
    const renderProviderForm = (Form) => (
      <Form
        paymethod={paymethod}
        businessPaymethod={record}
        gatewayName={selectedName}
        storeName={business?.name}
        sites={sites}
        devices={devices}
        orderTypes={orderTypes}
        initialTab={initialTab}
        // main, a tab of the gateway's own is never kept in the URL (the form sends null for it)
        onTabChange={(index) => (index === null ? dropUrlTab() : addQueryToUrl({ paymethod_tab: index }))}
        // redesign stores 5.11 (R2 of 5.9): the panel says how a save went in its bar, so the save is silent (no toast over
        // Discard and Save). Stripe Connect saves the gateway and the business fees apart, and opens the OAuth window with `onConnect`.
        // redesign bugs C: a draft's first Save creates the gateway with its changes
        onSave={(changes) => (record.draft
          ? handleCreatePaymethodOnSave(paymethod.id, changes, { stripeConnect: gateway === 'stripe_connect' })
          : gateway === 'stripe_connect'
            ? handleSaveStripeConnect(record.id, changes)
            : handleSavePaymethod(record.id, changes, { silent: true }))}
        onConnect={gateway === 'stripe_connect' ? handleStripeConnect : undefined}
        business={business}
        handleSuccessUpdate={gateway === 'stripe_link' ? handleSuccessUpdate : undefined}
      />
    )
    if (!specialGateways.includes(gateway)) return renderProviderForm(PaymentOption)
    if (METHODS_PAY_GATEWAYS.includes(gateway)) return renderProviderForm(PaymentOptionMethods)
    if (GLOBAL_GATEWAYS.includes(gateway)) return renderProviderForm(PaymentOptionGlobal)
    if (PROVIDER_FORMS[gateway]) return renderProviderForm(PROVIDER_FORMS[gateway])
    if (isTemplated(paymethod)) return renderProviderForm(PaymentOptionConfig)
    return null
  }

  const detail = selectedPaymethod && selectedRecord
    ? (
      <div key={selectedPaymethod.id} className='odc-pm-detail'>
        {noticeText && <InlineNotice tone='warning' icon={TriangleAlert}>{noticeText}</InlineNotice>}
        {renderDetailForm(selectedPaymethod, selectedRecord)}
      </div>
      )
    : null

  // a draft has nothing to delete yet
  const headerActions = selectedRecord && !selectedRecord.draft
    ? (
      <Menu
        icon={Ellipsis}
        label={t('MORE_ACTIONS', 'More actions')}
        items={[{
          key: 'delete',
          label: t('DELETE', 'Delete'),
          tone: 'danger',
          onSelect: () => setDeleteDialog({ open: true, busy: false, name: selectedName, paymethodId: selectedRecord.paymethod_id })
        }]}
      />
      )
    : null

  // ── The list ──
  const renderRow = (paymethod) => {
    const record = paymethod.id ? findRecord(paymethod.id) : undefined
    return (
      <PaymethodRow
        key={paymethod.id || paymethod.pluginKey || paymethod.gateway}
        paymethod={paymethod}
        displayName={getPaymethodDisplayName(paymethod)}
        record={record}
        isEnabled={!!record?.enabled}
        configs={configs}
        active={isEdit && paymethod.id === selectedPaymethodId}
        installingPluginKey={installingPluginKey}
        onToggle={onToggleRow}
        onOpen={handleOpenRow}
        onRequestInstall={handleRequestInstall}
      />
    )
  }

  const creditCardTitleId = `${groupId}-credit-card`

  const list = (
    <div className='odc-pm-list'>
      {listNotice && <InlineNotice tone='warning' icon={TriangleAlert} className='odc-pm-notice'>{listNotice}</InlineNotice>}
      {isLoading
        ? (
          <div className='odc-pm-rows' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
            {[...Array(10).keys()].map(index => (
              <div key={index} className='odc-pm-skeleton-row'>
                <Skeleton shape='round' size='var(--od-x-control-height)' block='var(--od-space-4)' />
                <Skeleton size='40%' />
              </div>
            ))}
          </div>
          )
        : (
          <>
            {visibleMain.length > 0 && (
              <ul className='odc-pm-rows' aria-label={t('PAYMETHODS', 'Payment methods')}>
                {visibleMain.map(renderRow)}
              </ul>
            )}
            {visibleCreditCard.length > 0 && (
              <div className='odc-pm-group'>
                <h4 id={creditCardTitleId} className='odc-pm-group-title'>{t('CREDIT_CARD_PAYMENTS', 'Credit card payments')}</h4>
                <ul className='odc-pm-rows' aria-labelledby={creditCardTitleId}>
                  {visibleCreditCard.map(renderRow)}
                </ul>
              </div>
            )}
            {visibleMain.length + visibleCreditCard.length === 0 && (
              <p className='odc-pm-empty'>{t('NO_RESULTS', 'No results')}</p>
            )}
            {isWalletCashEnabled && !isSelectedAccessRole && (
              // redesign stores 5.11 (B-3): each wallet is edited in its row; it no longer opens a detail of its own
              <BusinessWalletsList
                business={business}
                handleSuccessUpdate={handleSuccessUpdate}
              />
            )}
          </>
          )}
    </div>
  )

  // the search and Select all belong to the list: stacked, they go away with it while a gateway is open
  const tools = (
  <div className='odc-paym-tools'>
    <SearchField
      className='odc-paym-search'
      value={searchValue}
      onChange={setSearchValue}
      label={t('SEARCH', 'Search')}
      placeholder={t('SEARCH', 'Search')}
      clearLabel={t('CLEAR', 'Clear')}
    />
    <Button
      onClick={openSelectAll}
      disabled={isLoading || selectAllPlan.targets.length === 0}
    >
      {t('SELECT_ALL', 'Select all')}
    </Button>
  </div>
  )

  const confirmCount = (template) => template.replace('_count_', String(selectAll.ids.length))

  return (
    <div className='odc-root odc-pm'>
      <h3 className='odc-pm-title'>{t('PAYMETHODS', 'Payment methods')}</h3>
      <SectionSplit
        ref={sectionSplitRef}
        splitFrom={EDITOR_PANEL_WIDE_FROM}
        revealDetail // redesign stores 5.18 (R5.8-02): a gateway opened low in the list starts at its header on a phone
        open={isEdit}
        detailKey={selectedPaymethodId}
        onClose={handleCloseEdit}
        onExtendChange={extendExtraOpen}
        detailTitle={selectedName}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        headerActions={headerActions}
        list={<div className='odc-pm-pane'>{tools}{list}</div>}
        detail={detail}
      />
      <ConfirmDialog
        open={selectAll.open}
        tone='primary'
        busy={selectAll.busy}
        title={confirmCount(t('PAYMETHODS_SELECT_ALL_TITLE', 'Turn on _count_ payment methods?'))}
        confirmLabel={confirmCount(t('PAYMETHODS_TURN_ON_COUNT', 'Turn on _count_'))}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setSelectAll(previous => ({ ...previous, open: false }))}
        onConfirm={confirmSelectAll}
      >
        {t('PAYMETHODS_SELECT_ALL_BODY', 'Customers will see them at checkout.')}
        {selectAll.missing > 0 && ` ${t('PAYMETHODS_SELECT_ALL_MISSING', '_count_ of them have no credentials yet: orders paid with them can fail.').replace('_count_', String(selectAll.missing))}`}
      </ConfirmDialog>
      <ConfirmDialog
        open={turnOff.open}
        tone='danger'
        busy={turnOff.busy}
        title={t('PAYMETHOD_TURN_OFF_TITLE', 'Turn off _name_?').replace('_name_', turnOff.name)}
        confirmLabel={t('TURN_OFF', 'Turn off')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={cancelTurnOff}
        onConfirm={confirmTurnOff}
      >
        {t('PAYMETHOD_TURN_OFF_BODY', 'Customers stop seeing _name_ at checkout. You can turn it on again later.').replace('_name_', turnOff.name)}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleteDialog.open}
        tone='danger'
        busy={deleteDialog.busy}
        title={t('PAYMETHOD_DELETE_TITLE', 'Delete _name_?').replace('_name_', deleteDialog.name)}
        confirmLabel={t('PAYMETHOD_DELETE_CONFIRM', 'Delete payment method')} // redesign tanda AB (S-5): verb + object
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleteDialog(previous => ({ ...previous, open: false }))}
        onConfirm={confirmDelete}
      >
        {t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('PAYMETHOD_ID', 'Paymethod'))}
      </ConfirmDialog>
      <ConfirmDialog
        open={installConfirm.open}
        tone='primary'
        title={t('INSTALL_PAYMENT_PLUGIN_TITLE', 'Install payment method')}
        confirmLabel={t('INSTALL', 'Install')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={closeInstallConfirm}
        onConfirm={handleAcceptInstall}
      >
        {t('INSTALL_PAYMENT_PLUGIN_CONFIRM', 'This installs _name_ for the whole project. You can enable it for this store after that.').replace('_name_', installConfirm.name)}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessPaymentMethods = (props) => {
  const businessPaymethodProps = {
    ...props,
    UIComponent: BusinessPaymentMethodsUI
  }
  return <BusinessPaymentMethodsController {...businessPaymethodProps} />
}
