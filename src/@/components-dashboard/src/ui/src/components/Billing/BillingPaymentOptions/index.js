import React, { useContext, useEffect, useRef, useState } from 'react'

import { BillingPaymentOptions as BillingPaymentController, useLanguage } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { useProjectState } from '../../../contexts/ProjectContext'
import { parseBillingPrice } from '../../../utils'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { focusPageStart, isShown } from '../../../../../utils/focusPageStart'
import { Button, Dialog, InlineNotice, SegmentedControl, Skeleton, StatusBadge } from '../../Shared/Product'
import { PaymentMethodPicker } from '../PaymentMethodPicker'
import {
  PLAN_CHANGE_MODIFY_UNSUPPORTED,
  PLAN_CHANGE_PAYMENT_PENDING,
  PLAN_CHANGE_PENDING_ATTEMPT,
  otherPastDueCount,
  isPendingModify,
  pickSubscription,
  rememberBillingResult,
  requestSubscriptions,
  subscriptionSummary,
  toMessages,
  upgradePrices
} from './billingModel'

import './billing-payment.css'

// redesign BM-C (D5, M-BM4, M-BM21): once a charge may have gone out, «Pay» stays off until the page reloads, also if the dialog
// is closed and opened again (a new dialog starts from a clean controller). Only a reload clears this module flag.
let unconfirmedPayment = false
export const resetBillingUnconfirmedForTests = () => { unconfirmedPayment = false }

// redesign BM-C (audit §5): the subscription a retry acts on is chosen once and never changes under the user. When the controller
// replaces the list with the POST answer the same id is looked up again (fresh state), and if it is not there the object we had
// stays. Idempotent, so it is safe to call on every render.
const resolveTarget = ({ current, subscriptions, isUpgrade, upgradePlanIds }) => {
  if (current?.id != null) {
    return Array.isArray(subscriptions) ? (subscriptions.find(sub => sub?.id === current.id) ?? current) : current
  }
  return pickSubscription({ subscriptions, isUpgrade, upgradePlanIds })
}

// redesign BM-C (D2, M-BM3): money always shows its cents. `parseBillingPrice` (as main) prints a whole amount without them
// ($299) and rounds the rest ($499.17); a whole amount asks for the padded form so a column of prices reads the same.
const money = (amount) => parseBillingPrice(amount, { isTruncable: Number.isInteger(Number(amount)) })

// a subscription's interval as the period the controller asks for.
const PERIOD_OF_INTERVAL = { month: 'monthly', year: 'annual' }

// The translation decides where the amount goes: split on the token and put the figure in its own node. The price goes in as a
// node, never as a replacement string (it carries `$`).
const withFigure = (template, price) => String(template).split('_price_').map((part, index) => (
  index === 0
    ? part
    : <React.Fragment key={index}><span className='odc-figure'>{price}</span>{part}</React.Fragment>
))

// redesign BM-C (C-4): App.js unmounts the dialog in the render that closes it, so Base UI cannot give the focus back (and the opener
// may not exist: the past-due start-up opens it by itself). If the focus ended up on <body>, it goes to the «Pay now» of the shell notice
// when there is one, else to the start of the page content, the same place as «Skip to content». A focus that is already on a real
// control (the «Upgrade to Pro» of the menu) is left alone.
const restoreFocus = () => {
  const active = document.activeElement
  if (active && active !== document.body && document.contains(active)) return
  const payNow = [...document.querySelectorAll('[data-slot="banner-stack"] [role="alert"] button')].find(isShown)
  if (payNow) {
    payNow.focus()
    return
  }
  focusPageStart()
}

// redesign BM-C (D1, D2, D5, D6, M-BM7, M-BM8, M-BM9): the Billing dialog is a Product Dialog (focus trapped, named, bottom sheet on a phone) whose
// footer is fixed, so the action never falls below the fold. What is being paid comes first; the card picker (lot B) comes after.
export const BillingPaymentOptionsUI = (props) => {
  const {
    open = true,
    onClose,
    isUpgradeToPro,
    handlePaymethodChange,
    handlePlaceOrder,
    paymethodSelected,
    subscriptionsState,
    placeOrderState,
    confirmState,
    planStateToUpgrade,
    upgradeProPlanId,
    showPlanInformation
  } = props
  const [, t] = useLanguage()

  const cancelRef = useRef(null)
  const targetRef = useRef(null)
  const reloadingRef = useRef(false)
  const reloadButtonRef = useRef(null)
  // redesign BM-C: the controller asks for the subscriptions and the plan in its effects, after the first paint. Until then
  // «nothing loaded» is not «nothing exists»: the notices that say so wait one tick.
  const [ready, setReady] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)
  const [period, setPeriod] = useState('monthly')
  useEffect(() => { setReady(true) }, [])

  const plan = planStateToUpgrade?.plan
  const planLoading = !!planStateToUpgrade?.loading
  const planPresent = !!plan && Object.keys(plan).length > 0
  const noPlan = !!isUpgradeToPro && !planLoading && !!plan && Object.keys(plan).length === 0
  const subscriptions = subscriptionsState?.subscriptions
  const subsLoading = !!subscriptionsState?.loading
  // redesign BM-C (M-BM17): a failed load of the subscriptions is said as such, never as «pay your current subscription first».
  const subsError = subscriptionsState?.error ?? null

  targetRef.current = resolveTarget({
    current: targetRef.current,
    subscriptions,
    isUpgrade: !!isUpgradeToPro,
    upgradePlanIds: upgradeProPlanId
  })
  const target = targetRef.current

  const paying = !!placeOrderState?.loading
  const succeeded = !placeOrderState?.error && !!placeOrderState?.result
  const declined = placeOrderState?.kind === 'declined'
  const uncertain = placeOrderState?.kind === 'uncertain' || unconfirmedPayment

  useEffect(() => {
    if (placeOrderState?.kind !== 'uncertain') return
    unconfirmedPayment = true
    // redesign BM-C (D-BM1): «Pay» turns off under the focus; it goes to the only way out instead of falling to <body>.
    requestAnimationFrame(() => reloadButtonRef.current?.focus())
  }, [placeOrderState?.kind])

  // redesign BM-C (M-BM5): the same reload as main, without a toast before it: the one-shot mark tells the shell what happened.
  useEffect(() => {
    if (!succeeded || reloadingRef.current) return
    reloadingRef.current = true
    rememberBillingResult(isUpgradeToPro ? 'upgraded' : 'paid')
    window.location.reload()
  }, [succeeded])

  const close = () => {
    onClose?.()
    requestAnimationFrame(restoreFocus)
  }

  const reload = () => window.location.reload()

  // redesign BM-C (M-BM1): nothing navigates or reloads on an error. Every message of the API, one per line, plus the one from the card confirmation.
  const orderMessages = declined
    ? (placeOrderState.messages?.length ? placeOrderState.messages : toMessages(placeOrderState.error))
    : []
  const confirmMessages = confirmState?.error ? toMessages(confirmState.error) : []
  const errorLines = [...new Set([...orderMessages, ...confirmMessages])]
  const showError = declined || confirmMessages.length > 0
  // the 409 of billing-api#100. The same request would get the same answer, so each one offers its way forward.
  // An earlier attempt still waiting (mixed_interval_pending, payment_pending) is paid from the dialog when the list has it: the
  // one of a pending plan change first (an incomplete one, or an active one changed by modify, billing-api#103), else any
  // incomplete one. Without it, only a reload. A change by modify that was declined (card or 3DS) is paid the same way.
  const modifyUnsupported = declined && errorLines.includes(PLAN_CHANGE_MODIFY_UNSUPPORTED)
  const waitingAttempt = declined && (errorLines.includes(PLAN_CHANGE_PENDING_ATTEMPT) || errorLines.includes(PLAN_CHANGE_PAYMENT_PENDING))
  const attempts = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub?.status === 'incomplete' || isPendingModify(sub)) : []
  const pendingAttempt = declined && (waitingAttempt || attempts.some(isPendingModify))
    ? (requestSubscriptions(attempts)[0] ?? null)
    : null
  const errorText = (message) => {
    if (message === PLAN_CHANGE_MODIFY_UNSUPPORTED) {
      return t('BILLING_PLAN_CHANGE_MODIFY_UNSUPPORTED', "Your project has add-ons billed on another period, so we can't change the plan automatically. Contact us and we'll change it for you.")
    }
    if (message === PLAN_CHANGE_PENDING_ATTEMPT) {
      return t('BILLING_PLAN_CHANGE_PENDING_ATTEMPT', 'You have a pending payment from an earlier plan change. Pay it to continue, or wait for it to expire (about 24 h) and choose another plan.')
    }
    if (message === PLAN_CHANGE_PAYMENT_PENDING) {
      return t('BILLING_PLAN_CHANGE_PAYMENT_PENDING', 'A payment for your plan change is still being confirmed. Complete it or wait a few minutes, then try again.')
    }
    return translateApiMessage(t, message, t('ERROR', 'Error'))
  }

  // The summary
  const summary = subscriptionSummary(target)
  // redesign BM-C (M-BM18, C-3): only the first overdue subscription is paid (as main); the summary says how many follow.
  const overdueCount = isUpgradeToPro ? 0 : otherPastDueCount({ subscriptions, targetId: target?.id })
  const prices = upgradePrices(plan)
  const hasBothPrices = !!prices.monthly && !!prices.annual
  // Owner decision 16 B (2026-10-21): with a single price the plan decides the period; the control only chooses when there are two.
  const chargedPeriod = hasBothPrices ? period : (prices.annual && !prices.monthly ? 'annual' : 'monthly')
  const planName = planPresent && plan.name ? plan.name : null
  const upgradeLabel = planName
    ? t('BILLING_UPGRADE_TITLE', 'Upgrade to _plan_').split('_plan_').join(planName)
    : t('UPGRADE_TO_PRO', 'Upgrade to Pro')
  // redesign BM-C (M-BM17, C-2): the reason main only gave after the click (and a trip to /home) is said before it.
  const noActiveSubscription = !!isUpgradeToPro && ready && !subsLoading && !subsError && !target
  const loadingSummary = isUpgradeToPro ? planLoading : (subsLoading && !target)
  // redesign (row 51 main-3): paying without an overdue subscription sent an undefined plan and ended in «Project plan id is
  // missing». With nothing to act on, «Pay» stays off (it never charged, so nothing charged changes); the notice only waits for a
  // settled, error-free answer, as the upgrade one above does.
  const nothingToPay = !isUpgradeToPro && ready && !subsLoading && !target
  const noOverdueSubscription = nothingToPay && !subsError

  const intervalUnit = (interval) => {
    if (interval === 'month') return t('PER_MONTH', '/ month')
    if (interval === 'year') return t('PER_YEAR', '/ year')
    return null
  }

  // Same conditions as main (index.js:200-203), plus the ones this dialog adds: the card is still being set as the default, a
  // doubtful charge, an upgrade without an active subscription, nothing overdue to pay, and the success that is about to reload.
  const payDisabled = !paymethodSelected?.id || subsLoading || planLoading || noPlan || cardBusy || uncertain ||
    noActiveSubscription || nothingToPay || succeeded || modifyUnsupported || !!pendingAttempt

  const pay = () => handlePlaceOrder({
    propPlanId: planStateToUpgrade?.plan?.id || target?.plan?.plan?.id,
    period: chargedPeriod || target?.interval,
    subscription: target
  })

  // The retry route of that subscription (buildBillingSubscriptionRequest), never a new plan.
  const payPending = () => handlePlaceOrder({
    propPlanId: pendingAttempt?.plan?.plan?.id,
    period: PERIOD_OF_INTERVAL[pendingAttempt?.interval],
    subscription: pendingAttempt,
    payPending: true
  })

  // The messenger opens over the page, so the dialog closes first. Without Intercom (blocked, not loaded) the text alone says what to do.
  const contactSupport = () => {
    close()
    window.Intercom('showNewMessage')
  }

  const errorAction = modifyUnsupported
    ? typeof window.Intercom === 'function' && <Button size='sm' onClick={contactSupport}>{t('CONTACT_SUPPORT', 'Contact support')}</Button>
    : pendingAttempt
      ? (
        <Button size='sm' disabled={!paymethodSelected?.id || cardBusy || paying} onClick={payPending}>
          {t('BILLING_PAY_PENDING_PAYMENT', 'Pay the pending payment')}
        </Button>
        )
      : waitingAttempt && <Button size='sm' onClick={reload}>{t('RELOAD', 'Reload')}</Button>

  const payLabel = isUpgradeToPro ? upgradeLabel : t('BILLING_PAY_OVERDUE', 'Pay overdue subscription')
  const monthlyShown = chargedPeriod === 'annual' ? prices.annual?.perMonth : prices.monthly?.amount

  // redesign BM-C (D6, M-BM3, C-5): the plan card keeps main's detail; Annual shows the monthly equivalent and `BILLED_YEARLY` (never `PRICE_PLAN_ANNUAL`).
  const renderUpgradeSummary = () => (
    <div className='odc-bpay-summary'>
      <div className='odc-bpay-plan-head'>
        <p className='odc-bpay-plan-name'>{plan.name}</p>
      </div>
      {hasBothPrices && (
        <div className='odc-bpay-period'>
          <SegmentedControl
            label={t('BILLING_PERIOD', 'Billing period')}
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: 'monthly', label: t('MONTHLY', 'Monthly') },
              { value: 'annual', label: t('ANNUAL', 'Annual') }
            ]}
          />
        </div>
      )}
      {monthlyShown != null && (
        <p className='odc-bpay-price'>
          <span className='odc-figure'>{money(monthlyShown)}</span>
          <span className='odc-bpay-unit'>{t('PER_MONTH', '/ month')}</span>
        </p>
      )}
      {chargedPeriod === 'annual' && prices.annual && (
        <p className='odc-bpay-note'>{withFigure(t('BILLED_YEARLY', 'Billed _price_ yearly'), money(prices.annual.amount))}</p>
      )}
      {plan.description && <div className='odc-bpay-html' dangerouslySetInnerHTML={{ __html: plan.description }} />}
      {plan.products?.some(item => item.product?.description) && (
        <section className='odc-bpay-facts'>
          <h3 className='odc-bpay-facts-title'>{t('PLAN_DETAILS', 'Plan Details')}</h3>
          <ul className='odc-bpay-list'>
            {plan.products.map(item => item.product?.description && (
              <li key={item.product.id}>{item.product.description}</li>
            ))}
          </ul>
        </section>
      )}
      {plan.features?.length > 0 && (
        <section className='odc-bpay-facts'>
          <h3 className='odc-bpay-facts-title'>{t('ALL_FEATURES', 'All features')}</h3>
          <ul className='odc-bpay-list'>
            {plan.features.map((feature, index) => <li key={index}>{feature}</li>)}
          </ul>
        </section>
      )}
    </div>
  )

  // redesign BM-C (D1, M-BM2): what is overdue, with its recurring price, never as «the amount to pay».
  const renderOverdueSummary = () => (
    <div className='odc-bpay-summary'>
      <div className='odc-bpay-plan-head'>
        <p className='odc-bpay-plan-name'>{summary.name}</p>
        <StatusBadge family='cancel' label={t('HOME_PROJECT_PAST_DUE', 'Payment past due')} />
      </div>
      {summary.amount != null && (
        <p className='odc-bpay-price'>
          <span className='odc-figure'>{money(summary.amount)}</span>
          {intervalUnit(summary.interval) && <span className='odc-bpay-unit'>{intervalUnit(summary.interval)}</span>}
        </p>
      )}
    </div>
  )

  const renderSummary = () => {
    if (loadingSummary) {
      return (
        <div className='odc-bpay-summary' aria-busy='true'>
          <Skeleton size='40%' />
          <Skeleton size='25%' />
        </div>
      )
    }
    if (isUpgradeToPro) return planPresent ? renderUpgradeSummary() : null
    return summary.name ? renderOverdueSummary() : null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !paying) close() }}
      size='md'
      title={isUpgradeToPro ? upgradeLabel : t('BILLING_PAY_OVERDUE_TITLE', 'Pay your overdue subscription')}
      description={isUpgradeToPro
        ? t('CHANGE_PAUSE_PLAN_TEXT', 'Change, pause or cancel your plan at any time.')
        : t('BILLING_PAY_OVERDUE_DESCRIPTION', 'Your account is past due. Pay the outstanding invoice to keep it active.')}
      closeLabel={t('CLOSE', 'Close')}
      initialFocus={cancelRef}
      dismissible={!paying}
      // redesign (row 51 R1-1): Escape and Cancel were already off during the charge; the X goes off with them
      closeDisabled={paying}
      footer={(
        <>
          <Button ref={cancelRef} disabled={paying} onClick={close}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' busy={paying} disabled={payDisabled} onClick={pay}>{payLabel}</Button>
        </>
      )}
    >
      <div className='odc-bpay'>
        {renderSummary()}

        {overdueCount > 0 && (
          <p className='odc-bpay-note'>
            {overdueCount === 1
              ? t('BILLING_MORE_OVERDUE_ONE', '1 more overdue subscription follows after this payment.')
              : t('BILLING_MORE_OVERDUE_OTHER', '_count_ more overdue subscriptions follow after this payment.').split('_count_').join(String(overdueCount))}
          </p>
        )}

        {ready && noPlan && (
          <InlineNotice tone='warning'>{t('NO_UPGRADE_PLAN_FOUND', 'No plan found to upgrade')}</InlineNotice>
        )}
        {noActiveSubscription && (
          <InlineNotice tone='warning'>
            {t('CURRENT_SUBCRIPTION_NOT_PAYED', 'Please pay your current subscription before you upgrade to Pro')}
          </InlineNotice>
        )}
        {noOverdueSubscription && (
          <InlineNotice tone='info'>
            {t('BILLING_NOTHING_TO_PAY', 'You have no overdue subscription to pay.')}
          </InlineNotice>
        )}
        {showPlanInformation && (
          <InlineNotice tone='info'>
            {t('UPGRADE_PLAN_INFORMATION_PRO', 'You can create another project, pay per store or upgrade to pro plan')}
          </InlineNotice>
        )}

        {subsError && (
          <InlineNotice tone='danger' role='alert'>
            {toMessages(subsError).map((message, index) => (
              <span key={index}>{translateApiMessage(t, message, t('ERROR', 'Error'))}</span>
            ))}
          </InlineNotice>
        )}
        {showError && (
          <InlineNotice tone='danger' role='alert' action={errorAction || undefined}>
            {(errorLines.length ? errorLines : [null]).map((message, index) => (
              <span key={index}>{errorText(message)}</span>
            ))}
          </InlineNotice>
        )}
        {uncertain && (
          <InlineNotice
            tone='warning'
            role='alert'
            // redesign BM-C (M-BM4, M-BM21): a doubtful charge is never retried; the only way out is a reload
            action={<Button ref={reloadButtonRef} size='sm' onClick={reload}>{t('RELOAD', 'Reload')}</Button>}
          >
            {t('BILLING_PAYMENT_UNCONFIRMED', "We couldn't confirm the payment. Reload to see your account status before paying again.")}
          </InlineNotice>
        )}

        {/* redesign (row 51 main-1): the cards, the ⋮ and Add card do not answer while the charge is in flight */}
        <PaymentMethodPicker onSelectCard={handlePaymethodChange} onBusyChange={setCardBusy} disabled={paying} />
      </div>
    </Dialog>
  )
}

export const BillingPaymentOptions = (props) => {
  const [configFile] = useContext(ConfigFileContext)
  const [projectStatus] = useProjectState()

  const billingPaymentOptionsProps = {
    ...props,
    settings: configFile,
    projectId: projectStatus?.project?.id,
    UIComponent: BillingPaymentOptionsUI
  }
  return (
    <BillingPaymentController {...billingPaymentOptionsProps} />
  )
}
