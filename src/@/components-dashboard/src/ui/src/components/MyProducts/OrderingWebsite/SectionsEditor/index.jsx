import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'

import { useApi, useConfig, useLanguage, useSite } from '../../../../../../index'
import { translateApiMessage } from '../../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../../contexts/InfoShareContext'
import { useProjectState } from '../../../../contexts/ProjectContext'
import { useRouteLeaveGuard } from '../../../../hooks/useRouteLeaveGuard'
import { learnOptionsValues } from '../../../../utils'
import { getPreferredSiteUrl } from '../../../../utils/getPreferredSiteUrl'
import { Button, EmptyState, IconButton, LeaveDialog, Menu, PageHeader, SaveBar, SectionNav, Skeleton, useLeaveGuard, useLeaveGuardHost } from '../../../Shared/Product'
import { useIsPhone } from '../../../Shared/Product/useIsPhone'
import { CircleAlert, Menu as MenuIcon } from '../../../Shared/Icon'
import { LearnDropDown } from '../../../Shared/LearnDropDown'
import { WebsiteInBuilder, WebsiteMigration } from '../../WebsiteMigration'
import { DEFAULT_SECTION, buildGroups, buildSections } from './sections'
import { countChanges } from './themeDraft'
import './sections-editor.css'

// redesign ordering-website B3a (; D1, D2, D4): the sections editor of /my-products/ordering-website. A page header (title,
// description, Learn, «Visit my Website»), the navigation by groups (Website · Advanced · Integrations), ONE section at a time (in the
// URL, `?section=`) and ONE save bar for the whole editor. It is opt-in: `OrderingWebsiteUI` chooses it with `layout='sections'`.
//
// redesign D-81 (owner, 2026-10-19): leaving the editor with unsaved changes asks «Keep editing · Save and continue · Discard»
// (P/LeaveGuard). The draft is ONE for all the sections, so `?section=` (same pathname) never asks; what asks is a route change to
// another pathname (links, sidebar, back and forward), ⌘K and Mia, and closing or reloading the tab (the browser's own prompt). A Save
// that fails keeps the person here with the reason in the save bar. See ui/src/hooks/useRouteLeaveGuard.js.
//
// The controller (B2) gives it, besides what the legacy editor already had: `saving`, `savedValues` (the saved theme), `savedSite`,
// `handleSaveAll()` → Promise<{ ok, error? }> and `discardChanges()`. The sections are the registry of ./sections.js.

const ROUTE_WEBSITE = '/my-products/ordering-website'
const ROUTE_WEBSITE_2 = '/my-products/ordering-website-2'
const SAVED_VISIBLE_MS = 3000

const learnKeys = [
  'ordering_website_general_view',
  'website_basic_settings',
  'website_advanced_settings',
  'website_widget'
]

const fill = (template, count) => template.replace('_count_', () => String(count))

// The message of a failed save, whatever shape the controller gave it (text, list of texts or an Error).
const errorMessageOf = (error) => {
  const first = Array.isArray(error) ? error[0] : error
  const raw = first instanceof Error ? first.message : first
  return typeof raw === 'string' ? raw : ''
}

export const OrderingWebsiteSections = (props) => {
  const {
    orderingTheme,
    themeValues,
    savedValues,
    savedSite,
    advancedValues,
    formState,
    saving,
    handleSaveAll,
    discardChanges,
    isFranchise,
    forcedSiteId,
    appId,
    setAppIdState,
    reloadSite,
    site,
    withMigration,
    disableSiteCreation,
    siteMissing
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ sites }] = useSite()
  const [ordering, { configurations }] = useApi()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [projectStatus] = useProjectState()
  const location = useLocation()
  const history = useHistory()
  const isPhone = useIsPhone()
  const headingId = useId()

  // redesign J5 row 52 (ordering-website P-OW3, ): the store's and the brand's white label (`forcedSiteId`) mount this editor
  // inside a Stores panel. Embedded, it has no page header, its navigation is the selector, the section is local state (?section= is
  // the panel's own parameter) and its draft asks through the host around it (the panel's), never with a dialog or route guard of its own.
  const embedded = Boolean(forcedSiteId)
  const loading = Boolean(orderingTheme?.loading)
  // a site (or its theme) that did not load is not an empty site. Without a theme there is nothing to edit, so the
  // sections, the form and the save bar give way to the error and «Retry», which asks the controller for the site again.
  const loadFailed = !loading && !(orderingTheme?.themes?.length) && (Array.isArray(orderingTheme?.error) ? orderingTheme.error.length > 0 : Boolean(orderingTheme?.error))
  const [migrationState, setMigrationState] = useState(null)
  // main, ported into the sections layout (round 2): same gating as the legacy editor — a migrated site, or
  // one a page with no site creation never got, is edited in Builder; a page that creates no site shows the sections only once it
  // has one.
  const migratedSite = migrationState?.migration?.status === 'migrated' ? migrationState.migration : null
  const inBuilder = siteMissing || (!withMigration && !!site?.migrated_at)
  const showEditor = !inBuilder && (!withMigration || (!site?.id && !disableSiteCreation) || (migrationState?.loading === false && !migratedSite))
  const isWebsiteRoute = location.pathname === ROUTE_WEBSITE
  const isWebsite2Route = location.pathname === ROUTE_WEBSITE_2
  // redesign J5 row 52 (ordering-website P-OW3, ): the franchise website is named as its legacy editor named it
  const pageTitle = isFranchise
    ? t('FRANCHISE_WEBSITE', 'Franchise website')
    : isWebsite2Route ? t('ORDERING_WEBSITE_2', 'Ordering website 2') : t('ORDERING_WEBSITE', 'Ordering website')
  const leave = useLeaveGuardHost()

  const sections = useMemo(() => buildSections({ t, isFranchise, forcedSiteId }), [t, isFranchise, forcedSiteId])
  const groups = useMemo(() => buildGroups({ t, sections }), [t, sections])
  const learnOptions = useMemo(() => learnOptionsValues(learnKeys, t), [t])

  // The section is in the URL; an unknown id is the first one.
  const [localSection, setLocalSection] = useState(null)
  const requested = embedded ? localSection : new URLSearchParams(location.search).get('section')
  const current = sections.find((section) => section.id === requested) ?? sections.find((section) => section.id === DEFAULT_SECTION) ?? sections[0]
  const currentGroup = groups.find((group) => group.id === current.group)

  const [openGroups, setOpenGroups] = useState(() => [current.group])
  const [resetKey, setResetKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const savedTimer = useRef(null)
  const mounted = useRef(true)

  useEffect(() => () => {
    mounted.current = false
    clearTimeout(savedTimer.current)
  }, [])

  // A section opened from a link (or the back button) opens its group; a group the person closed stays closed otherwise.
  useEffect(() => {
    setOpenGroups((open) => (open.includes(current.group) ? open : [...open, current.group]))
  }, [current.group])

  const selectSection = (id) => {
    if (embedded) return setLocalSection(id)
    const next = new URLSearchParams(location.search)
    next.set('section', id)
    history.replace({ pathname: location.pathname, search: `?${next.toString()}`, hash: location.hash, state: location.state })
  }

  const toggleGroup = (id) => {
    setOpenGroups((open) => (open.includes(id) ? open.filter((item) => item !== id) : [...open, id]))
  }

  const { count, names } = useMemo(() => countChanges({
    themeValues,
    savedThemeValues: savedValues?.my_products?.components,
    advancedValues,
    savedValues,
    siteChanges: formState?.changes,
    savedSite,
    sections
  }), [themeValues, savedValues, advancedValues, formState?.changes, savedSite, sections])

  const handleSave = async () => {
    setErrorText(null)
    clearTimeout(savedTimer.current)
    setSaved(false)
    let result
    try {
      result = await handleSaveAll()
    } catch (error) {
      result = { ok: false, error }
    }
    if (!mounted.current) return { ok: true }
    if (result?.ok) {
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), SAVED_VISIBLE_MS)
      return { ok: true }
    }
    const message = translateApiMessage(t, errorMessageOf(result?.error), '')
    setErrorText(t('SETTINGS_SAVE_FAILED', 'We couldn\'t save your changes. _message_').replace('_message_', message).trim())
    return { ok: false }
  }

  const handleDiscard = () => {
    setErrorText(null)
    discardChanges()
    setResetKey((key) => key + 1)
  }

  // The draft registers itself in the host (the page is the host and the only form), and every way out asks through it. A Save that
  // fails answers `{ ok: false }`: the host keeps the person here and the save bar shows the reason.
  const guardEntry = useRef(null)
  guardEntry.current = { isDirty: () => count > 0, count: () => count, save: handleSave, discard: handleDiscard }
  useEffect(() => (embedded ? undefined : leave.context.register(guardEntry)), [leave.context, embedded])
  useRouteLeaveGuard({ active: !embedded && count > 0, requestLeave: leave.requestLeave })
  useLeaveGuard({
    dirty: embedded && count > 0,
    count,
    label: t('SITE_AND_THEME', 'Site & theme'),
    save: handleSave,
    discard: handleDiscard
  })

  const handleVisit = () => {
    const websiteUrl = getPreferredSiteUrl({
      sites,
      configurations,
      configs,
      ordering,
      websiteProduct: projectStatus?.websiteProduct
    })
    if (websiteUrl) window.open(websiteUrl, '_blank', 'noopener,noreferrer')
  }

  // redesign J5 row 52: the franchise site picker of the legacy editor (two or more franchise sites), in the header. Another site
  // replaces the one being edited, so unsaved changes are asked about first (D-81 part B), through this page's host.
  const franchiseSites = useMemo(() => (isFranchise ? (sites || []).filter(site => site?.type === 'franchiseweb') : []), [isFranchise, sites])
  const currentSiteCode = appId || 'web_franchises_x'
  const currentSiteName = franchiseSites.find(site => site?.code === currentSiteCode)?.name || t('SELECT_SITE', 'Select site')
  const pickSite = (code) => {
    if (!setAppIdState || code === currentSiteCode) return
    leave.requestLeave(() => setAppIdState(code))
  }
  const sitePicker = franchiseSites.length > 1
    ? (
      <Menu
        // review J5 #4: a key of its own (SITE has «Locatie», «Local», «sitesi» in nl, pt and tr)
        label={t('FRANCHISE_SITE_PICKER', 'Site: _name_').replace('_name_', () => currentSiteName)}
        items={franchiseSites.map(site => ({
          key: site.code,
          label: site.name || site.code,
          type: 'radio',
          checked: site.code === currentSiteCode,
          onSelect: () => pickSite(site.code)
        }))}
      />
      )
    : undefined

  const supportUrl = 'https://www.ordering.co/support/'
  const SectionComponent = current.Component

  return (
    <div className='odc-root odc-ows' data-embedded={embedded ? '' : undefined}>
      {!embedded && (
      <PageHeader
        className='odc-ows-head'
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        title={pageTitle}
        // main: the description and «Visit my website» were the product card's, which goes away with the editor
        description={isWebsiteRoute && showEditor
          ? (
            <>
              {t('MY_PRODUCTS_INFO', 'Use the advanced configurations below to customize your products changing the images, colors, available options and others with a few clicks. If you have doubts, please contact our team here:')}
              {' '}
              {/* // redesign tanda AB (C-2): the link reads «Contact support» instead of the raw URL; the href is unchanged */}
              <a href={supportUrl} rel='noopener noreferrer' target='_blank'>{t('CONTACT_SUPPORT', 'Contact support')}</a>
            </>
            )
          : undefined}
        learn={isWebsiteRoute ? <LearnDropDown learnOptions={learnOptions} /> : undefined}
        actions={sitePicker}
        primaryAction={isWebsiteRoute && showEditor
          ? (
            <Button variant='primary' disabled={!projectStatus?.websiteProduct} onClick={handleVisit}>
              {t('VISIT_MY_WEBSITE_LINK', 'Visit my website')}
            </Button>
            )
          : undefined}
      />
      )}

      {loadFailed && (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          title={t('ORDERING_WEBSITE_LOAD_ERROR', "We couldn't load your website.")}
          action={<Button onClick={() => reloadSite?.()}>{t('RETRY', 'Retry')}</Button>}
        />
      )}

      {!loadFailed && withMigration && site?.id && (
        <WebsiteMigration siteId={site.id} onChange={setMigrationState} />
      )}
      {!loadFailed && inBuilder && <WebsiteInBuilder />}

      {!loadFailed && showEditor && (
      <div className='odc-ows-body'>
        <div className='odc-ows-nav'>
          <SectionNav
            label={t('WEBSITE_SECTIONS', 'Website sections')}
            compactLabel={t('WEBSITE_SECTIONS', 'Website sections')}
            items={sections.map((section) => ({
              id: section.id,
              label: section.label,
              description: section.description,
              group: section.group,
              disabled: loading
            }))}
            groups={groups}
            openGroups={openGroups}
            onGroupSelect={toggleGroup}
            value={current.id}
            onValueChange={selectSection}
            selectorOnly={isPhone || embedded}
          />
        </div>

        <div className='odc-ows-main'>
          <section
            key={`${current.id}:${resetKey}`}
            className='odc-ows-content'
            aria-labelledby={headingId}
            tabIndex={-1}
            data-section={current.id}
          >
            <header className='odc-ows-content-head'>
              {current.group !== 'website' && currentGroup && <p className='odc-ows-eyebrow'>{currentGroup.label}</p>}
              <h2 id={headingId} className='odc-ows-title'>{current.label}</h2>
            </header>
            {loading
              ? (
                <div className='odc-ows-skeleton' role='status' aria-busy='true'>
                  <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
                  <Skeleton size='30%' />
                  <Skeleton block='var(--od-x-control-height)' />
                  <Skeleton size='30%' />
                  <Skeleton block='var(--od-x-control-height-lg)' />
                  <Skeleton size='30%' />
                  <Skeleton block='var(--od-x-control-height)' />
                </div>
                )
              : SectionComponent && <SectionComponent {...props} />}
          </section>

          <SaveBar
            label={t('SAVE_CHANGES', 'Save changes')}
            formSelector='.odc-ows-content'
            count={count}
            countText={fill(count === 1
              ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
              : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
            names={names}
            moreText={(n) => fill(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
            saving={Boolean(saving)}
            errorText={errorText}
            saved={saved}
            savedText={t('SAVED', 'Saved')}
            discardLabel={t('DISCARD', 'Discard')}
            saveLabel={t('SAVE_CHANGES', 'Save changes')}
            onDiscard={handleDiscard}
            onSave={handleSave}
          />
        </div>
      </div>
      )}

      {!embedded && (
      <LeaveDialog
        open={leave.dialog.open}
        saving={leave.dialog.saving}
        onKeep={leave.dialog.onKeep}
        onDiscard={leave.dialog.onDiscard}
        onSave={leave.dialog.onSave}
        returnFocus={leave.dialog.returnFocus}
        title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
        description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.')
          .replace('_section_', () => pageTitle)}
        keepLabel={t('KEEP_EDITING', 'Keep editing')}
        saveLabel={t('SAVE_AND_CONTINUE', 'Save and continue')}
        discardLabel={t('DISCARD', 'Discard')}
        closeLabel={t('CLOSE', 'Close')}
      />
      )}
    </div>
  )
}
