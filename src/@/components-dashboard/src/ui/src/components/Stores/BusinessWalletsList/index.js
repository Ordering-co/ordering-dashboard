import React, { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useConfig, BusinessWalletsList as BusinessWalletsListController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TriangleAlert } from '../../Shared/Icon'
import { AsyncSwitch, InlineNotice, RadioGroup, SecretField, Skeleton } from '../../Shared/Product'
import { commitOnBlur, commitOnKeyDown } from '../BusinessPaymentMethods/configField'
import './business-wallets.css'

/*
 * redesign stores 5.11, decision B-3 · The store's wallets, at the bottom of the Payment methods list, edited IN LINE in each row
 * (main opened a legacy side panel per wallet).
 * - A `type 2` config whose options are exactly two booleans ('1'/'0' or 'true'/'false') is an `AsyncSwitch` named by the row. It saves the
 *   option's own value, as main did, and puts itself back with a notice when the save fails.
 * - Any other `type 2` is a `RadioGroup` of its options (translated as main did). It saves on change; on a failure it shows the stored value
 *   again and a danger notice.
 * - A `type 7` is a `SecretField` that saves when it is left or with Enter (`commitOnBlur` / `commitOnKeyDown`, lot 1.B), with the error in line.
 * - `?wallet=<id>` is kept: once loaded, the control of that wallet is scrolled into view and focused.
 * `handleUpdateWallet(walletId, params)` answers `{ ok: true }` or `{ ok: false, error }`.
 */

const TRUE_VALUES = ['1', 'true']
const FALSE_VALUES = ['0', 'false']

// The two options of a boolean config as { on, off }, or null when the config is anything else.
const booleanPair = (options) => {
  if (!Array.isArray(options) || options.length !== 2) return null
  const values = options.map(option => String(option?.value))
  const on = options.find((_, index) => TRUE_VALUES.includes(values[index]))
  const off = options.find((_, index) => FALSE_VALUES.includes(values[index]))
  const isPair = on && off && TRUE_VALUES.indexOf(String(on.value)) === FALSE_VALUES.indexOf(String(off.value))
  return isPair ? { on, off } : null
}

// The first text of an API error: a string, `{ message }`, or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const WalletSwitch = ({ config, label, pair, controlRef, onSave, failureText }) => (
  <AsyncSwitch
    ref={controlRef}
    className='odc-wl-switch'
    checked={String(config.value) === String(pair.on.value)}
    failureText={failureText}
    onToggle={(next) => onSave(config.id, { value: next ? pair.on.value : pair.off.value })}
  >
    {label}
  </AsyncSwitch>
)

const WalletRadios = ({ config, label, controlRef, onSave, failureText }) => {
  const [, t] = useLanguage()
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const options = (config.options || []).map(item => ({ value: String(item.value), label: t(item.text.toUpperCase()) }))

  const handleChange = async (next) => {
    if (pending !== null || next === String(config.value)) return
    setError(null)
    setPending(next)
    const result = await onSave(config.id, { value: next })
    setPending(null)
    if (result?.ok === false) setError(translateApiMessage(t, firstMessage(result.error), failureText))
  }

  return (
    <div className='odc-wl-choice'>
      <RadioGroup
        ref={controlRef}
        label={label}
        options={options}
        value={pending ?? String(config.value ?? '')}
        onValueChange={handleChange}
      />
      {error && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{error}</InlineNotice>}
    </div>
  )
}

const WalletSecret = ({ config, label, controlRef, onSave, failureText }) => {
  const [, t] = useLanguage()
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const setRefs = (node) => {
    inputRef.current = node
    controlRef(node)
  }
  const secretEnding = (ending) => {
    const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return <>{before}{ending}{after}</>
  }
  const save = async (value) => {
    setError(null)
    const result = await onSave(config.id, { value })
    if (result?.ok !== false) return
    setError(translateApiMessage(t, firstMessage(result.error), failureText))
    // the field remembers the last value it sent so it is not sent twice; a failed one has to be able to go again
    if (inputRef.current) delete inputRef.current.dataset.committed
  }

  return (
    <SecretField
      ref={setRefs}
      label={label}
      defaultValue={config.value ?? ''}
      error={error || undefined}
      showLabel={t('SHOW', 'Show')}
      hideLabel={t('HIDE', 'Hide')}
      endingLabel={secretEnding}
      onChange={() => setError(null)}
      onBlur={commitOnBlur(config.value, save)}
      onKeyDown={commitOnKeyDown(config.value, save)}
    />
  )
}

// The element to focus for a wallet: the switch or the secret input itself; for a radio group, its checked radio (or the first one).
const focusTargetOf = (node) => {
  if (!node) return null
  if (node.getAttribute?.('role') !== 'radiogroup') return node
  return node.querySelector('[role="radio"][aria-checked="true"]') || node.querySelector('[role="radio"]')
}

const BusinessWalletsListUI = (props) => {
  const {
    loyaltyPlanState,
    walletsListState,
    handleUpdateWallet
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const titleId = useId()
  const controls = useRef({})
  const isLoading = loyaltyPlanState.loading || walletsListState.loading
  const isWalletCashEnabled = configs?.wallet_cash_enabled?.value === '1'
  const isWalletPointsEnabled = configs?.wallet_credit_point_enabled?.value === '1'

  const walletsEnabled = {
    wallet_cash_enabled: isWalletCashEnabled,
    wallet_credit_point_enabled: isWalletPointsEnabled && loyaltyPlanState.created
  }

  const walletsLangs = {
    wallet_cash_enabled: t('WALLET_CASH_ENABLED', 'Wallet cash enabled'),
    wallet_credit_point_enabled: t('WALLET_CREDIT_POINT_ENABLED', 'Wallet credit point enabled')
  }

  const failureText = t('STORES_CHANGE_FAILED', "We couldn't save the change.")
  const visibleWallets = (walletsListState.wallets || []).filter(config => walletsEnabled[config.key])

  // `?wallet=<id>` opened that wallet in main; now its control is scrolled into view and focused, once, when the list is ready.
  const focusedFromUrl = useRef(false)
  useEffect(() => {
    if (isLoading || focusedFromUrl.current) return
    const walletId = query.get('wallet')
    if (!walletId) return
    const target = focusTargetOf(controls.current[walletId])
    if (!target) return
    focusedFromUrl.current = true
    target.scrollIntoView?.({ block: 'center' })
    target.focus({ preventScroll: true })
  }, [isLoading, visibleWallets.length])

  if (isLoading) {
    return (
      <div className='odc-wl'>
        <div className='odc-wl-rows' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
          <div className='odc-wl-skeleton-row'>
            <Skeleton shape='round' size='var(--od-x-control-height)' block='var(--od-space-4)' />
            <Skeleton size='40%' />
          </div>
        </div>
      </div>
    )
  }

  if (visibleWallets.length === 0) return null

  return (
    <div className='odc-wl'>
      <h4 id={titleId} className='odc-wl-title'>{t('WALLETS', 'Wallets')}</h4>
      <ul className='odc-wl-rows' aria-labelledby={titleId}>
        {visibleWallets.map(config => {
          const label = walletsLangs[config.key]
          const pair = config.type === 2 ? booleanPair(config.options) : null
          const controlRef = (node) => { controls.current[config.id] = node }
          return (
            <li key={config.id} className='odc-wl-row' data-wallet-id={config.id}>
              {pair && <WalletSwitch config={config} label={label} failureText={failureText} onSave={handleUpdateWallet} controlRef={controlRef} pair={pair} />}
              {config.type === 2 && !pair && <WalletRadios config={config} label={label} failureText={failureText} onSave={handleUpdateWallet} controlRef={controlRef} />}
              {config.type === 7 && <WalletSecret config={config} label={label} failureText={failureText} onSave={handleUpdateWallet} controlRef={controlRef} />}
              {config.type !== 2 && config.type !== 7 && <span className='odc-wl-label'>{label}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export const BusinessWalletsList = (props) => {
  const businessWalletsListProps = {
    ...props,
    UIComponent: BusinessWalletsListUI
  }
  return <BusinessWalletsListController {...businessWalletsListProps} />
}
