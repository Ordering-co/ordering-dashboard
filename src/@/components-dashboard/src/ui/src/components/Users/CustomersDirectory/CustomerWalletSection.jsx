import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import { useLanguage, useUtils, UserWallet as UserWalletController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { CircleAlert, LockKeyhole } from '../../Shared/Icon'
import {
  ActivityTimeline,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineNotice,
  NumberField,
  SegmentedControl,
  Skeleton,
  TextArea
} from '../../Shared/Product'
import { customerName, isCashWalletOn, isPointsWalletOn } from './customerData'
import {
  formatCash,
  formatPoints,
  formatSignedCash,
  formatSignedPoints,
  resultingBalance,
  walletEvents
} from './walletEvents'
import './customer-wallet.css'

// redesign UC-B5 (decisions 4 and 5): the Wallet section of the customer panel. One «Adjust balance» form (Add / Remove)
// for the cash wallet and the points wallet, a confirmation that names the amount and the balance before and after
// (decision 25, C8), and the history as a feed. It writes into the controller through `handleChangeInput` exactly as the
// old two forms did, and it only calls `handleAddWalletMoney` / `handleReduceWalletMoney` from the confirmation.

// The text of a translation with its `_slot_` markers replaced by nodes (a figure keeps its own element)
const fill = (text, slots) => {
  const names = Object.keys(slots)
  return String(text)
    .split(new RegExp(`(${names.join('|')})`))
    .map((part, index) => (names.includes(part) ? <React.Fragment key={index}>{slots[part]}</React.Fragment> : part))
}

const figure = value => <span className='odc-figure'>{value}</span>

const WALLET_TYPES = { cash: 'cash', points: 'credit_point' }

const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value > 0

// what was typed in a wallet (`{ mode, amount, comment }`) outlives the switch to the other wallet. It counts as
// unsent when an amount or a comment is in it; a lone mode is kept but is not a change to lose.
const hasDraft = draft => Boolean(draft && (draft.amount != null || draft.comment !== ''))

// The API answers a list of messages, one text or nothing
const messagesOf = (error, t, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  const texts = [...new Set(list.map(message => translateApiMessage(t, message, fallback)))]
  return texts.length ? texts : [fallback]
}

const BalanceSkeleton = ({ label }) => (
  <div className='cw-balance' role='status' aria-busy='true'>
    <span className='odc-sr-only'>{label}</span>
    <Skeleton size='40%' block='var(--od-x-type-display-size)' />
  </div>
)

const HistorySkeleton = ({ label }) => (
  <div className='cw-history-skeleton' role='status' aria-busy='true'>
    <span className='odc-sr-only'>{label}</span>
    {[0, 1, 2].map(row => (
      <div key={row}>
        <Skeleton size='30%' />
        <Skeleton size='70%' />
      </div>
    ))}
  </div>
)

/**
 * The body of one wallet, the `UIComponent` of `K/UserWallet`. The controller hands it the wallet, its events, the
 * authors (`walletUsers`), `refreshWallet`, `handleChangeInput` and the two `{ ok, error }` actions. `kind` is
 * `'cash'` or `'points'`.
 */
const WalletBody = ({
  kind,
  user,
  configs,
  initialDraft,
  onDraftChange,
  intent,
  onIntentConsumed,
  walletState,
  walletEventsState,
  walletUsers,
  refreshWallet,
  handleChangeInput,
  handleAddWalletMoney,
  handleReduceWalletMoney
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const ids = { title: useId(), history: useId(), reason: useId(), locked: useId() }

  const isCash = kind === 'cash'
  const decimals = Number(configs?.format_number_decimal_length?.value) || 2
  const money = value => (isCash ? formatCash(value, parsePrice) : formatPoints(value, decimals))
  const signedMoney = value => (isCash ? formatSignedCash(value, parsePrice) : formatSignedPoints(value, decimals))

  const [mode, setMode] = useState(initialDraft?.mode ?? 'add')
  const [amount, setAmount] = useState(initialDraft?.amount ?? null)
  const [comment, setComment] = useState(initialDraft?.comment ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState(null)
  const [updated, setUpdated] = useState(false)
  // Writes into the controller that must not share a render: its handleChangeInput spreads the state it closed over.
  // A kept draft starts the queue: this controller is new, so the draft is written back to the side the form shows.
  const [queue, setQueue] = useState(() => {
    const writes = []
    const startsAdd = (initialDraft?.mode ?? 'add') === 'add'
    if (initialDraft?.amount != null) writes.push({ name: 'amount', value: String(initialDraft.amount), isAdd: startsAdd })
    if (initialDraft?.comment) writes.push({ name: 'description', value: initialDraft.comment, isAdd: startsAdd })
    return writes
  })

  const latest = useRef({})
  latest.current = { handleChangeInput, handleAddWalletMoney, handleReduceWalletMoney, refreshWallet, onDraftChange, onIntentConsumed }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!queue.length) return
    const [next, ...rest] = queue
    latest.current.handleChangeInput({ target: { name: next.name, value: next.value } }, next.isAdd)
    setQueue(rest)
  }, [queue])

  // Unsaved changes (auditor #16, ): the section keeps what is typed here for when the other wallet is shown
  // and tells the parent whether anything typed anywhere has not been sent. Unmounting does not discard it.
  useEffect(() => {
    latest.current.onDraftChange?.(kind, { mode, amount, comment })
  }, [kind, mode, amount, comment])

  const wallet = walletState?.wallet
  const loading = Boolean(walletState?.loading)
  const loadFailed = !loading && Boolean(walletState?.error)
  const locked = Boolean(wallet?.locked)
  const noWallet = !loading && !loadFailed && !wallet?.id
  const isAdd = mode === 'add'
  const valid = isAmount(amount)
  const canSubmit = valid && !loading && !loadFailed && !noWallet && !locked && !busy && queue.length === 0
  const name = customerName(user, t)
  const balance = wallet?.balance

  const reason = noWallet
    ? t('CUSTOMERS_WALLET_NO_WALLET', 'This customer has no wallet yet.')
    : (!valid && !locked && !loadFailed && !loading ? t('CUSTOMERS_WALLET_AMOUNT_HINT', 'Enter an amount greater than 0.') : null)

  const write = (field, value) => latest.current.handleChangeInput({ target: { name: field, value } }, isAdd)

  const changeAmount = next => {
    setAmount(next)
    setUpdated(false)
    write('amount', next == null ? '' : String(next))
  }

  const changeComment = next => {
    setComment(next)
    setUpdated(false)
    write('description', next)
  }

  const changeMode = next => {
    if (next === mode) return
    const writes = []
    // What was typed moves to the other side of the controller, and the side it leaves is emptied
    if (amount != null) writes.push({ name: 'amount', value: '', isAdd })
    if (comment !== '') writes.push({ name: 'description', value: '', isAdd })
    if (amount != null) writes.push({ name: 'amount', value: String(amount), isAdd: !isAdd })
    if (comment !== '') writes.push({ name: 'description', value: comment, isAdd: !isAdd })
    setMode(next)
    setUpdated(false)
    setQueue(current => [...current, ...writes])
  }

  // redesign apply-list row 20 (P-6, D-37): «Add points» in the Overview arrives as a one-shot intent: Add is chosen (even if Remove was,
  // what was typed moves with it) and the focus lands on the amount. It is consumed once, so a later visit behaves as before. The same
  // confirmation and the same `handleAddWalletMoney` follow: nothing is sent from here.
  const amountRef = useRef(null)
  const applied = useRef(null)
  useEffect(() => {
    if (!intent || intent.mode !== 'add' || (intent.wallet && intent.wallet !== kind) || applied.current === intent) return
    applied.current = intent
    changeMode('add')
    amountRef.current?.focus()
    latest.current.onIntentConsumed?.(intent)
  }, [intent])

  const pointsPlural = amount === 1 ? 'ONE' : 'OTHER'
  const amountText = valid ? money(amount) : ''
  const submitLabel = !valid
    ? t('CUSTOMERS_WALLET_ADJUST', 'Adjust balance')
    : isCash
      ? fill(isAdd ? t('CUSTOMERS_WALLET_ADD_AMOUNT', 'Add _amount_') : t('CUSTOMERS_WALLET_REMOVE_AMOUNT', 'Remove _amount_'), { _amount_: figure(amountText) })
      : fill(
        isAdd
          ? t(`CUSTOMERS_POINTS_ADD_${pointsPlural}`, amount === 1 ? 'Add _amount_ point' : 'Add _amount_ points')
          : t(`CUSTOMERS_POINTS_REMOVE_${pointsPlural}`, amount === 1 ? 'Remove _amount_ point' : 'Remove _amount_ points'),
        { _amount_: figure(amountText) }
      )

  const titleText = isCash
    ? (isAdd ? t('CUSTOMERS_WALLET_ADD_TITLE', "Add _amount_ to _name_'s cash wallet?") : t('CUSTOMERS_WALLET_REMOVE_TITLE', "Remove _amount_ from _name_'s cash wallet?"))
    : (isAdd
        ? t(`CUSTOMERS_POINTS_ADD_TITLE_${pointsPlural}`, amount === 1 ? "Add _amount_ point to _name_'s points wallet?" : "Add _amount_ points to _name_'s points wallet?")
        : t(`CUSTOMERS_POINTS_REMOVE_TITLE_${pointsPlural}`, amount === 1 ? "Remove _amount_ point from _name_'s points wallet?" : "Remove _amount_ points from _name_'s points wallet?"))

  const from = Number(balance) || 0
  const to = resultingBalance(balance, valid ? amount : 0, isAdd)

  const openConfirm = event => {
    event.preventDefault()
    if (!canSubmit) return
    setErrors(null)
    setUpdated(false)
    setConfirmOpen(true)
  }

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    setErrors(null)
    let result
    try {
      result = await (isAdd ? latest.current.handleAddWalletMoney() : latest.current.handleReduceWalletMoney())
    } catch (error) {
      // Not the text of a network failure («Failed to fetch»): the notice says it in the user's language
      result = { ok: false, error: null }
    }
    if (!mounted.current) return
    setBusy(false)
    setConfirmOpen(false)
    if (result?.ok) {
      setAmount(null)
      setComment('')
      setUpdated(true)
      // The controller adds the answer's amount to the balance (it may be text): the refresh shows the server's
      latest.current.refreshWallet?.()
    } else {
      setErrors(messagesOf(result?.error, t, t('CUSTOMERS_WALLET_ERROR', "The balance didn't change. Try again.")))
    }
  }

  const events = walletEventsState?.events || []
  const items = walletEvents(events, { t, users: walletUsers || [], parseDate }).map(item => ({
    id: item.id,
    at: item.at,
    title: (
      <>
        {item.amount != null && <span className='cw-event-amount odc-figure'>{signedMoney(item.amount)}</span>}
        <span className='cw-event-label'>{item.label}</span>
        {item.comment && <span className='cw-event-comment'>{item.comment}</span>}
      </>
    ),
    by: item.authorName != null ? <bdi>{item.authorName}</bdi> : undefined,
    details: item.orderId != null || item.code != null
      ? (
        <dl className='cw-event-details'>
          {item.orderId != null && (
            <>
              <dt>{t('INVOICE_ORDER_NO', 'Order number')}</dt>
              <dd className='odc-figure'>{item.orderId}</dd>
            </>
          )}
          {item.code != null && (
            <>
              <dt>{t('CODE', 'Code')}</dt>
              <dd className='odc-figure'>{item.code}</dd>
            </>
          )}
        </dl>
        )
      : undefined
  }))

  const historyLoading = Boolean(walletEventsState?.loading) && events.length === 0
  const historyFailed = !historyLoading && Boolean(walletEventsState?.error) && events.length === 0
  const describedBy = locked ? ids.locked : (reason ? ids.reason : undefined)

  return (
    <div className='cw-root'>
      {loading
        ? <BalanceSkeleton label={t('LOADING', 'Loading')} />
        : (
          <div className='cw-balance'>
            {!loadFailed && <span className='cw-balance-figure odc-figure'>{money(balance)}</span>}
            <span className='cw-balance-label'>{isCash ? t('CUSTOMERS_WALLET_BALANCE', 'Balance') : t('POINTS', 'Points')}</span>
          </div>
          )}

      {loadFailed && (
        <InlineNotice
          tone='danger'
          icon={CircleAlert}
          action={refreshWallet && <Button variant='ghost' size='sm' onClick={() => refreshWallet()}>{t('RETRY', 'Retry')}</Button>}
        >
          {t('CUSTOMERS_WALLET_LOAD_ERROR', "The wallet didn't load.")}
        </InlineNotice>
      )}

      {locked && (
        <InlineNotice id={ids.locked} tone='warning' icon={LockKeyhole}>
          {t('CUSTOMERS_WALLET_LOCKED', 'This wallet is locked')}
        </InlineNotice>
      )}

      {errors && (
        <InlineNotice tone='danger' icon={CircleAlert}>
          <span className='cw-notice-lines'>
            {errors.map(message => <span key={message}>{message}</span>)}
          </span>
        </InlineNotice>
      )}

      <form className='cw-form' aria-labelledby={ids.title} onSubmit={openConfirm} noValidate>
        <h3 id={ids.title} className='cw-title'>{t('CUSTOMERS_WALLET_ADJUST', 'Adjust balance')}</h3>
        <fieldset className='cw-fields' disabled={locked}>
          <SegmentedControl
            label={t('CUSTOMERS_WALLET_ADJUST_KIND', 'Adjustment type')}
            value={mode}
            onValueChange={changeMode}
            options={[
              { value: 'add', label: t('ADD', 'Add') },
              { value: 'remove', label: t('REMOVE', 'Remove') }
            ]}
          />
          <NumberField
            label={t('AMOUNT', 'Amount')}
            name='amount'
            ref={amountRef}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            min={0}
            step={isCash ? 0.01 : 1}
            format={{ maximumFractionDigits: decimals }}
            value={amount}
            onChange={changeAmount}
            disabled={locked}
          />
          <TextArea
            label={t('COMMENT', 'Comment')}
            name='description'
            rows={3}
            value={comment}
            onChange={changeComment}
            disabled={locked}
          />
          <div className='cw-actions'>
            <Button type='submit' variant='primary' disabled={!canSubmit} aria-describedby={canSubmit ? undefined : describedBy}>
              {submitLabel}
            </Button>
            {reason && !canSubmit && <p id={ids.reason} className='cw-reason'>{reason}</p>}
          </div>
        </fieldset>
        <p className='cw-updated' role='status'>{updated ? t('CUSTOMERS_WALLET_UPDATED', 'Balance updated') : ''}</p>
      </form>

      <section className='cw-history' aria-labelledby={ids.history}>
        <h3 id={ids.history} className='cw-title'>{t('TRANSACTION_HISTORY', 'Transaction history')}</h3>
        {historyLoading
          ? <HistorySkeleton label={t('LOADING', 'Loading')} />
          : historyFailed
            ? <EmptyState tone='error' icon={CircleAlert} title={t('CUSTOMERS_WALLET_HISTORY_ERROR', "The transaction history didn't load.")} />
            : (
              <ActivityTimeline
                label={t('TRANSACTION_HISTORY', 'Transaction history')}
                detailsLabel={t('CUSTOMERS_WALLET_EVENT_DETAILS', 'Transaction details')}
                items={items}
                empty={<EmptyState title={t('CUSTOMERS_WALLET_NO_EVENTS', 'No transactions yet')} />}
              />
              )}
      </section>

      <ConfirmDialog
        open={confirmOpen && valid}
        title={fill(titleText, { _amount_: figure(amountText), _name_: name })}
        confirmLabel={submitLabel}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='primary'
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
      >
        <p className='cw-confirm-text'>
          {fill(t('CUSTOMERS_WALLET_RESULT', 'The balance goes from _from_ to _to_.'), { _from_: figure(money(from)), _to_: figure(money(to)) })}
        </p>
        {to < 0 && <p className='cw-confirm-text'>{t('CUSTOMERS_WALLET_NEGATIVE', 'The balance will be negative.')}</p>}
      </ConfirmDialog>
    </div>
  )
}

/**
 * The Wallet section: Cash and/or Points, as `isCashWalletOn` / `isPointsWalletOn` allow (both on since ). With both
 * there is a segmented control, with one there is none, with none the section is empty. `wallet` (`'cash'|'points'`) is
 * the parent's choice, `onWalletChange(wallet)` asks it to change, and `onDirtyChange(boolean)` tells whether either wallet's
 * form holds an amount or a comment that has not been sent (each wallet keeps its draft while the other is shown). `intent` (`{ mode: 'add', wallet?, id }`) asks the form to open in Add with the
 * amount focused; the form calls `onIntentConsumed(intent)` once it has.
 */
export const CustomerWalletSection = ({ user, configs, wallet = 'cash', onWalletChange, onDirtyChange, intent, onIntentConsumed }) => {
  const [, t] = useLanguage()
  const cash = isCashWalletOn(configs)
  const points = isPointsWalletOn(configs)

  // one draft per wallet, for this customer only (another customer starts empty). Only the shown wallet has a
  // controller (the `key` below), so the other one waits here until it is shown again.
  const drafts = useRef({ userId: user?.id, cash: null, points: null })
  if (drafts.current.userId !== user?.id) drafts.current = { userId: user?.id, cash: null, points: null }
  const dirtyReported = useRef(false)
  const onDirtyRef = useRef(onDirtyChange)
  onDirtyRef.current = onDirtyChange
  const reportDirty = useCallback(() => {
    const dirty = hasDraft(drafts.current.cash) || hasDraft(drafts.current.points)
    if (dirty === dirtyReported.current) return
    dirtyReported.current = dirty
    onDirtyRef.current?.(dirty)
  }, [])
  const saveDraft = useCallback((kind, draft) => {
    drafts.current[kind] = hasDraft(draft) || draft.mode !== 'add' ? draft : null
    reportDirty()
  }, [reportDirty])
  useEffect(() => { reportDirty() }, [user?.id, reportDirty])
  useEffect(() => () => {
    if (dirtyReported.current) onDirtyRef.current?.(false)
  }, [])

  if (!cash && !points) return null
  const active = cash && points ? (wallet === 'points' ? 'points' : 'cash') : (cash ? 'cash' : 'points')

  return (
    <div className='cw-section'>
      {cash && points && (
        <SegmentedControl
          label={t('WALLET', 'Wallet')}
          value={active}
          onValueChange={onWalletChange}
          options={[
            { value: 'cash', label: t('CASH', 'Cash') },
            { value: 'points', label: t('POINTS', 'Points') }
          ]}
        />
      )}
      <UserWalletController
        key={`${active}-${user?.id ?? ''}`}
        userId={user?.id}
        walletType={WALLET_TYPES[active]}
        UIComponent={WalletBody}
        kind={active}
        user={user}
        configs={configs}
        initialDraft={drafts.current[active]}
        onDraftChange={saveDraft}
        intent={intent}
        onIntentConsumed={onIntentConsumed}
      />
    </div>
  )
}
