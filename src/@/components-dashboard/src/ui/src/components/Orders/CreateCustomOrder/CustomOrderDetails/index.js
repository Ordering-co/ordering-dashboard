import React, { useState, useEffect, useRef } from 'react'
import { useLanguage, useOrder, useUtils, useValidationFields, CustomOrderDetails as CustomOrderDetailsController } from '../../../../../../index'
import { SelectCustomer } from '../SelectCustomer'
import { OrderTypeSelector } from '../OrderTypeSelector'
import { SelectBusinesses } from '../SelectBusinesses'
import { Map } from '../Map'
import { SelectProducts } from '../SelectProducts'
import { Checkout } from '../Checkout'
import { Button, InlineNotice, SegmentedControl } from '../../../Shared/Product'
import { Input, TextArea } from '../../../../styles'
import { Wizard } from '../../../Shared/Product/Wizard/Wizard'
import { Summary } from '../../../Shared/Product/Wizard/Summary'
import { WizardFooter } from '../../../Shared/Product/Wizard/WizardFooter'
import { StepBoundary } from '../../../Shared/Product/Wizard/StepBoundary'
import { translateApiMessage } from '../../../../../../utils/translateApiMessage' // redesign W0-2d (T0-7)

import { FormControl } from './styles'

// Redesign 5.5: the form is a wizard of four steps. The controller, its endpoints and its payloads
// are the ones of before; this component only decides which piece shows at which step.
const STEP_CUSTOMER = 0
const STEP_BUSINESS = 1
const STEP_ITEMS = 2
const STEP_PAYMENT = 3
const LAST_STEP = STEP_PAYMENT
const STEP_IDS = ['customer', 'business', 'items', 'payment']

// The delivery types of OrderTypeSelector, by the value the order options keep.
const ORDER_TYPE_LABELS = {
  1: ['DELIVERY', 'Delivery'],
  2: ['PICKUP', 'Pickup'],
  3: ['EAT_IN', 'Eat in'],
  4: ['CURBSIDE', 'Curbside'],
  5: ['DRIVE_THRU', 'Drive thru']
}

const MODE_PRODUCTS = 'products'
const MODE_TOTAL = 'total'

const CustomOrderDetailsUI = (props) => {
  const {
    phone,
    onChangeNumber,
    customersPhones,
    setCustomersPhones,
    businessList,
    selectedUser,
    selectedBusiness,
    setSelectedUser,
    setSelectedBusiness,
    productList,
    getProducts,
    handeUpdateProductCart,
    cart,
    onClose,
    handleOpenCustomOrderDetail,
    handlePlaceOrderByTotal,
    extraFields,
    setExtraFields,
    actionState,
    customerAddress,
    footerHost,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [validationFields] = useValidationFields()
  const [orderState, { changeAddress }] = useOrder()

  const [alertState, setAlertState] = useState({ open: false, content: [], source: null })
  const [isOrderByProducts, setIsOrderByProducts] = useState(true)
  const [step, setStep] = useState(STEP_CUSTOMER)
  // The place-order action of the Checkout (by products), registered by it so the pinned footer hosts it.
  const [checkoutPlaceOrder, setCheckoutPlaceOrder] = useState(null)
  // redesign fix-qa: E3. Business and Items stay mounted (hidden) once reached, so what the user typed in them
  // (the product search) survives going back and forward. Payment is not kept: Checkout owns side effects.
  const [reachedSteps, setReachedSteps] = useState({})

  const handleCloseAlert = () => {
    setCustomersPhones({ ...customersPhones, error: null })
    setAlertState({ open: false, content: [], source: null })
  }

  const commentRequired = !!(validationFields?.fields?.checkout?.comments?.enabled && validationFields?.fields?.checkout?.comments?.required)

  const handlePlaceOrder = () => {
    const errMessage = []

    if (!selectedBusiness) {
      errMessage.push(t(
        'VALIDATION_ERROR_REQUIRED',
        'Name is required'
      ).replace('_attribute_', t('BUSINESS', 'Business')))
    }
    if (!extraFields?.total) {
      errMessage.push(t(
        'VALIDATION_ERROR_REQUIRED',
        'Name is required'
      ).replace('_attribute_', t('TOTAL', 'Total')))
    }
    if (commentRequired && !extraFields?.comment) {
      errMessage.push(t(
        'VALIDATION_ERROR_REQUIRED',
        'Name is required'
      ).replace('_attribute_', t('COMMENT', 'Comment')))
    }
    if (errMessage.length > 0) {
      setAlertState({
        open: true,
        content: errMessage,
        source: 'validation'
      })
      return
    }

    handlePlaceOrderByTotal()
  }

  // ── Readiness of each step, from the data the controller already holds ──
  const hasCartProducts = cart?.products?.length > 0
  const commentMissing = commentRequired && !extraFields?.comment
  const stepReady = [
    !!selectedUser && !!customerAddress?.location,
    !!selectedBusiness,
    isOrderByProducts ? hasCartProducts : (!!extraFields?.total && !commentMissing)
  ]
  // The furthest step that can be reached: the first one that is not ready yet (or the last).
  const firstOpenStep = stepReady.includes(false) ? stepReady.indexOf(false) : LAST_STEP
  const activeStep = Math.min(step, firstOpenStep)

  const stepReasons = [
    t('CUSTOM_ORDER_REASON_CUSTOMER', 'Pick a customer with an address'),
    t('CUSTOM_ORDER_REASON_BUSINESS', 'Pick a business'),
    isOrderByProducts || !commentMissing || !extraFields?.total
      ? t('CUSTOM_ORDER_REASON_ITEMS', 'Add a product or a total')
      : t('VALIDATION_ERROR_REQUIRED', 'Name is required').replace('_attribute_', t('COMMENT', 'Comment'))
  ]

  const stepLabels = [
    t('CUSTOMER', 'Customer'),
    t('BUSINESS', 'Business'),
    t('ITEMS', 'Items'),
    t('CUSTOM_ORDER_STEP_PAYMENT', 'Payment')
  ]

  const goToStep = (index) => {
    if (index <= firstOpenStep) setStep(index)
  }

  const handleContinue = () => {
    if (activeStep < LAST_STEP && stepReady[activeStep]) setStep(activeStep + 1)
  }

  // ── Money, as the order will carry it ──
  const totalNumber = Number(extraFields?.total)
  let total = null
  if (isOrderByProducts) {
    if (hasCartProducts && typeof cart?.total === 'number') total = parsePrice(cart.total)
  } else if (extraFields?.total) {
    total = Number.isFinite(totalNumber) ? parsePrice(totalNumber) : extraFields.total
  }

  // ── Summary: only what is already chosen ──
  // redesign fix-qa: E3. No type on the order means «Not set yet», not a made-up «Delivery».
  // redesign fix-qa C3 (B14): except by total, where the controller sends `delivery_type: options.type || 1`:
  // the order leaves as Delivery, so that is what the summary says.
  const orderType = orderState?.options?.type || (isOrderByProducts ? undefined : 1)
  const orderTypeLabel = ORDER_TYPE_LABELS[orderType]
  const customerName = [selectedUser?.name, selectedUser?.lastname].filter(Boolean).join(' ')
  const customerPhone = selectedUser?.cellphone || selectedUser?.phone
  let itemLines = null
  if (isOrderByProducts) {
    if (hasCartProducts) itemLines = cart.products.map(product => `${product?.quantity} × ${product?.name}`)
  } else if (extraFields?.total) {
    itemLines = [t('BY_TOTAL', 'By total')]
  }
  const summaryBlocks = [
    {
      id: 'customer',
      label: t('CUSTOMER', 'Customer'),
      lines: selectedUser ? [customerName, customerPhone].filter(Boolean) : null,
      step: STEP_CUSTOMER
    },
    {
      id: 'address',
      label: t('ADDRESS', 'Address'),
      lines: selectedUser && customerAddress?.address ? [customerAddress.address] : null,
      step: STEP_CUSTOMER
    },
    {
      id: 'type',
      label: t('DELIVERY_TYPE', 'Delivery type'),
      lines: stepReady[STEP_CUSTOMER] && orderTypeLabel ? [t(orderTypeLabel[0], orderTypeLabel[1])] : null,
      step: STEP_BUSINESS
    },
    {
      id: 'business',
      label: t('BUSINESS', 'Business'),
      lines: selectedBusiness?.name ? [selectedBusiness.name] : null,
      step: STEP_BUSINESS
    },
    {
      id: 'items',
      label: t('ITEMS', 'Items'),
      lines: itemLines,
      step: STEP_ITEMS
    }
  ]

  // ── Footer ──
  let continueLabel = t('CONTINUE', 'Continue')
  let onContinue = handleContinue
  let continueDisabled = !stepReady[activeStep]
  let continueReason = stepReasons[activeStep]
  let continueBusy = false
  if (activeStep === STEP_PAYMENT) {
    const placeLabel = total ? `${t('CUSTOM_ORDER_PLACE', 'Place order')} · ${total}` : t('CUSTOM_ORDER_PLACE', 'Place order')
    onContinue = handlePlaceOrder
    continueDisabled = false
    if (isOrderByProducts) {
      // The Checkout of today owns the rules of the order; the footer shows its action and its state. Until it
      // registers (it is still loading the cart) the footer has Back only.
      continueLabel = checkoutPlaceOrder ? placeLabel : null
      onContinue = checkoutPlaceOrder?.place
      continueDisabled = !!checkoutPlaceOrder?.disabled
      continueReason = checkoutPlaceOrder?.reason
      continueBusy = !!checkoutPlaceOrder?.placing
    } else {
      continueLabel = placeLabel
      continueBusy = !!actionState?.loading
    }
  }

  // redesign fix-qa E9: the options of the address load silently (the global Alert showed an empty «Error / Accept»
  // modal when they failed); the failure is written in the steps that need them, with the text the API gave.
  // redesign F6e (P5-01): the failure of the order type is another problem, with its own state and its own retry.
  const [optionsError, setOptionsError] = useState(null)
  const [typeError, setTypeError] = useState(null)
  const handleTypeFailure = (message, retry) => setTypeError(message ? { message, retry } : null)

  // redesign F6f (Q5-03): «Try again» keeps its notice mounted while it retries (busy, same name, the focus where it
  // was). When the notice goes because the retry worked, the focus moves to the control the error was about, or to the
  // step title: never to <body>, outside the dialog. When the retry fails again the focus stays on «Try again».
  const [optionsRetrying, setOptionsRetrying] = useState(false)
  const [typeRetrying, setTypeRetrying] = useState(false)
  const noticesRef = useRef(null)
  // redesign W0-2c (D-23): the step panel anchors the way to the step title, for the focus after «Try again» of a step boundary
  const stepTitleAnchor = useRef(null)
  const focusStepTitle = () => stepTitleAnchor.current?.closest('.odc-wizard')?.querySelector('[data-wizard-step-title]') ?? null
  const pendingFocus = useRef({ options: null, type: null })
  const rememberRetryFocus = (kind, button) => {
    pendingFocus.current[kind] = {
      button,
      root: button.closest('.odc-wizard'),
      // only an operator who was on the notice has a focus to keep
      hadFocus: !!noticesRef.current?.contains(document.activeElement)
    }
  }
  const focusAfterRetry = (kind, root) => {
    const panel = (step) => root?.querySelector(`[data-step="${step}"]:not([hidden])`)
    const control = kind === 'type'
      ? panel('business')?.querySelector('[data-order-type]')?.querySelector('[aria-pressed="true"], select, button')
      : panel('customer')?.querySelector('[data-subview-opener="address_list"]')
    ;(control || root?.querySelector('[data-wizard-step-title]'))?.focus()
  }
  useEffect(() => {
    for (const kind of ['options', 'type']) {
      const pending = pendingFocus.current[kind]
      if (!pending || (kind === 'options' ? optionsRetrying : typeRetrying)) continue
      pendingFocus.current[kind] = null
      const active = document.activeElement
      // the operator moved on while it retried: that is where the focus belongs
      if (!pending.hadFocus || (active && active !== document.body)) continue
      if ((kind === 'options' ? optionsError : typeError) && pending.button.isConnected) pending.button.focus()
      else focusAfterRetry(kind, pending.root)
    }
  }, [optionsError, typeError, optionsRetrying, typeRetrying])

  const retryType = async (event) => {
    const retry = typeError?.retry
    if (!retry || typeRetrying) return
    rememberRetryFocus('type', event.currentTarget)
    setTypeRetrying(true)
    // The selector tells the host when the type changes (`onFailure(null)`) or is refused again (a new message).
    try {
      await retry()
    } finally {
      setTypeRetrying(false)
    }
  }
  const optionsRequest = useRef(0)
  const loadOrderOptions = async (addressId, { retrying = false } = {}) => {
    const request = ++optionsRequest.current
    // a retry leaves its notice in place until it knows the result
    if (!retrying) setOptionsError(null)
    try {
      const result = await changeAddress(addressId, undefined, { silent: true })
      if (request !== optionsRequest.current) return
      if (result?.ok === false) {
        // redesign F6e (P5-02): translated like the order type failure and the global Alert of main.
        setOptionsError(translateApiMessage(t, result.error, t('CUSTOM_ORDER_OPTIONS_ERROR', 'The options for this address could not be loaded.')))
      } else if (retrying) {
        setOptionsError(null)
      }
    } finally {
      if (request === optionsRequest.current) setOptionsRetrying(false)
    }
  }
  const retryOptions = (event) => {
    if (optionsRetrying) return
    rememberRetryFocus('options', event.currentTarget)
    setOptionsRetrying(true)
    return loadOrderOptions(customerAddress?.id, { retrying: true })
  }

  useEffect(() => {
    if (!customerAddress?.id) {
      optionsRequest.current += 1
      setOptionsError(null)
      setOptionsRetrying(false)
      // without a customer the step of the order type is gone, and so is its refusal
      setTypeError(null)
      return
    }
    setOptionsRetrying(false)
    loadOrderOptions(customerAddress.id)
  }, [customerAddress?.id])

  useEffect(() => {
    if (customersPhones?.error) {
      setAlertState({ open: true, content: [customersPhones?.error], source: 'phone' })
    }
  }, [customersPhones?.error])

  useEffect(() => {
    if (actionState?.error) {
      setAlertState({ open: true, content: [].concat(actionState?.error), source: 'action' })
    }
  }, [actionState])

  useEffect(() => {
    if (!isOrderByProducts) {
      setExtraFields({ external_id: extraFields?.external_id })
    }
  }, [isOrderByProducts])

  useEffect(() => {
    setReachedSteps(reached => reached[activeStep] ? reached : { ...reached, [activeStep]: true })
  }, [activeStep])

  // A step whose data was lost is left behind for the first one that is not ready.
  useEffect(() => {
    if (step > firstOpenStep) setStep(firstOpenStep)
  }, [firstOpenStep])

  // The Sheet asks for confirmation before it discards, but only when there is something to lose.
  useEffect(() => {
    onDirtyChange?.(!!selectedUser)
  }, [selectedUser])
  useEffect(() => () => onDirtyChange?.(false), [])

  const renderAlerts = (sources) => {
    if (!alertState.open || !sources.includes(alertState.source)) return null
    const lastIndex = alertState.content.length - 1
    return alertState.content.map((message, index) => (
      <InlineNotice
        key={`${alertState.source}-${index}`}
        tone='danger'
        role='alert'
        action={index === lastIndex
          ? <Button variant='link' size='sm' onClick={handleCloseAlert}>{t('ACCEPT', 'Accept')}</Button>
          : undefined}
      >
        {message}
      </InlineNotice>
    ))
  }

  // redesign F6e (P5-01): both failures are written above the step, whichever step the operator is in (main's global
  // Alert showed them anywhere), until each is resolved. One sentence and one action each; the action retries
  // that very problem.
  const renderNotices = () => (optionsError || typeError) && (
    <div ref={noticesRef} className='odc-wizard-notice odc-wizard-notices'>
      {optionsError && (
        <InlineNotice
          tone='danger'
          role='alert'
          action={<Button variant='link' size='sm' busy={optionsRetrying} onClick={retryOptions}>{t('TRY_AGAIN', 'Try again')}</Button>}
        >
          {optionsError}
        </InlineNotice>
      )}
      {typeError && (
        <InlineNotice
          tone='danger'
          role='alert'
          action={typeError.retry ? <Button variant='link' size='sm' busy={typeRetrying} onClick={retryType}>{t('TRY_AGAIN', 'Try again')}</Button> : undefined}
        >
          {typeError.message}
        </InlineNotice>
      )}
    </div>
  )

  // redesign fix-qa: E3. A runtime error inside a step is shown in the step; the rest of the wizard keeps working.
  const guardStep = (content) => (
    <StepBoundary
      resetKey={activeStep}
      focusOnReset={focusStepTitle}
      focusOnError={focusStepTitle} // redesign W0-2 r2 (W0-Q1-02)
      fallback={({ reset }) => (
        <InlineNotice
          tone='danger'
          role='alert'
          action={<Button variant='link' size='sm' onClick={reset}>{t('TRY_AGAIN', 'Try again')}</Button>}
        >
          {t('CUSTOM_ORDER_STEP_ERROR', 'This step could not be shown. Try again, or go back a step and return.')}
        </InlineNotice>
      )}
    >
      {content}
    </StepBoundary>
  )

  const externalIdField = (
    <FormControl className='odc-wizard-field'>
      <label htmlFor='custom-order-external-id'>
        {t('EXTERNAL_ID', 'External ID')}
        <span>{t('OPTIONAL', 'Optional')}</span>
      </label>
      <Input
        id='custom-order-external-id'
        value={extraFields?.external_id || ''}
        onChange={(e) => setExtraFields({ ...extraFields, external_id: e.target.value })}
        placeholder={t('EXTERNAL_ID', 'External ID')}
      />
    </FormControl>
  )

  return (
    <Wizard
      steps={STEP_IDS.map((id, index) => ({
        id,
        label: stepLabels[index],
        state: index === activeStep ? 'current' : (index < firstOpenStep ? 'done' : 'pending')
      }))}
      current={activeStep}
      onSelectStep={goToStep}
      stepperLabel={t('CUSTOM_ORDER_STEPS', 'Steps')}
      doneLabel={t('CUSTOM_ORDER_STEP_DONE', 'Done')}
      pendingLabel={t('CUSTOM_ORDER_STEP_PENDING', 'Not reached yet')}
      title={stepLabels[activeStep]}
      summary={(
        <Summary
          label={t('CUSTOM_ORDER_SUMMARY', 'Order summary')}
          blocks={summaryBlocks}
          total={total}
          totalLabel={t('TOTAL', 'Total')}
          editLabel={t('EDIT', 'Edit')}
          notSetLabel={t('NOT_SET_YET', 'Not set yet')}
          onEdit={goToStep}
        />
      )}
      footerHost={footerHost}
      footer={(
        <WizardFooter
          showBack={activeStep > STEP_CUSTOMER}
          backLabel={t('BACK', 'Back')}
          onBack={() => setStep(activeStep - 1)}
          continueLabel={continueLabel}
          onContinue={onContinue}
          continueDisabled={continueDisabled}
          reason={continueReason}
          busy={continueBusy}
        />
      )}
    >
      {renderNotices()}
      {/* This step stays mounted while hidden: SelectCustomer keeps its own chosen-customer state. */}
      <div ref={stepTitleAnchor} className='odc-wizard-panel custom-order-content' data-step='customer' hidden={activeStep !== STEP_CUSTOMER}>
        {activeStep === STEP_CUSTOMER && renderAlerts(['phone'])}
        {guardStep((
          <SelectCustomer
            phone={phone}
            customersPhones={customersPhones}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            onChangeNumber={onChangeNumber}
            customerAddress={customerAddress}
            hideTitle
          />
        ))}
      </div>
      {(activeStep === STEP_BUSINESS || reachedSteps[STEP_BUSINESS]) && customerAddress?.location && (
        <div className='odc-wizard-panel' data-step='business' hidden={activeStep !== STEP_BUSINESS}>
          {guardStep((
            <>
              {/* redesign F6d (Q3-12): the selector's refusals are written inline, not in a dialog of their own; F6e (P5-01): in their own notice, with a retry of the type. */}
              <OrderTypeSelector onFailure={handleTypeFailure} />
              <SelectBusinesses
                businessList={businessList}
                selectedBusiness={selectedBusiness}
                setSelectedBusiness={setSelectedBusiness}
              />
              {/* The map is drawn only while the step shows: Google measures a hidden box as empty. */}
              {activeStep === STEP_BUSINESS && (
                <div className='odc-wizard-map odc-wizard-block-gap'>
                  <Map
                    customer={selectedUser}
                    customerLocation={customerAddress?.location}
                    business={selectedBusiness}
                  />
                </div>
              )}
            </>
          ))}
        </div>
      )}
      {(activeStep === STEP_ITEMS || reachedSteps[STEP_ITEMS]) && (
        <div className='odc-wizard-panel' data-step='items' hidden={activeStep !== STEP_ITEMS}>
          {guardStep((
            <>
              <SegmentedControl
                label={t('CUSTOM_ORDER_MODE', 'Order mode')}
                value={isOrderByProducts ? MODE_PRODUCTS : MODE_TOTAL}
                onValueChange={mode => setIsOrderByProducts(mode === MODE_PRODUCTS)}
                options={[
                  { value: MODE_PRODUCTS, label: t('BY_PRODUCTS', 'By products') },
                  { value: MODE_TOTAL, label: t('BY_TOTAL', 'By total') }
                ]}
              />
              {!isOrderByProducts && (
                <>
                  <FormControl className='odc-wizard-field'>
                    <label htmlFor='custom-order-total'>{t('TOTAL', 'Total')}</label>
                    <Input
                      id='custom-order-total'
                      value={extraFields?.total || ''}
                      onKeyPress={(e) => {
                        if (!/^[0-9.]$/.test(e.key)) {
                          e.preventDefault()
                        }
                      }}
                      onChange={(e) => setExtraFields({ ...extraFields, total: e.target.value })}
                      placeholder={t('TOTAL', 'Total')}
                    />
                  </FormControl>
                  {externalIdField}
                  <FormControl className='odc-wizard-field'>
                    <label htmlFor='custom-order-comment'>{t('COMMENT', 'Comment')}</label>
                    <TextArea
                      id='custom-order-comment'
                      value={extraFields?.comment || ''}
                      onChange={(e) => setExtraFields({ ...extraFields, comment: e.target.value })}
                      placeholder={t('COMMENT', 'Comment')}
                    />
                  </FormControl>
                </>
              )}
              {selectedBusiness && isOrderByProducts && (
                <>
                  <div className='odc-wizard-block-gap'>
                    {/* Keyed by business: the search of another business starts empty. */}
                    <SelectProducts
                      key={selectedBusiness?.id}
                      productList={productList}
                      getProducts={getProducts}
                      handeUpdateProductCart={handeUpdateProductCart}
                      cart={cart}
                      business={selectedBusiness}
                    />
                  </div>
                  {externalIdField}
                </>
              )}
            </>
          ))}
        </div>
      )}
      {activeStep === STEP_PAYMENT && (
        <div className='odc-wizard-panel' data-step='payment'>
          {guardStep((
            isOrderByProducts
              ? hasCartProducts && (
                <Checkout
                  cartUuid={cart.uuid}
                  onPlaceOrderClick={(data, paymethod, cart) => {
                    cart?.order_id && handleOpenCustomOrderDetail?.(cart.order_id)
                    onClose?.()
                  }}
                  extraFields={extraFields}
                  onRegisterPlaceOrder={setCheckoutPlaceOrder}
                />
              )
              : (
                <>
                  <p className='odc-wizard-payment-line'>
                    <span>{t('TOTAL', 'Total')}</span>
                    <span>{total}</span>
                  </p>
                  <p className='odc-wizard-payment-line'>
                    <span>{t('PAYMENT_METHOD', 'Payment method')}</span>
                    <span>{t('CASH', 'Cash')}</span>
                  </p>
                </>
                )
          ))}
        </div>
      )}
      {renderAlerts(['validation', 'action'])}
    </Wizard>
  )
}

export const CustomOrderDetails = (props) => {
  const customOrderProps = {
    ...props,
    UIComponent: CustomOrderDetailsUI
  }
  return <CustomOrderDetailsController {...customOrderProps} />
}
