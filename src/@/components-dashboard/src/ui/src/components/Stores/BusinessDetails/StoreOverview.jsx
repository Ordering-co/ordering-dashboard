import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils } from '~components'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, IconButton, InlineNotice, Skeleton, Status } from '../../Shared/Product'
import { ChevronRight, ExternalLink } from '../../Shared/Icon'
import { isFutureApi } from '../SnoozeComponent/utils'
import { formatClock, storeOpenNow } from '../StoresList/storeOpenNow'
import { overviewFacts, snoozeUntilText, todayHoursText } from './storeOverviewModel'
import { StoreSlugField } from '../StoreSlugField'
import { StoreGoogleFact } from './StoreGoogleFact'
import './store-editor.css'

// redesign SL-F2 (B2), redesign stores 4.B (decision 3)
// What the store editor shows with no section open, above the grouped list of sections: does the store take orders now, is it
// snoozed, is something missing. In order: the snooze in force (with «End snooze»), the status and the hours of today, the
// figures of the store (each with the way to its section), the web address (the slug, saved with its own «Save») and the
// description (main 4b7ff4f9 + owner decision 1A, no Clover here; it is connected from Connect › POS). Everything comes from the request the editor already makes (plus
// `snooze_until`); the header image is edited in Store details › Information and is no longer drawn here.
//
// The slug and the snooze are saved with `keepPendingChanges`: only that key goes, the answer is said here, and nothing else
// the shared form holds is sent or lost. A slug typed and not saved stays in the shared form, so leaving asks (2.A).
//
// @param {object}   props
// @param {boolean}  props.loading
// @param {object}   [props.business]
// @param {boolean}  props.isAdmin                  `user.level === 0`
// @param {boolean}  props.isWhiteLabelModule       `configs.white_label_module`: no link to the public site.
// @param {boolean}  [props.is12Hours]              The project writes times in 12 hours (`format_time` = 12).
// @param {string}   [props.storeUrl]
// @param {Function} props.onOpenSite
// @param {object}   props.formState
// @param {Function} props.setFormState
// @param {Function} props.handleUpdateBusinessClick  `(changes, { keepPendingChanges }) => Promise<{ ok, error }>`.
// @param {Function} [props.canOpenSection]       `(id) => boolean`: the section is in this person's menu (a figure links to it).
// @param {Function} [props.onOpenSection]        `(id) => void`: opens it, the way the list of sections does.
// @param {Array}    [props.sections]             `[{ id, label }]`, to name a section in its link.

const MINUTE_MS = 60 * 1000

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

// A text with one placeholder, the value of which is a figure (mono, tabular): «until _date_» -> until <span>…</span>
const withFigure = (template, token, value) => {
  const [before, ...rest] = template.split(token)
  return <>{before}<span className='odc-figure'>{value}</span>{rest.join(token)}</>
}

// redesign bugs Q: only the numbers of a text are figures (mono, tabular); the words, «AM» / «PM», «of», «reviews» and
// «No reviews yet» stay in the interface font. «12:00 AM–11:59 PM» -> <12:00> AM–<11:59> PM; «5 (4 reviews)» -> <5> (<4> reviews).
const withFigures = (text) => String(text).split(/(\d+(?:[:.,]\d+)*)/).map((part, index) =>
  index % 2 === 1 ? <span key={index} className='odc-figure'>{part}</span> : part
)

export const StoreOverview = ({
  loading,
  business,
  isAdmin,
  isWhiteLabelModule,
  is12Hours,
  storeUrl,
  onOpenSite,
  formState,
  setFormState,
  handleUpdateBusinessClick,
  canOpenSection = () => false,
  onOpenSection,
  sections = []
}) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code
  const [{ parseDate } = {}] = useUtils()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ── Snooze ──
  const [now, setNow] = useState(() => Date.now())
  const [endingSnooze, setEndingSnooze] = useState(false)
  const [snoozeError, setSnoozeError] = useState(null)
  // The value «End snooze» cleared: hidden at once, even if the answer of the API does not carry `snooze_until`.
  const [endedSnooze, setEndedSnooze] = useState(null)
  // «End snooze» goes away once it worked: the focus goes to the line that says so, not to the page
  const endedRef = useRef(null)
  const snoozeUntil = business?.snooze_until
  const snoozed = !!snoozeUntil && snoozeUntil !== endedSnooze && isFutureApi(snoozeUntil, now)
  useEffect(() => {
    if (!snoozed) return
    // the notice goes away by itself when the snooze runs out
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [snoozed])

  const handleEndSnooze = async () => {
    if (endingSnooze) return
    setEndingSnooze(true)
    setSnoozeError(null)
    const result = await handleUpdateBusinessClick({ snooze_until: null }, { keepPendingChanges: true })
    if (!mounted.current) return
    setEndingSnooze(false)
    if (result?.ok) {
      setEndedSnooze(snoozeUntil)
      requestAnimationFrame(() => endedRef.current?.focus())
    } else setSnoozeError(translateApiMessage(t, firstMessage(result?.error), t('STORE_SNOOZE_END_FAILED', 'We couldn\'t end the snooze. Try again.')))
  }

  // ── Slug ── redesign stores 5.1b (decision 4): the one slug editor, `S/StoreSlugField`, with its own «Save»
  const saveSlug = (slug) => handleUpdateBusinessClick({ slug }, { keepPendingChanges: true })
  const previewButton = !isWhiteLabelModule && (
    <IconButton
      icon={ExternalLink}
      label={t('PREVIEW', 'Preview')}
      disabled={!storeUrl}
      onClick={onOpenSite}
    />
  )

  if (loading) {
    return (
      <div className='odc-se-overview' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <div className='odc-se-skeletons'>
          <Skeleton size='var(--od-x-cell-person)' />
          <Skeleton />
          <Skeleton />
          <Skeleton size='60%' />
        </div>
      </div>
    )
  }

  const sectionLabel = (id) => sections.find(section => section.id === id)?.label ?? id
  // the Order with Google state, while its section is in this person's menu (the project shows Google)
  const showGoogle = !!business?.id && canOpenSection('google_actions')

  // ── Today ──
  // while snoozed the notice above says it takes no orders; the server's `open` follows the schedule, so it is not said here
  const openState = snoozed ? null : storeOpenNow(business)
  const hours = todayHoursText(business?.today, is12Hours, locale)
  const statusLabel = !openState
    ? null
    : openState.open
      ? openState.allDay
        ? t('STORES_OPEN_ALL_DAY', 'Open 24 hours')
        : openState.closes
          ? t('STORES_OPEN_CLOSES_AT', 'Open · closes _time_').replace('_time_', formatClock(openState.closes, is12Hours, locale))
          : t('STORES_OPEN_NOW', 'Open')
      : openState.opens
        ? t('STORES_CLOSED_OPENS_AT', 'Closed · opens _time_').replace('_time_', formatClock(openState.opens, is12Hours, locale))
        : t('CLOSED', 'Closed')

  // ── Figures ──
  const none = t('STORE_OVERVIEW_NONE', 'None')
  const factLabel = {
    menus: t('STORE_OVERVIEW_MENUS', 'Menus available'),
    zones: t('STORE_OVERVIEW_ZONES', 'Delivery zones'),
    times: t('STORE_OVERVIEW_TIMES', 'Delivery · pickup time'),
    paymethods: t('STORE_OVERVIEW_PAYMETHODS', 'Payment methods on'),
    promotions: t('STORE_OVERVIEW_PROMOTIONS', 'Promotions on'),
    rating: t('STORE_OVERVIEW_RATING', 'Rating')
  }
  const factValue = (fact) => {
    switch (fact.id) {
      case 'menus':
        return fact.value.total === 0
          ? none
          : t('STORE_OVERVIEW_OF', '_count_ of _total_').replace('_count_', fact.value.available).replace('_total_', fact.value.total)
      case 'times':
        return `${fact.value.delivery ?? '—'} · ${fact.value.pickup ?? '—'} h`
      case 'rating':
        return fact.value.total == null
          ? t('STORE_OVERVIEW_NO_REVIEWS', 'No reviews yet')
          : `${fact.value.total} (${t('STORE_OVERVIEW_REVIEWS', '_count_ reviews').replace('_count_', fact.value.count)})`
      default:
        return fact.value === 0 && fact.warn ? none : String(fact.value)
    }
  }
  const facts = overviewFacts(business)
  // the end of the snooze on the store's clock; null without a timezone it can read (then the person's clock, unnamed)
  const snoozeInZone = snoozed ? snoozeUntilText(snoozeUntil, business?.timezone, is12Hours, locale) : null
  const canEditDescription = canOpenSection('store_details')

  return (
    <div className='odc-se-overview'>
      {snoozed && (
        <InlineNotice
          tone='warning'
          className='odc-se-snoozed'
          action={(
            <Button size='sm' busy={endingSnooze} onClick={handleEndSnooze}>
              {t('STORE_SNOOZE_END', 'End snooze')}
            </Button>
          )}
        >
          <strong>
            {withFigure(
              t('SNOOZE_STATUS_UNTIL', 'Snoozed until _date_'),
              '_date_',
              snoozeInZone ?? (parseDate ? parseDate(snoozeUntil, { utc: true }) : snoozeUntil)
            )}
            {/* redesign bugs C: which clock, as the hours of today say it (the Snooze dialog says the same) */}
            {snoozeInZone && <>{' '}<span className='odc-se-today-zone'>({business.timezone})</span></>}
          </strong>
          {' '}
          {t('STORE_SNOOZE_CLOSED_NOTE', 'The store takes no orders until then.')}
        </InlineNotice>
      )}
      {endedSnooze && !snoozed && (
        <p ref={endedRef} tabIndex={-1} role='status' className='odc-se-ended'>{t('STORE_SNOOZE_ENDED', 'Snooze ended. The store takes orders again on its schedule.')}</p>
      )}
      {snoozeError && (
        <InlineNotice tone='danger' role='alert' className='odc-se-snoozed'>{snoozeError}</InlineNotice>
      )}

      {(statusLabel || hours !== undefined) && (
        <div className='odc-se-today'>
          {statusLabel && (openState.open
            ? <Status family='done' label={statusLabel} />
            : <Status family='cancel' label={statusLabel} />)}
          <span className='odc-se-today-hours'>
            {hours === null
              ? t('STORE_OVERVIEW_CLOSED_TODAY', 'Closed today')
              : hours !== undefined && (
                // redesign tanda AB (S-4c): `.odc-se-today-hours` is a flex container with a gap; one element keeps the
                // label and the range together, or the gap opens a space inside «12:00 AM–11:59 PM»
                <span>{t('TODAY', 'Today')}{' '}{withFigures(hours)}</span>
              )}
            {business?.timezone && <span className='odc-se-today-zone'>{business.timezone}</span>}
          </span>
        </div>
      )}

      {(facts.length > 0 || showGoogle) && (
        <dl className='odc-se-facts'>
          {facts.map(fact => {
            const linkable = !!fact.section && canOpenSection(fact.section)
            return (
              <div key={fact.id} className='odc-se-fact' data-warn={fact.warn ? '' : undefined}>
                <dt>{factLabel[fact.id]}</dt>
                <dd>
                  {/* menus and rating are phrases with a number in them; the others are one figure */}
                  {fact.id === 'menus' || fact.id === 'rating'
                    ? <span>{withFigures(factValue(fact))}</span>
                    : <span className='odc-figure'>{factValue(fact)}</span>}
                  {linkable && (
                    <IconButton
                      icon={ChevronRight}
                      flipInRtl
                      size='sm'
                      label={t('STORE_OVERVIEW_OPEN_SECTION', 'Open _section_').replace('_section_', sectionLabel(fact.section))}
                      onClick={() => onOpenSection?.(fact.section)}
                    />
                  )}
                </dd>
              </div>
            )
          })}
          {showGoogle && (
            <StoreGoogleFact
              businessId={business.id}
              label={sectionLabel('google_actions')}
              openLabel={t('STORE_OVERVIEW_OPEN_SECTION', 'Open _section_').replace('_section_', sectionLabel('google_actions'))}
              onOpen={() => onOpenSection?.('google_actions')}
            />
          )}
        </dl>
      )}

      {/* main: every level edits the slug here; the EatStreet owner rule is gone */}
      <div className='odc-se-row odc-se-address'>
        <StoreSlugField
          fieldClassName='odc-se-slug'
          savedSlug={business?.slug}
          formState={formState}
          setFormState={setFormState}
          onSave={saveSlug}
          hint={storeUrl && !isWhiteLabelModule ? storeUrl.replace(/^https?:\/\//, '') : undefined}
        >
          {previewButton}
        </StoreSlugField>
      </div>

      {business?.description && (
        <div className='odc-se-about'>
          <p className='odc-se-description'>{business.description}</p>
          {canEditDescription && (
            <Button variant='link' onClick={() => onOpenSection?.('store_details')}>
              {t('STORE_OVERVIEW_EDIT_IN', 'Edit in _section_').replace('_section_', sectionLabel('store_details'))}
            </Button>
          )}
        </div>
      )}

    </div>
  )
}
