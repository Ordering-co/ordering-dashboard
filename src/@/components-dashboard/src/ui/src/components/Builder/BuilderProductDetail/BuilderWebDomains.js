import React, { useEffect, useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ArrowClockwise, BoxArrowUpRight, Check2, Clipboard, ExclamationCircle, ExclamationTriangle } from 'react-bootstrap-icons'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Confirm } from '../../Shared'
import { BuilderMessage } from '../BuilderShared'
import {
  getDomainErrorMessage,
  getDomainUrl,
  getOwnDomainError,
  getRecordName,
  isRootDomain,
  normalizeDomain
} from '../utils'
import {
  CnameHelp,
  CopyButton,
  DomainField,
  DomainSteps,
  DomainsCard,
  ErrorBanner,
  FieldError,
  LinkButton,
  MutedText,
  Notice,
  OwnDomainBox,
  OwnDomainHead,
  OwnDomainName,
  Pill,
  RecordTable,
  TemporaryDomain
} from '../styles'

/** Where every own domain points its CNAME record when the API hasn't said yet. */
const DEFAULT_CNAME_TARGET = 'cname.my-sites.app'

/** Copies `value`, and says so for a moment. */
const CopyValue = ({ value }) => {
  const [, t] = useLanguage()
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setCopied(false)
    }
  }

  return (
    <CopyButton type='button' aria-label={t('BUILDER_COPY_VALUE', 'Copy _value_').replace('_value_', value)} onClick={copy}>
      {copied ? <Check2 aria-hidden='true' /> : <Clipboard aria-hidden='true' />}
      <span aria-live='polite'>{copied ? t('BUILDER_COPIED', 'Copied') : t('BUILDER_COPY', 'Copy')}</span>
    </CopyButton>
  )
}

/** The CNAME record to create: `name` is its Name, or `nameHint` explains it. */
const CnameRecord = ({ name, nameHint, target }) => {
  const [, t] = useLanguage()
  return (
    <RecordTable>
      <table>
        <thead>
          <tr>
            <th scope='col'>{t('BUILDER_DNS_TYPE', 'Type')}</th>
            <th scope='col'>{t('BUILDER_DNS_NAME', 'Name')}</th>
            <th scope='col'>{t('BUILDER_DNS_VALUE', 'Value')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>CNAME</code></td>
            <td>
              <div>
                {name && <code>{name}</code>}
                {nameHint && <MutedText small>{nameHint}</MutedText>}
              </div>
            </td>
            <td>
              <div>
                <code>{target}</code>
                <CopyValue value={target} />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </RecordTable>
  )
}

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
    <OwnDomainBox as='form' tone={changing ? 'editing' : 'empty'} noValidate aria-labelledby='builder-own-domain-title' onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 id='builder-own-domain-title'>
          {changing ? t('BUILDER_DOMAIN_CHANGE_TITLE', 'Change your domain') : t('BUILDER_DOMAIN_USE_OWN', 'Use your own domain')}
        </h3>
        {changing
          ? <MutedText small>{t('BUILDER_DOMAIN_NOW', 'Now: _domain_').replace('_domain_', current.name)}</MutedText>
          : <MutedText>{t('BUILDER_DOMAIN_USE_OWN_HELP', 'Show your website at an address like www.yourbrand.com. It has to be a subdomain (www., shop., order.…): a root domain like yourbrand.com can’t be used.')}</MutedText>}
      </div>

      {unsupported && (
        <ErrorBanner role='alert'>
          <ExclamationCircle aria-hidden='true' />
          <span>{error.message}</span>
        </ErrorBanner>
      )}

      {!unsupported && changing && (
        <Notice>
          <ExclamationTriangle aria-hidden='true' />
          <span>
            {t('BUILDER_DOMAIN_CHANGE_WARNING', 'When you save, _domain_ stops opening your website. Create the CNAME record for the new domain first: we check it when you save.').replace('_domain_', current.name)}
          </span>
        </Notice>
      )}

      {!unsupported && changing && (
        <CnameRecord target={target} nameHint={t('BUILDER_DOMAIN_NEW_SUBDOMAIN', 'your new subdomain, like order')} />
      )}

      {!unsupported && !changing && (
        <DomainSteps>
          <li>
            <span aria-hidden='true'>1</span>
            <div>
              <span>
                <strong>{t('BUILDER_DOMAIN_STEP_CNAME', 'Create a CNAME record')}</strong>{' '}
                <MutedText>{t('BUILDER_DOMAIN_STEP_CNAME_HELP', 'in the DNS settings of the provider where you bought your domain:')}</MutedText>
              </span>
              <CnameRecord name='www' nameHint={t('BUILDER_DOMAIN_OR_SUBDOMAIN', 'or the subdomain you want')} target={target} />
            </div>
          </li>
          <li>
            <span aria-hidden='true'>2</span>
            <div>
              <span>
                <strong>{t('BUILDER_DOMAIN_STEP_WAIT', 'Wait until your provider saves it.')}</strong>{' '}
                <MutedText>{t('BUILDER_DOMAIN_STEP_WAIT_HELP', 'It usually takes a few minutes.')}</MutedText>
              </span>
            </div>
          </li>
          <li>
            <span aria-hidden='true'>3</span>
            <div>
              <span>
                <strong>{t('BUILDER_DOMAIN_STEP_SAVE', 'Enter your domain here and save.')}</strong>{' '}
                <MutedText>{t('BUILDER_DOMAIN_STEP_SAVE_HELP', 'We check the record when you save, so create it first.')}</MutedText>
              </span>
            </div>
          </li>
        </DomainSteps>
      )}

      {!unsupported && (
        <DomainField invalid={!!error?.inField}>
          <label htmlFor='builder-own-domain'>
            {changing ? t('BUILDER_DOMAIN_NEW', 'New domain') : t('BUILDER_DOMAIN_YOURS', 'Your domain')}
          </label>
          <div>
            <Input
              ref={inputRef}
              id='builder-own-domain'
              type='text'
              value={value}
              autoComplete='off'
              autoCapitalize='none'
              spellCheck={false}
              placeholder={changing ? 'order.yourbrand.com' : 'www.yourbrand.com'}
              aria-invalid={error?.inField ? 'true' : 'false'}
              aria-describedby='builder-own-domain-help'
              onChange={(e) => setValue(e.target.value)}
            />
            {!changing && (
              <Button type='submit' color='primary' borderRadius='8px' disabled={saving}>
                {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_DOMAIN_SAVE', 'Save domain')}
              </Button>
            )}
          </div>
          <div id='builder-own-domain-help'>
            {error?.inField
              ? (
                <FieldError role='alert'>
                  <ExclamationCircle aria-hidden='true' />
                  <span>{error.message}</span>
                </FieldError>
                )
              : <MutedText small>{t('BUILDER_DOMAIN_FIELD_HELP', 'The full subdomain, like shop.yourbrand.com. You can paste the whole address.')}</MutedText>}
          </div>
        </DomainField>
      )}

      {cnameMissing && (
        <CnameHelp>
          <h4>
            {root
              ? t('BUILDER_DOMAIN_USE_SUBDOMAIN', 'Use a subdomain, like _domain_, and create its record').replace('_domain_', suggestion)
              : t('BUILDER_DOMAIN_CREATE_RECORD', 'Create this record in your domain’s DNS, then save again')}
          </h4>
          <CnameRecord name={root ? 'www' : getRecordName(sent)} target={recordTarget} />
          {root
            ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <p>{t('BUILDER_DOMAIN_ONCE_SAVED', 'Once the record is saved in your provider:')}</p>
                <LinkButton type='button' style={{ fontSize: 13 }} onClick={useSuggestion}>
                  {t('BUILDER_DOMAIN_USE_SUGGESTION', 'Use _domain_').replace('_domain_', suggestion)}
                </LinkButton>
              </div>
              )
            : (
              <p>
                {t('BUILDER_DOMAIN_FULL_NAME', 'Some providers ask for the full name, _domain_. If you just created it, wait a few minutes and save again.').replace('_domain_', sent)}
              </p>
              )}
        </CnameHelp>
      )}

      {!unsupported && error && !error.inField && (
        <ErrorBanner role='alert'>
          <ExclamationCircle aria-hidden='true' />
          <span>{error.message}</span>
        </ErrorBanner>
      )}

      {changing && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button type='button' color='secundary' borderRadius='8px' disabled={saving} onClick={onCancel}>{t('CANCEL', 'Cancel')}</Button>
          {!unsupported && (
            <Button type='submit' color='primary' borderRadius='8px' disabled={saving}>
              {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_DOMAIN_SAVE_NEW', 'Save new domain')}
            </Button>
          )}
        </div>
      )}
    </OwnDomainBox>
  )
}

/** The look and words of each `own.status`. */
const STATUSES = {
  pending: {
    pill: { kind: 'progress' },
    icon: <ArrowClockwise aria-hidden='true' />,
    label: (t) => t('BUILDER_DOMAIN_PENDING', 'Setting up')
  },
  active: {
    pill: { kind: 'success' },
    icon: <Check2 aria-hidden='true' />,
    label: (t) => t('BUILDER_DOMAIN_ACTIVE', 'Active')
  },
  error: {
    pill: { kind: 'failed' },
    icon: <ExclamationCircle aria-hidden='true' />,
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
    <OwnDomainBox tone={status === 'error' ? 'error' : null} aria-labelledby='builder-own-domain-label'>
      <OwnDomainHead>
        <div>
          <MutedText small id='builder-own-domain-label'>{t('BUILDER_DOMAIN_YOURS', 'Your domain')}</MutedText>
          <OwnDomainName>
            {status === 'active'
              ? (
                <a href={getDomainUrl(own.name)} target='_blank' rel='noopener noreferrer'>
                  {own.name}
                  <BoxArrowUpRight aria-hidden='true' />
                  <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
                </a>
                )
              : <span>{own.name}</span>}
            <Pill {...copy.pill} role={status === 'pending' ? 'status' : undefined}>
              {copy.icon}
              {copy.label(t)}
            </Pill>
          </OwnDomainName>
        </div>
        <div>
          <Button type='button' color='primary' outline borderRadius='8px' disabled={busy} onClick={onChange}>
            {t('BUILDER_DOMAIN_CHANGE', 'Change')}
          </Button>
          <Button type='button' color='secundary' borderRadius='8px' disabled={busy} onClick={onRemove}>
            {domainAction === 'remove' ? t('BUILDER_DOMAIN_REMOVING', 'Removing…') : t('BUILDER_DOMAIN_REMOVE', 'Remove')}
          </Button>
        </div>
      </OwnDomainHead>

      {status === 'pending' && (
        <>
          <p>
            {t('BUILDER_DOMAIN_PENDING_HELP', 'We’re checking the CNAME record and getting the security certificate (HTTPS). This takes a few minutes, up to about 20. This page updates by itself, so you can leave it and come back.')}
          </p>
          <MutedText small>
            {t('BUILDER_DOMAIN_KEEP_RECORD', 'Meanwhile your website keeps opening at its temporary address. Keep the CNAME record _name_ → _target_ in your DNS.')
              .replace('_name_', recordName || own.name)
              .replace('_target_', target)}
          </MutedText>
        </>
      )}

      {status === 'active' && (
        <>
          <p>{t('BUILDER_DOMAIN_ACTIVE_HELP', 'Your website opens at this domain, with HTTPS.')}</p>
          <MutedText small>{t('BUILDER_DOMAIN_ACTIVE_KEEP', 'Keep the CNAME record in your DNS. If you remove it, this domain stops working.')}</MutedText>
        </>
      )}

      {failure && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3>{failure.title}</h3>
            <p>{failure.text.replace('_target_', target)}</p>
          </div>
          <CnameRecord name={recordName || own.name} target={target} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <Button type='button' color='primary' borderRadius='8px' disabled={busy} onClick={verify}>
              {domainAction === 'verify' ? t('BUILDER_DOMAIN_VERIFYING', 'Verifying…') : t('BUILDER_DOMAIN_VERIFY', 'Verify again')}
            </Button>
            {verifyCodes.length > 0 && (
              <FieldError role='alert'>
                <ExclamationCircle aria-hidden='true' />
                <span>
                  {verifyCodes.includes('domain.cname_missing')
                    ? t('BUILDER_DOMAIN_STILL_MISSING', 'The CNAME record for _domain_ still isn’t there. Check it in your provider and try again in a few minutes.').replace('_domain_', own.name)
                    : t('BUILDER_DOMAIN_VERIFY_ERROR', 'We couldn’t verify the domain. Try again.')}
                </span>
              </FieldError>
            )}
          </div>
          <MutedText small>{t('BUILDER_DOMAIN_STILL_TEMPORARY', 'Your website keeps opening at its temporary address.')}</MutedText>
        </>
      )}
    </OwnDomainBox>
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
        <BuilderMessage
          role='alert'
          tone='error'
          icon={<ExclamationCircle aria-hidden='true' />}
          title={t('BUILDER_DOMAIN_LOAD_ERROR', 'We couldn’t load your domain')}
          text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        >
          <Button color='primary' borderRadius='8px' onClick={() => reloadDomain()}>{t('BUILDER_RETRY', 'Try again')}</Button>
        </BuilderMessage>
      )
    }
    if (loading && !domain) {
      return <div aria-busy='true'><Skeleton height={140} borderRadius={10} /></div>
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
    <DomainsCard aria-labelledby='builder-web-domains'>
      <header>
        <h2 id='builder-web-domains'>{t('BUILDER_DOMAINS', 'Domains')}</h2>
        <p>{t('BUILDER_DOMAINS_HELP', 'The addresses where people open your website.')}</p>
      </header>
      <div>
        {renderOwn()}

        {temporary && (
          <TemporaryDomain>
            <div>
              <MutedText small>{t('BUILDER_DOMAIN_TEMPORARY', 'Temporary address')}</MutedText>
              <a href={getDomainUrl(temporary)} target='_blank' rel='noopener noreferrer'>
                {temporary}
                <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
              </a>
              <MutedText small>{t('BUILDER_DOMAIN_TEMPORARY_HELP', 'Always works, also after you add your own domain.')}</MutedText>
            </div>
            <CopyValue value={temporary} />
          </TemporaryDomain>
        )}
      </div>

      <Confirm
        open={removeOpen}
        width='min(480px, calc(100vw - 72px))'
        title={t('BUILDER_DOMAIN_REMOVE_TITLE', 'Remove _domain_?').replace('_domain_', own?.name || '')}
        acceptText={t('BUILDER_DOMAIN_REMOVE_ACCEPT', 'Remove domain')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={handleRemove}
        onCancel={() => setRemoveOpen(false)}
        onClose={() => setRemoveOpen(false)}
      >
        <p>{t('BUILDER_DOMAIN_REMOVE_HELP', 'Your website stops opening at _domain_ right away.').replace('_domain_', own?.name || '')}</p>
        {temporary && (
          <p>{t('BUILDER_DOMAIN_REMOVE_TEMPORARY', 'It stays online at _temporary_. You can add a domain again later.').replace('_temporary_', temporary)}</p>
        )}
      </Confirm>
    </DomainsCard>
  )
}
