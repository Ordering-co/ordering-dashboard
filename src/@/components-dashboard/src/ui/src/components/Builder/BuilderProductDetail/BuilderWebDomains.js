import React, { useEffect, useRef, useState } from 'react'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert, ExternalLink, TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, CopyButton, EmptyState, InlineNotice, Skeleton, StatusBadge, TextField } from '../../Shared/Product'
import {
  getDomainErrorMessage,
  getDomainUrl,
  getOwnDomainError,
  getRecordName,
  isRootDomain,
  normalizeDomain
} from '../utils'
import { CnameRecord } from './CnameRecord'
import './builder-detail.css'

export { CnameRecord }

// redesign B2: the Domains card on Product pieces (P/TextField, P/Button, P/InlineNotice, P/StatusBadge, P/Skeleton,
// P/EmptyState, P/ConfirmDialog) and --od-* tokens. Same steps, errors, suggestion, states, texts and requests as main; the
// polling and the socket stay in the controller (BuilderProductDomain).

/** Where every own domain points its CNAME record when the API hasn't said yet. */
const DEFAULT_CNAME_TARGET = 'cname.my-sites.app'

/**
 * Adds the own domain, or changes it (`current`). The API checks the CNAME
 * record when saving, so the steps come first and a missing record repeats
 * them for the domain sent.
 */
const OwnDomainForm = (props) => {
  const { current, target, saving, saveDomain, onSaved, onCancel } = props
  const [, t] = useLanguage()
  const [value, setValue] = useState('')
  const [sent, setSent] = useState('')
  const [errorCodes, setErrorCodes] = useState([])
  const [cnameTarget, setCnameTarget] = useState(null)
  const inputRef = useRef(null)

  const changing = !!current
  const error = errorCodes.length ? getDomainErrorMessage(errorCodes, sent, t) : null
  const unsupported = errorCodes.includes('domain.unsupported')
  const cnameMissing = errorCodes.includes('domain.cname_missing')
  const recordTarget = cnameTarget || target
  const root = cnameMissing && isRootDomain(sent)
  const suggestion = root ? `www.${sent}` : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const domain = normalizeDomain(value)
    setSent(domain)
    setCnameTarget(null)
    if (!domain) {
      setErrorCodes(['domain.required'])
      return
    }
    const answer = await saveDomain(value.trim())
    if (answer.ok) {
      onSaved(answer.own)
      return
    }
    setErrorCodes(answer.errorCodes.length ? answer.errorCodes : ['save.failed'])
    setCnameTarget(answer.cnameTarget)
  }

  const useSuggestion = () => {
    setValue(suggestion)
    setErrorCodes([])
    inputRef.current?.focus()
  }

  return (
    <form className='odc-bd-own' data-tone={changing ? 'editing' : 'empty'} noValidate aria-labelledby='builder-own-domain-title' onSubmit={handleSubmit}>
      <div className='odc-bd-stack'>
        <h3 id='builder-own-domain-title'>
          {changing ? t('BUILDER_DOMAIN_CHANGE_TITLE', 'Change your domain') : t('BUILDER_DOMAIN_USE_OWN', 'Use your own domain')}
        </h3>
        {changing
          ? <span className='odc-bd-small'>{t('BUILDER_DOMAIN_NOW', 'Now: _domain_').replace('_domain_', current.name)}</span>
          : <span className='odc-bd-muted'>{t('BUILDER_DOMAIN_USE_OWN_HELP', 'Show your website at an address like www.yourbrand.com. It has to be a subdomain (www., shop., order.…): a root domain like yourbrand.com can’t be used.')}</span>}
      </div>

      {unsupported && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert'>{error.message}</InlineNotice>
      )}

      {!unsupported && changing && (
        <InlineNotice tone='warning' icon={TriangleAlert} live={false}>
          {t('BUILDER_DOMAIN_CHANGE_WARNING', 'When you save, _domain_ stops opening your website. Create the CNAME record for the new domain first: we check it when you save.').replace('_domain_', current.name)}
        </InlineNotice>
      )}

      {!unsupported && changing && (
        <CnameRecord target={target} nameHint={t('BUILDER_DOMAIN_NEW_SUBDOMAIN', 'your new subdomain, like order')} />
      )}

      {!unsupported && !changing && (
        <ol className='odc-bd-steps'>
          <li>
            <span className='odc-bd-step-number' aria-hidden='true'>1</span>
            <div className='odc-bd-step-text'>
              <span>
                <strong>{t('BUILDER_DOMAIN_STEP_CNAME', 'Create a CNAME record')}</strong>{' '}
                <span className='odc-bd-muted'>{t('BUILDER_DOMAIN_STEP_CNAME_HELP', 'in the DNS settings of the provider where you bought your domain:')}</span>
              </span>
              <CnameRecord name='www' nameHint={t('BUILDER_DOMAIN_OR_SUBDOMAIN', 'or the subdomain you want')} target={target} />
            </div>
          </li>
          <li>
            <span className='odc-bd-step-number' aria-hidden='true'>2</span>
            <div className='odc-bd-step-text'>
              <span>
                <strong>{t('BUILDER_DOMAIN_STEP_WAIT', 'Wait until your provider saves it.')}</strong>{' '}
                <span className='odc-bd-muted'>{t('BUILDER_DOMAIN_STEP_WAIT_HELP', 'It usually takes a few minutes.')}</span>
              </span>
            </div>
          </li>
          <li>
            <span className='odc-bd-step-number' aria-hidden='true'>3</span>
            <div className='odc-bd-step-text'>
              <span>
                <strong>{t('BUILDER_DOMAIN_STEP_SAVE', 'Enter your domain here and save.')}</strong>{' '}
                <span className='odc-bd-muted'>{t('BUILDER_DOMAIN_STEP_SAVE_HELP', 'We check the record when you save, so create it first.')}</span>
              </span>
            </div>
          </li>
        </ol>
      )}

      {!unsupported && (
        // The field's help, or its error (a role=alert), is its description; the save of a new domain sits under it
        <div className='odc-bd-stack'>
          <TextField
            ref={inputRef}
            id='builder-own-domain'
            label={changing ? t('BUILDER_DOMAIN_NEW', 'New domain') : t('BUILDER_DOMAIN_YOURS', 'Your domain')}
            value={value}
            autoComplete='off'
            autoCapitalize='none'
            spellCheck={false}
            placeholder={changing ? 'order.yourbrand.com' : 'www.yourbrand.com'}
            error={error?.inField ? error.message : undefined}
            hint={error?.inField ? undefined : t('BUILDER_DOMAIN_FIELD_HELP', 'The full subdomain, like shop.yourbrand.com. You can paste the whole address.')}
            onChange={(next) => setValue(next)}
          />
          {!changing && (
            <Button type='submit' variant='primary' disabled={saving}>
              {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_DOMAIN_SAVE', 'Save domain')}
            </Button>
          )}
        </div>
      )}

      {cnameMissing && (
        <div className='odc-bd-cname-help'>
          <h4>
            {root
              ? t('BUILDER_DOMAIN_USE_SUBDOMAIN', 'Use a subdomain, like _domain_, and create its record').replace('_domain_', suggestion)
              : t('BUILDER_DOMAIN_CREATE_RECORD', 'Create this record in your domain’s DNS, then save again')}
          </h4>
          <CnameRecord name={root ? 'www' : getRecordName(sent)} target={recordTarget} />
          {root
            ? (
              <div className='odc-bd-row'>
                <p>{t('BUILDER_DOMAIN_ONCE_SAVED', 'Once the record is saved in your provider:')}</p>
                <Button variant='link' size='sm' onClick={useSuggestion}>
                  {t('BUILDER_DOMAIN_USE_SUGGESTION', 'Use _domain_').replace('_domain_', suggestion)}
                </Button>
              </div>
              )
            : (
              <p>
                {t('BUILDER_DOMAIN_FULL_NAME', 'Some providers ask for the full name, _domain_. If you just created it, wait a few minutes and save again.').replace('_domain_', sent)}
              </p>
              )}
        </div>
      )}

      {!unsupported && error && !error.inField && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert'>{error.message}</InlineNotice>
      )}

      {changing && (
        <div className='odc-bd-row' data-end=''>
          <Button disabled={saving} onClick={onCancel}>{t('CANCEL', 'Cancel')}</Button>
          {!unsupported && (
            <Button type='submit' variant='primary' disabled={saving}>
              {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_DOMAIN_SAVE_NEW', 'Save new domain')}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}

/** The status family (P/StatusBadge) and words of each `own.status`. */
const STATUSES = {
  pending: {
    family: 'progress',
    label: (t) => t('BUILDER_DOMAIN_PENDING', 'Setting up')
  },
  active: {
    family: 'done',
    label: (t) => t('BUILDER_DOMAIN_ACTIVE', 'Active')
  },
  error: {
    family: 'cancel',
    label: (t) => t('BUILDER_DOMAIN_NOT_WORKING', 'Not working')
  }
}

/** The own domain once saved: `pending`, `active` or `error`. */
const OwnDomainStatus = (props) => {
  const { own, target, domainAction, verifyDomain, onChange, onRemove } = props
  const [, t] = useLanguage()
  const [verifyCodes, setVerifyCodes] = useState([])

  const status = STATUSES[own.status] ? own.status : 'pending'
  const copy = STATUSES[status]
  const recordName = getRecordName(own.name)
  const busy = !!domainAction
  const failure = status === 'error' ? getOwnDomainError(own.error_code, own.name, t) : null

  useEffect(() => { setVerifyCodes([]) }, [own.name, own.status])

  const verify = async () => {
    setVerifyCodes([])
    const answer = await verifyDomain()
    if (!answer.ok && !answer.errorCodes.includes('domain.not_set')) {
      setVerifyCodes(answer.errorCodes.length ? answer.errorCodes : ['verify.failed'])
    }
  }

  return (
    <div className='odc-bd-own' data-tone={status === 'error' ? 'error' : undefined} role='group' aria-labelledby='builder-own-domain-label'>
      <div className='odc-bd-own-head'>
        <div className='odc-bd-stack'>
          <span className='odc-bd-small' id='builder-own-domain-label'>{t('BUILDER_DOMAIN_YOURS', 'Your domain')}</span>
          <div className='odc-bd-own-name'>
            {status === 'active'
              ? (
                <a className='odc-bd-link' href={getDomainUrl(own.name)} target='_blank' rel='noopener noreferrer'>
                  {own.name}
                  <ExternalLink className='odc-icon' aria-hidden='true' />
                  <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
                </a>
                )
              : <span>{own.name}</span>}
            <StatusBadge family={copy.family} label={copy.label(t)} role={status === 'pending' ? 'status' : undefined} />
          </div>
        </div>
        <div className='odc-bd-row'>
          <Button disabled={busy} onClick={onChange}>
            {t('BUILDER_DOMAIN_CHANGE', 'Change')}
          </Button>
          <Button disabled={busy} onClick={onRemove}>
            {domainAction === 'remove' ? t('BUILDER_DOMAIN_REMOVING', 'Removing…') : t('BUILDER_DOMAIN_REMOVE', 'Remove')}
          </Button>
        </div>
      </div>

      {status === 'pending' && (
        <>
          <p>
            {t('BUILDER_DOMAIN_PENDING_HELP', 'We’re checking the CNAME record and getting the security certificate (HTTPS). This takes a few minutes, up to about 20. This page updates by itself, so you can leave it and come back.')}
          </p>
          <span className='odc-bd-small'>
            {t('BUILDER_DOMAIN_KEEP_RECORD', 'Meanwhile your website keeps opening at its temporary address. Keep the CNAME record _name_ → _target_ in your DNS.')
              .replace('_name_', recordName || own.name)
              .replace('_target_', target)}
          </span>
        </>
      )}

      {status === 'active' && (
        <>
          <p>{t('BUILDER_DOMAIN_ACTIVE_HELP', 'Your website opens at this domain, with HTTPS.')}</p>
          <span className='odc-bd-small'>{t('BUILDER_DOMAIN_ACTIVE_KEEP', 'Keep the CNAME record in your DNS. If you remove it, this domain stops working.')}</span>
        </>
      )}

      {failure && (
        <>
          <div className='odc-bd-stack'>
            <h3>{failure.title}</h3>
            <p>{failure.text.replace('_target_', target)}</p>
          </div>
          <CnameRecord name={recordName || own.name} target={target} />
          <div className='odc-bd-stack'>
            <Button variant='primary' disabled={busy} onClick={verify}>
              {domainAction === 'verify' ? t('BUILDER_DOMAIN_VERIFYING', 'Verifying…') : t('BUILDER_DOMAIN_VERIFY', 'Verify again')}
            </Button>
            {verifyCodes.length > 0 && (
              <InlineNotice tone='danger' icon={CircleAlert} role='alert'>
                {verifyCodes.includes('domain.cname_missing')
                  ? t('BUILDER_DOMAIN_STILL_MISSING', 'The CNAME record for _domain_ still isn’t there. Check it in your provider and try again in a few minutes.').replace('_domain_', own.name)
                  : t('BUILDER_DOMAIN_VERIFY_ERROR', 'We couldn’t verify the domain. Try again.')}
              </InlineNotice>
            )}
          </div>
          <span className='odc-bd-small'>{t('BUILDER_DOMAIN_STILL_TEMPORARY', 'Your website keeps opening at its temporary address.')}</span>
        </>
      )}
    </div>
  )
}

/**
 * The Domains card of a website: its own domain, to add, follow,
 * change or remove, and its temporary one, which always works.
 */
export const BuilderWebDomains = (props) => {
  const { domainState, domainAction, reloadDomain, saveDomain, removeDomain, verifyDomain, temporary } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [editing, setEditing] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const { loading, domain, error } = domainState
  const own = domain?.own ?? null
  const target = domain?.cname_target || DEFAULT_CNAME_TARGET

  useEffect(() => {
    if (!own) setEditing(false)
  }, [own?.name])

  const handleSaved = (saved) => {
    setEditing(false)
    if (!saved) return
    showToast(ToastType.Success, (saved.status === 'active'
      ? t('BUILDER_DOMAIN_SAVED_ACTIVE', 'Saved. Your website opens at _domain_.')
      : t('BUILDER_DOMAIN_SAVED', 'Saved. We’re setting up _domain_; it takes a few minutes.')).replace('_domain_', saved.name))
  }

  const handleRemove = async () => {
    setRemoveOpen(false)
    const answer = await removeDomain()
    if (!answer.ok) {
      showToast(ToastType.Error, t('BUILDER_DOMAIN_REMOVE_ERROR', 'We couldn’t remove the domain. Try again.'))
      return
    }
    showToast(ToastType.Success, t('BUILDER_DOMAIN_REMOVED', 'Removed. Your website stays at _domain_.').replace('_domain_', temporary || ''))
  }

  const renderOwn = () => {
    if (error) {
      return (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          titleAs='h3'
          title={t('BUILDER_DOMAIN_LOAD_ERROR', 'We couldn’t load your domain')}
          description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
          action={<Button variant='primary' onClick={() => reloadDomain()}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        />
      )
    }
    if (loading && !domain) {
      return <div aria-busy='true'><Skeleton shape='box' block='var(--od-space-10)' /></div>
    }
    if (!own || editing) {
      return (
        <OwnDomainForm
          key={own ? `change-${own.name}` : 'add'}
          current={editing ? own : null}
          target={target}
          saving={domainAction === 'save'}
          saveDomain={saveDomain}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      )
    }
    return (
      <OwnDomainStatus
        own={own}
        target={target}
        domainAction={domainAction}
        verifyDomain={verifyDomain}
        onChange={() => setEditing(true)}
        onRemove={() => setRemoveOpen(true)}
      />
    )
  }

  return (
    <section className='odc-root odc-bd-card' aria-labelledby='builder-web-domains'>
      <header className='odc-bd-card-head'>
        {/* Focusable for "Go to Domains" next to the status actions */}
        <h2 id='builder-web-domains' tabIndex={-1}>{t('BUILDER_DOMAINS', 'Domains')}</h2>
        <p>{t('BUILDER_DOMAINS_HELP', 'The addresses where people open your website.')}</p>
      </header>
      <div className='odc-bd-card-body'>
        {renderOwn()}

        {temporary && (
          <div className='odc-bd-temporary'>
            <div>
              <span className='odc-bd-small'>{t('BUILDER_DOMAIN_TEMPORARY', 'Temporary address')}</span>
              <a href={getDomainUrl(temporary)} target='_blank' rel='noopener noreferrer'>
                {temporary}
                <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
              </a>
              <span className='odc-bd-small'>{t('BUILDER_DOMAIN_TEMPORARY_HELP', 'Always works, also after you add your own domain.')}</span>
            </div>
            <CopyButton
              text={temporary}
              size='sm'
              label={t('BUILDER_COPY_VALUE', 'Copy _value_').replace('_value_', temporary)}
              copyLabel={t('BUILDER_COPY', 'Copy')}
              copiedLabel={t('BUILDER_COPIED', 'Copied')}
              failedLabel={t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removeOpen}
        title={t('BUILDER_DOMAIN_REMOVE_TITLE', 'Remove _domain_?').replace('_domain_', own?.name || '')}
        confirmLabel={t('BUILDER_DOMAIN_REMOVE_ACCEPT', 'Remove domain')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleRemove}
        onCancel={() => setRemoveOpen(false)}
      >
        <p>{t('BUILDER_DOMAIN_REMOVE_HELP', 'Your website stops opening at _domain_ right away.').replace('_domain_', own?.name || '')}</p>
        {temporary && (
          <p>{t('BUILDER_DOMAIN_REMOVE_TEMPORARY', 'It stays online at _temporary_. You can add a domain again later.').replace('_temporary_', temporary)}</p>
        )}
      </ConfirmDialog>
    </section>
  )
}
