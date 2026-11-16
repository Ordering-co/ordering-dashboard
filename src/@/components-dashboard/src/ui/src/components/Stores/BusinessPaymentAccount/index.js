import React, { useEffect, useRef, useState } from 'react'

import { BusinessPaymentAccount as BusinessPaymentAccountController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  Button,
  ConfirmDialog,
  InlineNotice,
  RadioGroup,
  SaveBar,
  SearchField,
  SecretField,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  Switch,
  TextField,
  useLeaveGuard
} from '../../Shared/Product'
import { TriangleAlert } from '../../Shared/Icon'
import './business-payment-account.css'

// redesign stores 5.11 (B-4…B-7): the store's payout account in one view on Product pieces. Same requests, endpoints and
// payloads as main (createAccount, updateAccount, associateAccount(Number(id)), dissociateAccount) and the same role rule: level 0 is
// the admin, level 2 the business owner (read only), any other level gets the admin view without Edit (bugs C, its save
// is always refused). States, in this order: loading, a failed
// load (G4-27: an error with «Try again», never an offer to create or associate: that could duplicate the account), no account (the
// create form in sight; an admin with existing accounts can also associate one), the account (read view, every payout datum hidden:
// decision 7) and its in-place edit (draft, save bar and leave guard at section level). Errors show in line, never in a modal.

const text = (value) => (value == null ? '' : String(value))

// the label main gave an existing account in its select
const accountLabel = (account) => account.name || `${account.paymethod} #${account.id}`

// what the controller answers on a failed write (a list of messages, or a value), as one line of translated text
const errorTextOf = (t, result) => {
  const list = Array.isArray(result?.result) ? result.result : [result?.result]
  const messages = list.map(message => translateApiMessage(t, message, null)).filter(Boolean)
  return messages.length ? messages.join(' ') : t('ERROR', 'Error')
}

// the first invalid control, centred (the save bar is sticky and could cover it at the bottom edge)
const focusFirstInvalid = (root) => {
  requestAnimationFrame(() => {
    const control = root?.querySelector('[aria-invalid="true"]')
    control?.focus({ preventScroll: true })
    control?.scrollIntoView?.({ block: 'center' })
  })
}

const useMounted = () => {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return mounted
}

// the payment cycle, as main wrote it: «Weekly - Monday (09:00)»
const cycleLabelOf = (t, method) => {
  if (!method) return ''
  const cycle = method.cycle === 'weekly' ? t('WEEKLY', 'Weekly') : t('MONTHLY', 'Monthly')
  let dayLabel = ''
  if (method.cycle === 'weekly') {
    const days = [
      t('SUNDAY', 'Sunday'), t('MONDAY', 'Monday'), t('TUESDAY', 'Tuesday'),
      t('WEDNESDAY', 'Wednesday'), t('THURSDAY', 'Thursday'), t('FRIDAY', 'Friday'),
      t('SATURDAY', 'Saturday')
    ]
    dayLabel = days[method.cycle_day] || ''
  } else {
    dayLabel = `${t('DAY', 'Day')} ${method.cycle_day}`
  }
  const time = method.cycle_time || ''
  return `${cycle} - ${dayLabel}${time ? ` (${time})` : ''}`
}

// every payout datum is a SecretField: hidden, with Show and the last four characters («Ends in …k3Fz»)
// the «Ends in …» line of a SecretField (its labels are explicit props: the brand guard reads each one)
const secretEnding = (t) => function SecretEnding (ending) {
  const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
  return <>{before}{ending}{after}</>
}

const LoadFailed = ({ children, onRetry, t }) => (
  <InlineNotice
    tone='danger'
    icon={TriangleAlert}
    role='alert'
    action={<Button size='sm' onClick={() => onRetry?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
  >
    {children}
  </InlineNotice>
)

const LoadingRows = ({ t }) => (
  <div className='odc-bpa-loading' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
    {[0, 1, 2, 3].map(index => (
      <div key={index} className='odc-bpa-skeleton-row'>
        <Skeleton size='30%' />
        <Skeleton block='var(--od-x-control-height)' />
      </div>
    ))}
  </div>
)

// ── No account: create ──
const CreateForm = ({ methodsState, createAccount, getMethods, t }) => {
  const methods = methodsState?.methods || []
  const [gateway, setGateway] = useState('')
  const [name, setName] = useState('')
  const [data, setData] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef(null)
  const busyRef = useRef(false)
  const mounted = useMounted()

  const method = methods.find(m => m.gateway === gateway) || null
  const template = method?.data_template || []

  const pickMethod = (value) => {
    setGateway(value)
    // the data of one method means nothing to another
    setData({})
    setAttempted(false)
    setError(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busyRef.current) return
    setError(null)
    if (!gateway) {
      setError(t('PAYMETHOD_REQUIRED', 'Payment method is required'))
      requestAnimationFrame(() => formRef.current?.querySelector('[role="radio"]')?.focus({ preventScroll: true }))
      return
    }
    const missing = template.filter(field => field.required && !text(data[field.key]).trim())
    if (missing.length > 0) {
      setAttempted(true)
      focusFirstInvalid(formRef.current)
      return
    }
    busyRef.current = true
    setBusy(true)
    let result
    try {
      result = await createAccount({
        paymethod: gateway,
        name: name || undefined,
        data: Object.keys(data).length > 0 ? data : undefined
      })
    } catch (err) {
      result = { error: true, result: [err?.message] }
    }
    busyRef.current = false
    if (!mounted.current) return
    setBusy(false)
    if (result?.error) setError(errorTextOf(t, result))
  }

  return (
    <form ref={formRef} className='odc-bpa-form' noValidate onSubmit={submit}>
      {methodsState?.error
        ? (
          <LoadFailed onRetry={getMethods} t={t}>
            {t('PAYMENT_METHODS_LOAD_FAILED', "We couldn't load the payment methods.")}
          </LoadFailed>
          )
        : (
          <RadioGroup
            label={(
              <>
                {t('PAYMENT_METHOD', 'Payment method')}
                {' '}
                <span className='odc-field-required' aria-hidden='true' title={t('REQUIRED', 'Required')}>*</span>
                <span className='odc-sr-only'>{t('REQUIRED', 'Required')}</span>
              </>
            )}
            required
            value={gateway}
            onValueChange={pickMethod}
            options={methods.map(item => ({ value: item.gateway, label: item.name, description: cycleLabelOf(t, item) }))}
          />
          )}
      {method && (
        <>
          <TextField
            label={t('ACCOUNT_NAME', 'Account name')}
            placeholder={t('ACCOUNT_NAME_PLACEHOLDER', 'e.g., Main Business Account')}
            value={name}
            onChange={setName}
          />
          {template.map(field => {
            const required = !!field.required
            return (
              <SecretField
                key={`${gateway}:${field.key}`}
                label={field.name}
                required={required}
                requiredLabel={required ? t('REQUIRED', 'Required') : undefined}
                error={attempted && required && !text(data[field.key]).trim()
                  ? t('PAYMETHOD_FIELD_REQUIRED', '_field_ is required').replace('_field_', field.name)
                  : undefined}
                value={text(data[field.key])}
                onChange={(value) => setData(prev => ({ ...prev, [field.key]: value }))}
                showLabel={t('SHOW', 'Show')} hideLabel={t('HIDE', 'Hide')} endingLabel={secretEnding(t)}
              />
            )
          })}
        </>
      )}
      {error && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{error}</InlineNotice>}
      <div className='odc-bpa-actions'>
        <Button type='submit' variant='primary' busy={busy}>{t('CREATE_PAYMENT_ACCOUNT', 'Create Payment Account')}</Button>
      </div>
    </form>
  )
}

// ── No account: associate an existing one ──
const AssociateForm = ({ accounts, associateAccount, t }) => {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useMounted()

  const needle = query.trim().toLowerCase()
  const matches = accounts.filter(account => !needle || accountLabel(account).toLowerCase().includes(needle))

  const submit = async (event) => {
    event.preventDefault()
    if (busyRef.current || !selected) return
    setError(null)
    busyRef.current = true
    setBusy(true)
    let result
    try {
      result = await associateAccount(Number(selected))
    } catch (err) {
      result = { error: true, result: [err?.message] }
    }
    busyRef.current = false
    if (!mounted.current) return
    setBusy(false)
    if (result?.error) setError(errorTextOf(t, result))
  }

  return (
    <form className='odc-bpa-form' noValidate onSubmit={submit}>
      {/* Enter in the search only searches: it must not associate the account picked before */}
      <SearchField
        label={t('SEARCH', 'Search')}
        clearLabel={t('CLEAR', 'Clear')}
        value={query}
        onChange={setQuery}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      />
      {matches.length > 0
        ? (
          <RadioGroup
            label={t('SELECT_ACCOUNT', 'Select account')}
            value={selected}
            onValueChange={setSelected}
            options={matches.map(account => ({ value: String(account.id), label: accountLabel(account) }))}
          />
          )
        : <p className='odc-bpa-empty'>{t('NO_RESULTS', 'No results')}</p>}
      {error && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{error}</InlineNotice>}
      <div className='odc-bpa-actions'>
        <Button type='submit' variant='primary' disabled={!selected} busy={busy}>{t('ASSOCIATE_ACCOUNT', 'Associate Account')}</Button>
      </div>
    </form>
  )
}

const NoAccount = ({ isAdmin, methodsState, allAccountsState, createAccount, associateAccount, getMethods, t }) => {
  const [mode, setMode] = useState('create')
  const accounts = allAccountsState?.accounts || []
  // as main: only a level 0 chooses, and only when there is something to associate
  const canAssociate = isAdmin && accounts.length > 0
  const active = canAssociate ? mode : 'create'

  return (
    <>
      <p className='odc-bpa-lead'>{t('NO_PAYMENT_ACCOUNT', "This business doesn't have a payment account yet.")}</p>
      {canAssociate && (
        <div className='odc-bpa-choice'>
          <SegmentedControl
            label={t('BUSINESS_PAYMENT_ACCOUNT_TITLE', 'Business payment account')}
            value={active}
            onValueChange={setMode}
            options={[
              { value: 'create', label: t('CREATE_NEW_ACCOUNT', 'Create new account') },
              { value: 'associate', label: t('ASSOCIATE_EXISTING_ACCOUNT', 'Associate existing account') }
            ]}
          />
          <p className='odc-bpa-choice-desc'>
            {active === 'create'
              ? t('CREATE_NEW_ACCOUNT_DESC', 'Set up a new payment account with a payment method')
              : t('ASSOCIATE_EXISTING_ACCOUNT_DESC', 'Link an existing payment account to this business')}
          </p>
        </div>
      )}
      {active === 'create'
        ? <CreateForm methodsState={methodsState} createAccount={createAccount} getMethods={getMethods} t={t} />
        : <AssociateForm accounts={accounts} associateAccount={associateAccount} t={t} />}
    </>
  )
}

// one row of the account's <dl>
const Row = ({ label, children }) => (
  <div className='odc-bpa-row'>
    <dt className='odc-bpa-term'>{label}</dt>
    <dd className='odc-bpa-value'>{children}</dd>
  </div>
)

const BusinessPaymentAccountUI = (props) => {
  const {
    isAdmin,
    isBusinessOwner,
    accountState,
    methodsState,
    allAccountsState,
    createAccount,
    updateAccount,
    associateAccount,
    dissociateAccount,
    getAccount,
    getMethods,
    businessName
  } = props

  const [, t] = useLanguage()
  const rootRef = useRef(null)
  const mounted = useMounted()

  const account = accountState?.account || null
  // redesign stores 5.18 (F5 of 5.11): StoreSectionBody gives the store's name; blank or missing keeps «This store»
  const storeName = text(businessName).trim()
  const methods = methodsState?.methods || []
  const accountMethod = account ? methods.find(m => m.gateway === account.paymethod) || null : null
  const template = accountMethod?.data_template || []
  // as main: the owner reads; every other level gets the admin view
  const readOnly = !!isBusinessOwner && !isAdmin

  // ── Edit (admin view). The draft starts from the account when Edit is pressed; nothing is sent until Save ──
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const savingRef = useRef(false)

  // ── Dissociate ──
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dissociating, setDissociating] = useState(false)
  const [dissociateError, setDissociateError] = useState(null)

  // review 5.11 F6: the control that had the focus goes away after these actions; the focus goes to the first field of the edit
  // form, or to the section title (`tabIndex=-1`) once the view has settled, never to <body>
  const headingRef = useRef(null)
  const pendingFocus = useRef(null) // 'name' | 'heading'
  const isLoading = !!(accountState?.loading || methodsState?.loading)
  useEffect(() => {
    if (!pendingFocus.current || isLoading) return
    const target = pendingFocus.current === 'name'
      ? rootRef.current?.querySelector('.odc-bpa-form input')
      : headingRef.current
    pendingFocus.current = null
    target?.focus({ preventScroll: true })
  })
  // an account that appears (created, associated) or goes (dissociated) replaces the form that had the focus: once it has rendered,
  // the focus goes to the title (not on a plain load, which must not move the focus)
  const focusTitleSoon = () => requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  const createAndFocus = async (changes) => {
    const result = await createAccount(changes)
    if (result && !result.error) focusTitleSoon()
    return result
  }
  const associateAndFocus = async (accountId) => {
    const result = await associateAccount(accountId)
    if (result && !result.error) focusTitleSoon()
    return result
  }

  const startEdit = () => {
    pendingFocus.current = 'name'
    setDraft({ name: account.name || '', data: account.data ? { ...account.data } : {}, enabled: account.enabled !== false })
    setAttempted(false)
    setErrorText(null)
    setDissociateError(null)
    setEditing(true)
  }

  // leaving the section with changes discards them without moving the focus (the guard's discard)
  const dropEdit = () => {
    setEditing(false)
    setDraft(null)
    setAttempted(false)
    setErrorText(null)
  }
  const leaveEdit = () => {
    pendingFocus.current = 'heading'
    dropEdit()
  }
  const retryLoad = () => {
    pendingFocus.current = 'heading'
    getAccount()
  }

  const change = (patch) => {
    setDraft(prev => ({ ...prev, ...patch }))
    setErrorText(null)
  }
  const changeData = (key, value) => change({ data: { ...draft.data, [key]: value } })

  // the changed items, by the name the bar lists
  const changes = []
  if (editing && draft && account) {
    if (draft.name !== (account.name || '')) changes.push(t('ACCOUNT_NAME', 'Account name'))
    for (const field of template) {
      if (text(draft.data[field.key]) !== text(account.data?.[field.key])) changes.push(field.name)
    }
    if (draft.enabled !== (account.enabled !== false)) changes.push(t('ENABLED', 'Enabled'))
  }
  const count = changes.length

  const requiredMissing = (key) => !!draft && !text(draft.data[key]).trim()

  const save = async () => {
    if (savingRef.current || !account?.id || !draft) return { ok: false }
    if (template.some(field => field.required && requiredMissing(field.key))) {
      setAttempted(true)
      focusFirstInvalid(rootRef.current)
      return { ok: false }
    }
    savingRef.current = true
    setSaving(true)
    setErrorText(null)
    let result
    try {
      // all three, as main did
      result = await updateAccount(account.id, { name: draft.name, data: draft.data, enabled: draft.enabled })
    } catch (err) {
      result = { error: true, result: [err?.message] }
    }
    savingRef.current = false
    if (!mounted.current) return result?.error ? { ok: false } : { ok: true }
    setSaving(false)
    if (result?.error) {
      setErrorText(errorTextOf(t, result))
      return { ok: false }
    }
    leaveEdit()
    return { ok: true }
  }

  useLeaveGuard({ dirty: count > 0, count, save, discard: dropEdit })

  const dissociate = async () => {
    setDissociating(true)
    setDissociateError(null)
    let result
    try {
      result = await dissociateAccount()
    } catch (err) {
      result = { error: true, result: [err?.message] }
    }
    if (!mounted.current) return
    setDissociating(false)
    setConfirmOpen(false)
    if (result?.error) setDissociateError(errorTextOf(t, result))
    else focusTitleSoon()
  }

  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)

  // ── The account: read rows, or the edit fields ──
  const methodName = accountMethod?.name || account?.paymethod
  const dataEntries = template.length > 0
    ? template.map(field => [field.key, field.name])
    : Object.keys(account?.data || {}).map(key => [key, key])

  const renderAccount = () => (
    <>
      <dl className='odc-bpa-list'>
        <Row label={t('PAYMENT_METHOD', 'Payment method')}>{methodName}</Row>
        {accountMethod && <Row label={t('PAYMENT_CYCLE', 'Payment cycle')}>{cycleLabelOf(t, accountMethod)}</Row>}
        {!editing && account.name && <Row label={t('ACCOUNT_NAME', 'Account name')}>{account.name}</Row>}
        {!editing && (
          <Row label={t('STATUS', 'Status')}>
            <StatusBadge
              family={account.enabled !== false ? 'done' : 'cancel'}
              label={account.enabled !== false ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')}
            />
          </Row>
        )}
        {!editing && account.data && dataEntries.map(([key, label]) => {
          const value = text(account.data[key])
          return (
            <Row key={key} label={label}>
              {value
                ? <SecretField aria-label={label} readOnly value={value} showLabel={t('SHOW', 'Show')} hideLabel={t('HIDE', 'Hide')} endingLabel={secretEnding(t)} />
                : '-'}
            </Row>
          )
        })}
      </dl>
      {editing && draft && (
        <form
          className='odc-bpa-form'
          tabIndex={-1}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (count > 0) save()
          }}
        >
          <TextField
            label={t('ACCOUNT_NAME', 'Account name')}
            placeholder={t('ACCOUNT_NAME_PLACEHOLDER', 'e.g., Main Business Account')}
            value={draft.name}
            onChange={(value) => change({ name: value })}
          />
          {template.map(field => {
            const required = !!field.required
            return (
              <SecretField
                key={field.key}
                label={field.name}
                required={required}
                requiredLabel={required ? t('REQUIRED', 'Required') : undefined}
                error={attempted && required && requiredMissing(field.key)
                  ? t('PAYMETHOD_FIELD_REQUIRED', '_field_ is required').replace('_field_', field.name)
                  : undefined}
                value={text(draft.data[field.key])}
                onChange={(value) => changeData(field.key, value)}
                showLabel={t('SHOW', 'Show')} hideLabel={t('HIDE', 'Hide')} endingLabel={secretEnding(t)}
              />
            )
          })}
          <Switch checked={draft.enabled} onCheckedChange={(checked) => change({ enabled: checked })}>
            {t('ENABLED', 'Enabled')}
          </Switch>
        </form>
      )}
      {readOnly && (
        <InlineNotice tone='info'>
          {t('READ_ONLY_BUSINESS_OWNER', 'Your payment account details are read-only. Contact an administrator to make changes.')}
        </InlineNotice>
      )}
      {!readOnly && !editing && (
        <>
          {dissociateError && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{dissociateError}</InlineNotice>}
          <div className='odc-bpa-actions'>
            <Button onClick={() => setConfirmOpen(true)}>{t('DISSOCIATE', 'Dissociate')}</Button>
            {/* redesign bugs C: only level 0 can save the edit (the controller refuses every other level) */}
            {isAdmin && <Button variant='primary' onClick={startEdit}>{t('EDIT', 'Edit')}</Button>}
          </div>
        </>
      )}
    </>
  )

  // ── States, in order ──
  let body
  if (accountState?.loading || methodsState?.loading) {
    body = <LoadingRows t={t} />
  } else if (accountState?.error) {
    // G4-27: not "no account": nothing to create or associate until the account is known
    body = (
      <LoadFailed onRetry={retryLoad} t={t}>
        {t('PAYMENT_ACCOUNT_LOAD_FAILED', "We couldn't load the payment account.")}
      </LoadFailed>
    )
  } else if (!account) {
    body = (
      <NoAccount
        isAdmin={!!isAdmin}
        methodsState={methodsState}
        allAccountsState={allAccountsState}
        createAccount={createAndFocus}
        associateAccount={associateAndFocus}
        getMethods={getMethods}
        t={t}
      />
    )
  } else {
    body = renderAccount()
  }

  return (
    <div ref={rootRef} className='odc-root odc-bpa'>
      <div className='odc-bpa-head'>
        <h3 ref={headingRef} tabIndex={-1} className='odc-bpa-title'>{t('BUSINESS_PAYMENT_ACCOUNT_TITLE', 'Business payment account')}</h3>
        {editing && <Button variant='ghost' onClick={leaveEdit} disabled={saving}>{t('CANCEL', 'Cancel')}</Button>}
      </div>
      {body}
      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={countText}
        names={changes}
        moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
        saving={saving}
        errorText={errorText}
        onRetry={save}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE', 'Save')}
        onDiscard={leaveEdit}
        onSave={save}
      />
      {account && !readOnly && (
        <ConfirmDialog
          open={confirmOpen}
          title={t('DISSOCIATE_PAYMENT_ACCOUNT_TITLE', 'Dissociate _account_?').replace('_account_', account.name || methodName)}
          confirmLabel={t('DISSOCIATE_PAYMENT_ACCOUNT_CONFIRM', 'Dissociate account')} // redesign tanda AB (S-5): verb + object
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          tone='danger'
          busy={dissociating}
          onConfirm={dissociate}
          onCancel={() => setConfirmOpen(false)}
        >
          {storeName
            ? t('DISSOCIATE_PAYMENT_ACCOUNT_BODY_NAMED', '_store_ stops using this account for its payouts. The account is kept and can be associated again.').replace('_store_', storeName)
            : t('DISSOCIATE_PAYMENT_ACCOUNT_BODY', 'This store stops using this account for its payouts. The account is kept and can be associated again.')}
        </ConfirmDialog>
      )}
    </div>
  )
}

export const BusinessPaymentAccount = (props) => {
  const businessId = props?.businessId
  const businessPaymentAccountProps = {
    ...props,
    businessId,
    UIComponent: BusinessPaymentAccountUI
  }

  return <BusinessPaymentAccountController {...businessPaymentAccountProps} />
}
