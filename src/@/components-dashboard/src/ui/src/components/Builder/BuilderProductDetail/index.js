import React, { useEffect, useRef, useState } from 'react'

import {
  BuilderProductDetail as BuilderProductDetailController,
  ToastType,
  useEvent,
  useLanguage,
  useToast,
  useUtils
} from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { CircleAlert, Ellipsis, Info, LockKeyhole, Menu as MenuIcon, Pencil, Phone } from '../../Shared/Icon'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  Menu,
  Skeleton,
  StatusBadge,
  TabPanel,
  Tabs,
  TextField
} from '../../Shared/Product'
import { BuilderAppColors, BuilderAppFiles } from '../BuilderAppSettings'
import { BuilderAppConstantsList } from '../BuilderAppConstants'
import { BuilderAppCredentialsForm } from '../BuilderAppCredentials'
import { BuilderAppBuildsHistory, BuilderBuildsCard, useBuildActions } from '../BuilderAppBuilds'
import { BuilderProductPushSettings } from '../BuilderProductPush'
import {
  getAppDetailTabs,
  getAppFieldError,
  getCheckProblems,
  getDetailTab,
  getNameMaxLength,
  getNameTooLongMessage,
  getOwnDomain,
  getPlatformRows,
  getProductApp,
  getProductDomains,
  getProductHasThemes,
  getProductKind,
  getStatusLabel,
  getTypeLabel,
  getUntitledName,
  getWebDetailTab,
  getWebDetailTabs
} from '../utils'
import { BuilderThemeEditorView, BuilderWebThemes } from '../BuilderWebTheme'
import { BuilderWebSiteSettings } from '../BuilderWebSite'
import { BuilderAppGeneral } from './BuilderAppGeneral'
import { BuilderWebOverview } from './BuilderWebOverview'
import { BuilderChecksPanel } from './BuilderChecksPanel'
import { IncompleteDialog } from './IncompleteDialog'
import { NameRequiredDialog } from './NameRequiredDialog'
import './builder-detail.css'

// redesign B2: the detail of /builder/:productId on Product pieces: P/IconButton (open menu, rename), P/TextField (the
// rename), P/StatusBadge, P/Button, P/Menu («More actions», Archive disabled with its reason as its description), P/InlineNotice
// (the domain lock and the tab hints), P/Tabs (same ?tab=), P/ConfirmDialog, P/Skeleton and P/EmptyState. Same controller, states,
// texts, toasts, URL and focus moves as main. The header is not P/PageHeader: the rename replaces the h1 in place while the status
// actions and the lock hint stay beside it, which PageHeader's slots don't allow.

// The family of each product status, as in the list (BuilderProductsList)
const STATUS_FAMILIES = { draft: 'pending', active: 'done', archived: 'cancel' }

/** The `tab` of the URL as it is: an app and a website have different tabs. */
const readTab = () => {
  if (typeof window === 'undefined') return 'general'
  return new URLSearchParams(window.location.search).get('tab') || 'general'
}

/** The theme being edited, and what its editor has open (ThemeEditor): they go when it closes. */
const THEME_PARAMS = ['theme', 'section', 'item']

/** The theme being edited, from `?theme=`. */
const readThemeId = () => {
  if (typeof window === 'undefined') return null
  const value = Number(new URLSearchParams(window.location.search).get('theme'))
  return Number.isInteger(value) && value > 0 ? value : null
}

const BuilderProductDetailUI = (props) => {
  const {
    productState,
    reloadProduct,
    statusState,
    changeStatus,
    checksState,
    checksEnabled,
    reloadChecks,
    onAppChanged,
    renameProduct,
    mergeProduct,
    updateApp,
    updatePlatform,
    failPage,
    latestBuildsState,
    reloadLatestBuilds,
    buildAttemptsState,
    reloadBuildAttempts,
    buildsHistoryVersion,
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
    createInstallLink,
    buildGuides
  } = props

  const [, t] = useLanguage()
  const [events] = useEvent()
  const [{ parseDate }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [, { showToast }] = useToast()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [rawTab, setTab] = useState(readTab)
  const [editingThemeId, setEditingThemeId] = useState(readThemeId)
  const [focusGroup, setFocusGroup] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const [incompleteChecks, setIncompleteChecks] = useState(null)
  const [nameRequiredOpen, setNameRequiredOpen] = useState(false)
  const [renameHint, setRenameHint] = useState(false)
  const [focusDomains, setFocusDomains] = useState(false)

  const { loading, product, errorKind } = productState
  const app = getProductApp(product)
  const isWeb = !!product && getProductKind(product) === 'web'
  // The Theme tab follows `has_themes`, not the kind: a website, or an app like the Marketplace App
  const hasThemes = !!product && getProductHasThemes(product)
  const webTabItems = getWebDetailTabs(hasThemes)
  const appTabItems = getAppDetailTabs(hasThemes)
  const tab = isWeb ? getWebDetailTab(rawTab, webTabItems) : getDetailTab(rawTab, appTabItems)
  const editingTheme = hasThemes && tab === 'theme' && editingThemeId
  const kind = isWeb ? 'web' : 'app'
  const nameMaxLength = getNameMaxLength(kind)
  // Only a website classified by hand can come without a name
  const displayName = product?.name?.trim() ? product.name : getUntitledName(kind, t)
  const platformRows = getPlatformRows(app)
  const platformOrder = platformRows.map(row => row.platform)
  // A website at its own domain can't go to draft or be archived until the domain is removed (product.domain_configured)
  const ownDomain = isWeb ? getOwnDomain(product) : null
  const statusLockMessage = t('BUILDER_STATUS_DOMAIN_LOCK', 'A website with its own domain can’t be moved to draft or archived. Remove the domain first.')

  const goToTab = (next, group = null) => {
    setTab(next)
    setFocusGroup(next === 'files' ? group : null)
    setEditingThemeId(null)
    if (next === 'general') removeQueryToUrl(['tab', ...THEME_PARAMS])
    else {
      removeQueryToUrl(THEME_PARAMS)
      addQueryToUrl({ tab: next })
    }
  }

  /** The Domains card of the General tab, where the own domain is removed. */
  const goToDomains = () => {
    if (tab !== 'general') goToTab('general')
    setFocusDomains(true)
  }

  useEffect(() => {
    if (!focusDomains || tab !== 'general') return
    setFocusDomains(false)
    const heading = document.getElementById('builder-web-domains')
    if (!heading) return
    heading.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    heading.focus({ preventScroll: true })
  }, [focusDomains, tab])

  /** What the Domains card read of the own domain, so the status actions follow it. */
  const handleOwnDomainChange = (name) => {
    if ((ownDomain ?? null) !== name) mergeProduct({ domain: name })
  }

  const editTheme = (themeId) => {
    setEditingThemeId(themeId)
    removeQueryToUrl(THEME_PARAMS)
    addQueryToUrl({ tab: 'theme', theme: themeId })
  }

  const closeThemeEditor = () => {
    setEditingThemeId(null)
    removeQueryToUrl(THEME_PARAMS)
  }

  const formatDate = (value, format = 'MMM D, YYYY') => value ? parseDate(value, { outputFormat: format }) : ''

  const buildActions = useBuildActions({
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
    createInstallLink,
    latestPlatforms: latestBuildsState?.platforms,
    productStatus: product?.product_status,
    versions: Object.fromEntries(platformRows.map(row => [row.platform, row.version])),
    checkProblems: checksState?.checks ? getCheckProblems(checksState.checks, t) : null,
    guides: buildGuides,
    formatDate,
    onGoToTab: goToTab
  })

  /** `fromActivate`: opened from the name required dialog, so it says what comes next. */
  const startRename = (fromActivate = false) => {
    setNameDraft(product.name || '')
    setNameError(null)
    setRenameHint(fromActivate)
    setRenaming(true)
  }

  // redesign B2: P/Dialog gives the focus back to its opener once it has closed (a microtask after it unmounts); opened
  // from «Add a name» of the name required dialog, the rename takes it after that, as main's field did with autoFocus
  const renameInputRef = useRef(null)
  useEffect(() => {
    if (!renaming || !renameHint) return
    const timer = setTimeout(() => renameInputRef.current?.focus())
    return () => clearTimeout(timer)
  }, [renaming, renameHint])

  const stopRename = () => {
    setRenaming(false)
    setRenameHint(false)
  }

  const handleRename = async (e) => {
    e.preventDefault()
    const name = nameDraft.trim()
    if (!name) {
      setNameError(getAppFieldError('name', ['name.required'], t))
      return
    }
    if (name.length > nameMaxLength) {
      setNameError(getNameTooLongMessage(kind, t))
      return
    }
    if (name === product.name) {
      stopRename()
      return
    }
    setRenameSaving(true)
    const { ok, errorCodes } = await renameProduct(name)
    setRenameSaving(false)
    if (ok) {
      stopRename()
      showToast(ToastType.Success, t('BUILDER_RENAMED', 'Renamed to _name_').replace('_name_', name))
      return
    }
    setNameError(errorCodes.includes('name.max')
      ? getNameTooLongMessage(kind, t)
      : getAppFieldError('name', errorCodes, t) || t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.'))
  }

  const tabHints = {
    general: t('BUILDER_HINT_GENERAL', 'Changes to the app apply on the next build. The name in Ordering changes right away.'),
    theme: t('BUILDER_HINT_APP_THEME', 'How your app looks, with no build. Your customers see the active theme the next time they open the app; changes reach them after you publish.'),
    appearance: t('BUILDER_HINT_APPEARANCE', 'Colors apply on the next build.'),
    files: t('BUILDER_HINT_FILES', 'Files apply on the next build. Each one is checked against its format and size.'),
    constants: t('BUILDER_HINT_CONSTANTS', 'Constants apply on the next build.'),
    credentials: t('BUILDER_HINT_CREDENTIALS', 'Used to sign the app on the next build. Passwords and files are never shown again after you save them.'),
    push: t('BUILDER_HINT_PUSH', 'Applies right away, without a build. Use the account of the Firebase project this app uses.'),
    builds: t('BUILDER_HINT_BUILDS', 'Retrying uses the settings of that attempt. To include newer changes, start a new build.')
  }

  const tabProps = {
    productId: product?.id,
    appId: app?.id,
    onChanged: onAppChanged,
    onPageFailure: failPage
  }

  const goToList = (e) => {
    e?.preventDefault()
    events.emit('go_to_page', { page: 'builder' })
  }

  // Leaving the theme editor from the breadcrumb asks first while it has changes not saved
  const [themeUnsaved, setThemeUnsaved] = useState(false)
  const [leaveTo, setLeaveTo] = useState(null)
  const leaveThemeTo = (go) => (e) => {
    e?.preventDefault()
    if (themeUnsaved) setLeaveTo(() => go)
    else go()
  }
  const goToSite = () => goToTab('general')

  const handleChangeStatus = async (nextStatus) => {
    if (statusState?.loading) return
    setArchiveOpen(false)
    const { product: updated, errorKind: failure, checks, missing } = await changeStatus(nextStatus)
    if (updated) {
      const messages = {
        active: t('BUILDER_TOAST_ACTIVATED', '_name_ is active'),
        draft: t('BUILDER_TOAST_MOVED_TO_DRAFT', '_name_ is back to draft'),
        archived: t('BUILDER_TOAST_ARCHIVED', '_name_ was archived')
      }
      showToast(ToastType.Success, messages[nextStatus].replace('_name_', displayName))
      return
    }
    if (failure === 'incomplete' && isWeb) {
      // A website has no apps to check: only what it misses itself
      if ((missing || []).includes('name')) setNameRequiredOpen(true)
      else showToast(ToastType.Error, t('BUILDER_TOAST_INCOMPLETE', 'Complete the product before activating it.'))
      return
    }
    if (failure === 'incomplete') {
      setIncompleteChecks(checks)
      return
    }
    if (failure === 'domain_configured') {
      showToast(ToastType.Error, statusLockMessage)
      return
    }
    if (failure === 'error') {
      showToast(ToastType.Error, t('BUILDER_TOAST_STATUS_ERROR', 'Couldn’t change the status. Try again.'))
    }
  }

  const renderStatusActions = () => {
    const status = product.product_status
    const busy = !!statusState?.loading
    const lockHintId = ownDomain ? 'builder-status-lock-hint' : undefined
    const activate = (
      <Button key='activate' variant='primary' disabled={busy} onClick={() => handleChangeStatus('active')}>
        {t('BUILDER_ACTIVATE', 'Activate')}
      </Button>
    )
    const moveToDraft = (
      <Button key='draft' disabled={busy || !!ownDomain} aria-describedby={lockHintId} onClick={() => handleChangeStatus('draft')}>
        {t('BUILDER_MOVE_TO_DRAFT', 'Move to draft')}
      </Button>
    )
    return (
      <div className='odc-bd-status'>
        <div className='odc-bd-actions'>
          {status !== 'archived' && (
            <Menu
              label={t('BUILDER_MORE_ACTIONS', 'More actions')}
              icon={Ellipsis}
              triggerProps={{ disabled: busy }}
              items={[{
                key: 'archive',
                label: t('BUILDER_ARCHIVE', 'Archive'),
                disabled: !!ownDomain,
                // The reason of the disabled item is its description (aria-describedby), as main's pointed to the lock hint
                description: ownDomain ? statusLockMessage : undefined,
                onSelect: () => setArchiveOpen(true)
              }]}
            />
          )}
          {status === 'active' && moveToDraft}
          {status === 'archived' && moveToDraft}
          {status !== 'active' && activate}
        </div>
        {ownDomain && (
          <InlineNotice
            id={lockHintId}
            tone='info'
            icon={Info}
            live={false}
            action={<Button variant='link' size='sm' onClick={goToDomains}>{t('BUILDER_GO_TO_DOMAINS', 'Go to Domains')}</Button>}
          >
            {statusLockMessage}
          </InlineNotice>
        )}
      </div>
    )
  }

  const renderState = () => {
    if (errorKind === 'not_found') {
      return (
        <EmptyState
          icon={Phone}
          titleAs='h2'
          title={t('BUILDER_APP_NOT_FOUND', 'This app doesn’t exist')}
          description={t('BUILDER_APP_NOT_FOUND_HELP', 'It may have been deleted, or it belongs to another project.')}
          action={<Button variant='primary' onClick={goToList}>{t('BUILDER_BACK', 'Back to Builder')}</Button>}
        />
      )
    }
    if (errorKind === 'disabled' || errorKind === 'no_access') {
      return (
        <EmptyState
          icon={LockKeyhole}
          titleAs='h2'
          title={errorKind === 'disabled'
            ? t('BUILDER_DISABLED', 'Builder isn’t available here')
            : t('BUILDER_NO_ACCESS', 'You don’t have access to Builder')}
          description={errorKind === 'disabled'
            ? t('BUILDER_DISABLED_HELP', 'Builder is turned off for this installation.')
            : t('BUILDER_NO_ACCESS_HELP', 'Only admins with edit permissions can create and manage apps. Ask a project owner for access.')}
        />
      )
    }
    return (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        title={t('BUILDER_APP_LOAD_ERROR', 'We couldn’t load this app')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={reloadProduct}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
    )
  }

  const webTabs = webTabItems.map(item => ({ value: item.value, label: item.label(t) }))
  const appTabs = appTabItems.map(item => ({ value: item.value, label: item.label(t) }))

  return (
    <div className='odc-root odc-bd-page'>
      <div className='odc-bd-crumbs'>
        {isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        <nav className='odc-bd-breadcrumb' aria-label={t('BREADCRUMB', 'Breadcrumb')}>
          <a href='/builder' onClick={editingTheme ? leaveThemeTo(goToList) : goToList}>{t('BUILDER', 'Builder')}</a>
          <span aria-hidden='true'>/</span>
          {editingTheme
            ? (
              <>
                <a href={`/builder/${product.id}`} onClick={leaveThemeTo(goToSite)}>{displayName}</a>
                <span aria-hidden='true'>/</span>
                <span aria-current='page'>{t('BUILDER_TAB_THEME', 'Theme')}</span>
              </>
              )
            : <span aria-current='page'>{product ? displayName : t('BUILDER_APP', 'App')}</span>}
        </nav>
      </div>

      {product && !errorKind && editingTheme && (
        <BuilderThemeEditorView product={product} themeId={editingThemeId} onBack={closeThemeEditor} onPageFailure={failPage} onUnsavedChange={setThemeUnsaved} />
      )}

      {!(product && !errorKind && editingTheme) && (
        <div className='odc-bd-content'>
          {loading && !product && (
            <div className='odc-bd-busy' aria-busy='true'>
              <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
              <Skeleton size='40%' block='var(--od-space-6)' />
              <Skeleton shape='box' block='var(--od-space-10)' />
              <Skeleton shape='box' block='calc(var(--od-space-10) + var(--od-space-7))' />
            </div>
          )}

          {!loading && errorKind && renderState()}

          {product && !errorKind && (
            <>
              <div className='odc-bd-top'>
                <div className='odc-bd-head'>
                  {renaming
                    ? (
                      <form className='odc-bd-rename' onSubmit={handleRename} noValidate>
                        <TextField
                          ref={renameInputRef}
                          id='builder-product-name'
                          aria-label={t('BUILDER_NAME_IN_ORDERING', 'Name in Ordering')}
                          value={nameDraft}
                          maxLength={nameMaxLength}
                          autoComplete='off'
                          autoFocus
                          error={nameError || undefined}
                          hint={!nameError && renameHint ? t('BUILDER_RENAME_THEN_ACTIVATE', 'Then activate the website again.') : undefined}
                          onChange={(value) => { setNameDraft(value); setNameError(null) }}
                          onKeyDown={(e) => { if (e.key === 'Escape') stopRename() }}
                        />
                        <Button type='submit' variant='primary' disabled={renameSaving}>
                          {renameSaving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
                        </Button>
                        <Button onClick={stopRename}>
                          {t('CANCEL', 'Cancel')}
                        </Button>
                      </form>
                      )
                    : (
                      <div className='odc-bd-title'>
                        <h1>{product.name?.trim() ? product.name : <em>{displayName}</em>}</h1>
                        <IconButton icon={Pencil} label={t('BUILDER_RENAME', 'Rename')} onClick={() => startRename()} />
                        <StatusBadge family={STATUS_FAMILIES[product.product_status] || 'cancel'} label={getStatusLabel(product.product_status, t)} />
                      </div>
                      )}
                  <p className='odc-bd-meta'>
                    {[
                      getTypeLabel(product.product_type, t),
                      product.code && t('BUILDER_CODE', 'Code _code_').replace('_code_', product.code),
                      product.created_at && t('BUILDER_CREATED_ON', 'Created _date_').replace('_date_', formatDate(product.created_at))
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {renderStatusActions()}
              </div>

              {isWeb && (
                <Tabs label={t('BUILDER_WEB_SECTIONS', 'Website sections')} value={tab} onValueChange={(next) => goToTab(next)} items={webTabs}>
                  <TabPanel value={tab} className='odc-bd-panel'>
                    {tab === 'general' && <BuilderWebOverview product={product} onPageFailure={failPage} onOwnDomainChange={handleOwnDomainChange} />}
                    {tab === 'site' && <BuilderWebSiteSettings product={product} onPageFailure={failPage} onProductChange={mergeProduct} onGoToTheme={() => goToTab('theme')} />}
                    {tab === 'theme' && (
                      <>
                        <InlineNotice tone='info' icon={Info} live={false}>
                          {t('BUILDER_HINT_THEME', 'How your website looks. Your customers see the active theme; changes reach them after you publish.')}
                        </InlineNotice>
                        <BuilderWebThemes product={product} onPageFailure={failPage} onEditTheme={editTheme} />
                      </>
                    )}
                  </TabPanel>
                </Tabs>
              )}

              {!app && !isWeb && (
                <EmptyState icon={Phone} titleAs='h2' title={t('BUILDER_NO_APP', 'This product has no app')} />
              )}

              {app && (
                <>
                  <BuilderBuildsCard
                    latestState={latestBuildsState || { loading: true, platforms: null, error: false }}
                    reloadLatest={reloadLatestBuilds}
                    attemptsState={buildAttemptsState}
                    reloadAttempts={reloadBuildAttempts}
                    platformOrder={platformOrder}
                    productStatus={product.product_status}
                    actions={buildActions}
                    guides={buildGuides}
                    formatDate={formatDate}
                    onSeeAll={() => goToTab('builds')}
                    onChangeStatus={handleChangeStatus}
                    statusBusy={!!statusState?.loading}
                  />

                  {checksEnabled && (
                    <BuilderChecksPanel checksState={checksState} reloadChecks={reloadChecks} onGoToTab={goToTab} />
                  )}

                  <Tabs label={t('BUILDER_APP_SECTIONS', 'App sections')} value={tab} onValueChange={(next) => goToTab(next)} items={appTabs}>
                    <TabPanel value={tab} className='odc-bd-panel'>
                      <InlineNotice tone='info' icon={Info} live={false}>{tabHints[tab]}</InlineNotice>
                      {tab === 'general' && (
                        <BuilderAppGeneral app={app} updateApp={updateApp} updatePlatform={updatePlatform} />
                      )}
                      {tab === 'theme' && <BuilderWebThemes product={product} onPageFailure={failPage} onEditTheme={editTheme} />}
                      {tab === 'appearance' && <BuilderAppColors {...tabProps} />}
                      {tab === 'files' && <BuilderAppFiles {...tabProps} focusGroup={focusGroup} />}
                      {tab === 'constants' && <BuilderAppConstantsList {...tabProps} />}
                      {tab === 'credentials' && <BuilderAppCredentialsForm {...tabProps} guides={buildGuides} />}
                      {tab === 'push' && (
                        <BuilderProductPushSettings productId={product.id} productName={product.name} onPageFailure={failPage} />
                      )}
                      {tab === 'builds' && (
                        <BuilderAppBuildsHistory
                          productId={product.id}
                          appId={app.id}
                          version={buildsHistoryVersion}
                          onPageFailure={failPage}
                          platformOrder={platformOrder}
                          productStatus={product.product_status}
                          actions={buildActions}
                          formatDate={formatDate}
                        />
                      )}
                    </TabPanel>
                  </Tabs>
                </>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={archiveOpen}
        tone='primary'
        title={t('BUILDER_ARCHIVE_TITLE', 'Archive _name_?').replace('_name_', displayName)}
        confirmLabel={t('BUILDER_ARCHIVE', 'Archive')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => handleChangeStatus('archived')}
        onCancel={() => setArchiveOpen(false)}
      >
        <p>
          {isWeb
            ? t('BUILDER_ARCHIVE_HELP_WEB', 'For now this only labels the website as archived. It stays online at _domain_; you can bring it back at any time.')
              .replace('_domain_', getProductDomains(product)[0]?.domain || '')
            : t('BUILDER_ARCHIVE_HELP_BUILDS', 'Archived apps can’t build from here. Installed apps keep working, and you can bring it back at any time.')}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!leaveTo}
        title={t('BUILDER_THEME_LEAVE_TITLE', 'Leave without saving?')}
        confirmLabel={t('BUILDER_THEME_LEAVE', 'Leave')}
        cancelLabel={t('BUILDER_THEME_STAY', 'Stay')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => { const go = leaveTo; setLeaveTo(null); setThemeUnsaved(false); go() }}
        onCancel={() => setLeaveTo(null)}
      >
        <p>{t('BUILDER_THEME_LEAVE_HELP', 'You have changes you haven’t saved. They’ll be lost.')}</p>
      </ConfirmDialog>

      {buildActions.dialogs}

      {nameRequiredOpen && (
        <NameRequiredDialog
          onClose={() => setNameRequiredOpen(false)}
          onAddName={() => { setNameRequiredOpen(false); startRename(true) }}
        />
      )}

      {incompleteChecks && (
        <IncompleteDialog product={product} checks={incompleteChecks} onClose={() => setIncompleteChecks(null)} onGoToTab={goToTab} />
      )}
    </div>
  )
}

export const BuilderProduct = (props) => {
  const detailProps = {
    ...props,
    UIComponent: BuilderProductDetailUI
  }
  return <BuilderProductDetailController {...detailProps} />
}
