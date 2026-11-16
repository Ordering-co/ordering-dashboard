import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useLanguage, useSession, useUtils, BusinessGoogleActions as BusinessGoogleActionsController } from '../../../../../index'
import { useGoogleActionsVisibility } from '../../../hooks/useGoogleActionsVisibility'
import {
  GOOGLE_ACTIONS_CURRENCY_SETTINGS_URL,
  GOOGLE_ACTIONS_REASON_SECTIONS,
  GOOGLE_ACTIONS_REASON_TABS,
  GOOGLE_ACTIONS_STATE_FAMILIES,
  getDefaultGoogleSite,
  getGoogleActionsReasonLabels,
  getGoogleActionsStateLabels,
  getGoogleActionsState,
  getGoogleConsentAuthor,
  getGoogleSiteUrl,
  toGoogleActionsUtc
} from '../../../../../utils/googleActions'
import { Button, Checkbox, ConfirmDialog, InlineNotice, SelectField, Skeleton, StatusBadge } from '../../Shared/Product'
import './order-with-google.css'

// , part 2 of 4: the store's «Order with Google» section (Channels). Activates the store on Google Actions Center
// with the site its button opens and the consent, shows the state the API gives (`google_actions_status`) and deactivates.
// The menu offers it only while the project shows Google (`useGoogleActionsVisibility`); opened by address otherwise, it
// shows nothing. Connect › Order with Google shows it in its store panel (`embedded`: no page title; `onChange` after an
// activation or a deactivation). The button to the section that fixes a reason shows only when `canOpenSection(id, tab)` (the
// person's menu, as the Overview). Prefix: odc-gaw-*.

const BusinessOrderWithGoogleUI = (props) => {
  const {
    business,
    onOpenSection,
    canOpenSection = () => true,
    onChange,
    embedded = false,
    statusState,
    sitesState,
    actionState,
    getSites,
    handleActivate,
    handleDeactivate,
    clearActionError
  } = props

  const [, t] = useLanguage()
  const [{ getTimeAgo }] = useUtils()
  const { refresh } = useGoogleActionsVisibility()
  const [siteId, setSiteId] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const data = statusState.data
  const state = getGoogleActionsState(data)
  const slug = business?.slug
  const usableSites = sitesState.sites.filter(site => getGoogleSiteUrl(site, slug))

  useEffect(() => { getSites() }, [])
  useEffect(() => {
    if (siteId !== null || !usableSites.length) return
    const preferred = usableSites.find(site => site.id === data?.site_id) || getDefaultGoogleSite(usableSites, slug)
    if (preferred) setSiteId(preferred.id)
  }, [usableSites.length, data?.site_id])

  const stateLabels = getGoogleActionsStateLabels(t)
  const reasonLabels = getGoogleActionsReasonLabels(t)
  const [{ user } = {}] = useSession() || []
  const history = useHistory()
  const sectionLabels = {
    store_details: t('STORE_DETAILS', 'Store details'),
    schedule: t('SCHEDULE', 'Schedule'),
    delivery_pickup_more: t('DELIVERY_PICKUP_MORE', 'Delivery, pickup & more')
  }
  const errorText = (actionState.code === 'google_actions.not_eligible' && actionState.reason && reasonLabels[actionState.reason]) ||
    (Array.isArray(actionState.error) ? actionState.error.join(' ') : actionState.error)
  // The button that opens the store section (and its tab) that fixes a reason: a store not sent, or an activation the API
  // refused for it. None for a reason no section edits, or a section this person cannot open.
  const fixButton = (fixReason) => {
    // The currency is the project's: Settings, which only level 0 opens
    if (fixReason === 'no_currency') {
      if (user?.level !== 0) return null
      return (
        <Button variant='secondary' size='sm' onClick={() => history.push(GOOGLE_ACTIONS_CURRENCY_SETTINGS_URL)}>
          {t('GOOGLE_ACTIONS_OPEN_SECTION', 'Open _section_').replace('_section_', t('SETTINGS_SECTION_STRIPE', 'Card payments (Stripe)'))}
        </Button>
      )
    }
    const section = GOOGLE_ACTIONS_REASON_SECTIONS[fixReason]
    const tab = GOOGLE_ACTIONS_REASON_TABS[fixReason]
    if (!section || !onOpenSection || !canOpenSection(section, tab)) return null
    return (
      <Button variant='secondary' size='sm' onClick={() => onOpenSection(section, tab)}>
        {t('GOOGLE_ACTIONS_OPEN_SECTION', 'Open _section_').replace('_section_', sectionLabels[section])}
      </Button>
    )
  }
  const errorReason = actionState.code === 'google_actions.not_eligible' ? actionState.reason : null

  const activate = async () => {
    if (await handleActivate(siteId)) {
      setAccepted(false)
      refresh()
      onChange?.()
    }
  }
  const deactivate = async () => {
    if (await handleDeactivate()) {
      setConfirmOpen(false)
      refresh()
      onChange?.()
    }
  }

  // In a panel (Connect › Order with Google) the panel's header names the store: no page title of its own
  const intro = (
    <div className='odc-gaw-intro'>
      {!embedded && <h1 className='odc-gaw-title'>{t('ORDER_WITH_GOOGLE', 'Order with Google')}</h1>}
      <p className='odc-gaw-lead'>
        {t('ORDER_WITH_GOOGLE_INTRO', 'Show an “Order online” button for this store on Google Search and Maps. It opens this store on your website; the order is placed and paid there.')}
      </p>
    </div>
  )

  if (statusState.loading && !data) {
    return (
      <div className='odc-root odc-gaw'>
        {intro}
        <div className='odc-gaw-card'><Skeleton size='40%' /><Skeleton /><Skeleton /><Skeleton size='30%' /></div>
      </div>
    )
  }
  if (statusState.error || state === null) {
    return (
      <div className='odc-root odc-gaw'>
        {intro}
        <InlineNotice tone='info' live={false}>
          {statusState.error
            ? t('GOOGLE_ACTIONS_LOAD_ERROR', 'The Google status of this store could not be loaded.')
            : t('GOOGLE_ACTIONS_NOT_AVAILABLE', 'Order with Google is not available for this project yet.')}
        </InlineNotice>
      </div>
    )
  }

  const reason = data?.status_reason
  const author = getGoogleConsentAuthor(data)
  const checkedAt = toGoogleActionsUtc(data?.checked_at)
  const uploadedAt = toGoogleActionsUtc(data?.feed?.last_uploaded_at)

  return (
    <div className='odc-root odc-gaw'>
      {intro}
      <section className='odc-gaw-card' aria-label={t('ORDER_WITH_GOOGLE', 'Order with Google')}>
        <div className='odc-gaw-state'>
          {state === 'not_activated'
            ? <span className='odc-gaw-state-plain'>{stateLabels.not_activated}</span>
            : <StatusBadge family={GOOGLE_ACTIONS_STATE_FAMILIES[state]} label={stateLabels[state]} />}
          {state === 'sent' && uploadedAt && (
            <span className='odc-gaw-muted'>{t('GOOGLE_ACTIONS_LAST_UPLOAD', 'Last upload _time_').replace('_time_', getTimeAgo(uploadedAt))}</span>
          )}
          {state === 'not_activated' && (
            <span className='odc-gaw-muted'>{t('GOOGLE_ACTIONS_NOT_SHOWN', 'Google does not show this store yet.')}</span>
          )}
        </div>

        {state === 'skipped' && (
          <InlineNotice
            tone='danger'
            live={false}
            action={fixButton(reason)}
          >
            {reasonLabels[reason] || t('GOOGLE_ACTIONS_REASON_UNKNOWN', 'Google needs more information about this store.')}
          </InlineNotice>
        )}

        {state === 'not_activated'
          ? (
            <div className='odc-gaw-form'>
              <SelectField
                label={t('GOOGLE_ACTIONS_SITE', 'Website the button opens')}
                options={usableSites.map(site => ({ value: site.id, label: getGoogleSiteUrl(site, slug) }))}
                value={siteId}
                onValueChange={value => setSiteId(Number(value))}
                placeholder={t('GOOGLE_ACTIONS_SITE_PLACEHOLDER', 'Choose a website')}
                loading={sitesState.loading}
                loadingLabel={t('LOADING', 'Loading')}
                noResultsLabel={t('GOOGLE_ACTIONS_NO_SITE', 'No website has an https address for this store')}
              />
              <p className='odc-gaw-consent-text'>
                {t('GOOGLE_ACTIONS_CONSENT_TEXT', 'Ordering will send Google this store\'s name, address, phone, hours, delivery and pickup times, delivery fee and the link to the store. You can turn it off at any time.')}
              </p>
              <Checkbox
                checked={accepted}
                onCheckedChange={value => setAccepted(value === true)}
              >
                {t('GOOGLE_ACTIONS_CONSENT_ACCEPT', 'I accept sharing this store\'s information with Google (version _version_).').replace('_version_', data?.current_consent_version || '')}
              </Checkbox>
              {errorText && <InlineNotice tone='danger' onClick={clearActionError} action={fixButton(errorReason)}>{errorText}</InlineNotice>}
              <div className='odc-gaw-actions'>
                <Button variant='primary' busy={actionState.loading} disabled={!accepted || !siteId} onClick={activate}>
                  {t('GOOGLE_ACTIONS_ACTIVATE', 'Accept and activate')}
                </Button>
              </div>
            </div>
            )
          : (
            <>
              <dl className='odc-gaw-facts'>
                {data?.sent_url && (
                  <div><dt>{t('GOOGLE_ACTIONS_LINK', 'Link Google opens')}</dt><dd><a href={data.sent_url} target='_blank' rel='noopener noreferrer'>{data.sent_url}</a></dd></div>
                )}
                {checkedAt && <div><dt>{t('GOOGLE_ACTIONS_CHECKED', 'Checked')}</dt><dd>{getTimeAgo(checkedAt)}</dd></div>}
                {author && <div><dt>{t('GOOGLE_ACTIONS_ACTIVATED_BY', 'Activated by')}</dt><dd>{author}</dd></div>}
              </dl>
              <p className='odc-gaw-muted'>
                {t('GOOGLE_ACTIONS_REALTIME_NOTE', 'Pausing the store, or changing its delivery or pickup times or its delivery zones, reaches Google within a minute.')}
              </p>
              {errorText && <InlineNotice tone='danger' onClick={clearActionError}>{errorText}</InlineNotice>}
              <div className='odc-gaw-actions'>
                <Button variant='secondary' onClick={() => setConfirmOpen(true)}>{t('GOOGLE_ACTIONS_DEACTIVATE', 'Deactivate on Google')}</Button>
              </div>
            </>
            )}
      </section>
      <ConfirmDialog
        open={confirmOpen}
        title={t('GOOGLE_ACTIONS_DEACTIVATE_TITLE', 'Deactivate Order with Google?')}
        confirmLabel={t('GOOGLE_ACTIONS_DEACTIVATE', 'Deactivate on Google')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={actionState.loading}
        onConfirm={deactivate}
        onCancel={() => setConfirmOpen(false)}
      >
        {t('GOOGLE_ACTIONS_DEACTIVATE_TEXT', 'Google removes the “Order online” button of this store within a minute. You can activate it again later.')}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessOrderWithGoogle = (props) => (
  <BusinessGoogleActionsController
    {...props}
    businessId={props.business?.id}
    UIComponent={BusinessOrderWithGoogleUI}
  />
)
