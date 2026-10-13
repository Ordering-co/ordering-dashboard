import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Dropdown } from 'react-bootstrap'
import { ExclamationCircle, InfoCircle, List as MenuIcon, Lock, PencilSquare, Phone, ThreeDots } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'

import {
  BuilderProductDetail as BuilderProductDetailController,
  ToastType,
  useEvent,
  useLanguage,
  useToast,
  useUtils
} from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, IconButton, Input } from '../../../styles'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { Confirm } from '../../Shared'
import { BuilderAppColors, BuilderAppFiles } from '../BuilderAppSettings'
import { BuilderAppConstantsList } from '../BuilderAppConstants'
import { BuilderAppCredentialsForm } from '../BuilderAppCredentials'
import { BuilderAppBuildsHistory, BuilderBuildsCard, useBuildActions } from '../BuilderAppBuilds'
import { BuilderProductPushSettings } from '../BuilderProductPush'
import { BuilderMessage } from '../BuilderShared'
import {
  BUILDER_DETAIL_TABS,
  getAppFieldError,
  getCheckProblems,
  getDetailTab,
  getNameMaxLength,
  getNameTooLongMessage,
  getPlatformRows,
  getProductApp,
  getProductDomains,
  getProductKind,
  getStatusLabel,
  getTypeLabel,
  getUntitledName
} from '../utils'
import { BuilderAppGeneral } from './BuilderAppGeneral'
import { BuilderWebOverview } from './BuilderWebOverview'
import { BuilderChecksPanel } from './BuilderChecksPanel'
import { IncompleteDialog } from './IncompleteDialog'
import { NameRequiredDialog } from './NameRequiredDialog'
import {
  Breadcrumb,
  DetailHeader,
  DetailTop,
  FieldHelp,
  HeaderActions,
  HeaderTitle,
  MoreToggle,
  PageContainer,
  Pill,
  RenameButton,
  RenameForm,
  TabButton,
  TabHint,
  TabList
} from '../styles'

const readTab = () => {
  if (typeof window === 'undefined') return 'general'
  return getDetailTab(new URLSearchParams(window.location.search).get('tab'))
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
    updateApp,
    updatePlatform,
    failPage,
    latestBuildsState,
    reloadLatestBuilds,
    buildsHistoryVersion,
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
    adHocInstallUrl,
    buildGuides
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const [{ parseDate }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [, { showToast }] = useToast()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [tab, setTab] = useState(readTab)
  const [focusGroup, setFocusGroup] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const [incompleteChecks, setIncompleteChecks] = useState(null)
  const [nameRequiredOpen, setNameRequiredOpen] = useState(false)
  const [renameHint, setRenameHint] = useState(false)

  const { loading, product, errorKind } = productState
  const app = getProductApp(product)
  const isWeb = !!product && getProductKind(product) === 'web'
  const kind = isWeb ? 'web' : 'app'
  const nameMaxLength = getNameMaxLength(kind)
  // Only a website classified by hand can come without a name
  const displayName = product?.name?.trim() ? product.name : getUntitledName(kind, t)
  const platformRows = getPlatformRows(app)
  const platformOrder = platformRows.map(row => row.platform)

  const goToTab = (next, group = null) => {
    setTab(next)
    setFocusGroup(next === 'files' ? group : null)
    if (next === 'general') removeQueryToUrl(['tab'])
    else addQueryToUrl({ tab: next })
  }

  const formatDate = (value, format = 'MMM D, YYYY') => value ? parseDate(value, { outputFormat: format }) : ''

  const buildActions = useBuildActions({
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
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
    if (failure === 'error') {
      showToast(ToastType.Error, t('BUILDER_TOAST_STATUS_ERROR', 'Couldn’t change the status. Try again.'))
    }
  }

  const renderStatusActions = () => {
    const status = product.product_status
    const busy = !!statusState?.loading
    const activate = (
      <Button key='activate' color='primary' borderRadius='8px' disabled={busy} onClick={() => handleChangeStatus('active')}>
        {t('BUILDER_ACTIVATE', 'Activate')}
      </Button>
    )
    const moveToDraft = (
      <Button key='draft' color='primary' outline borderRadius='8px' disabled={busy} onClick={() => handleChangeStatus('draft')}>
        {t('BUILDER_MOVE_TO_DRAFT', 'Move to draft')}
      </Button>
    )
    return (
      <HeaderActions>
        {status !== 'archived' && (
          <Dropdown>
            <Dropdown.Toggle as={MoreToggle} id='builder-status-more' aria-label={t('BUILDER_MORE_ACTIONS', 'More actions')} disabled={busy}>
              <ThreeDots aria-hidden='true' />
            </Dropdown.Toggle>
            <Dropdown.Menu align={theme?.rtl ? 'left' : 'right'}>
              <Dropdown.Item as='button' onClick={() => setArchiveOpen(true)}>
                {t('BUILDER_ARCHIVE', 'Archive')}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}
        {status === 'active' && moveToDraft}
        {status === 'archived' && moveToDraft}
        {status !== 'active' && activate}
      </HeaderActions>
    )
  }

  const renderState = () => {
    if (errorKind === 'not_found') {
      return (
        <BuilderMessage
          icon={<Phone aria-hidden='true' />}
          title={t('BUILDER_APP_NOT_FOUND', 'This app doesn’t exist')}
          text={t('BUILDER_APP_NOT_FOUND_HELP', 'It may have been deleted, or it belongs to another project.')}
        >
          <Button color='primary' borderRadius='8px' onClick={goToList}>{t('BUILDER_BACK', 'Back to Builder')}</Button>
        </BuilderMessage>
      )
    }
    if (errorKind === 'disabled' || errorKind === 'no_access') {
      return (
        <BuilderMessage
          icon={<Lock aria-hidden='true' />}
          title={errorKind === 'disabled'
            ? t('BUILDER_DISABLED', 'Builder isn’t available here')
            : t('BUILDER_NO_ACCESS', 'You don’t have access to Builder')}
          text={errorKind === 'disabled'
            ? t('BUILDER_DISABLED_HELP', 'Builder is turned off for this installation.')
            : t('BUILDER_NO_ACCESS_HELP', 'Only admins with edit permissions can create and manage apps. Ask a project owner for access.')}
        />
      )
    }
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_APP_LOAD_ERROR', 'We couldn’t load this app')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={reloadProduct}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }

  return (
    <PageContainer>
      <HeaderTitle>
        {isCollapse && (
          <IconButton color='black' aria-label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)}>
            <MenuIcon />
          </IconButton>
        )}
        <Breadcrumb aria-label={t('BREADCRUMB', 'Breadcrumb')}>
          <a href='/builder' onClick={goToList}>{t('BUILDER', 'Builder')}</a>
          <span aria-hidden='true'>/</span>
          <span aria-current='page'>{product ? displayName : t('BUILDER_APP', 'App')}</span>
        </Breadcrumb>
      </HeaderTitle>

      {loading && !product && (
        <div aria-busy='true'>
          <Skeleton height={32} width={280} />
          <Skeleton height={140} style={{ marginTop: 20 }} />
          <Skeleton height={180} style={{ marginTop: 20 }} />
        </div>
      )}

      {!loading && errorKind && renderState()}

      {product && !errorKind && (
        <>
          <DetailTop>
            <DetailHeader>
              {renaming
                ? (
                  <RenameForm onSubmit={handleRename} noValidate>
                    <label htmlFor='builder-product-name' className='sr-only'>{t('BUILDER_NAME_IN_ORDERING', 'Name in Ordering')}</label>
                    <div>
                      <Input
                        id='builder-product-name'
                        type='text'
                        value={nameDraft}
                        maxLength={nameMaxLength}
                        autoComplete='off'
                        autoFocus
                        aria-invalid={nameError ? 'true' : 'false'}
                        aria-describedby={nameError ? 'builder-product-name-error' : renameHint ? 'builder-product-name-hint' : undefined}
                        onChange={(e) => { setNameDraft(e.target.value); setNameError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Escape') stopRename() }}
                      />
                      {nameError && (
                        <FieldHelp><span id='builder-product-name-error' role='alert'>{nameError}</span></FieldHelp>
                      )}
                      {!nameError && renameHint && (
                        <FieldHelp><span id='builder-product-name-hint'>{t('BUILDER_RENAME_THEN_ACTIVATE', 'Then activate the website again.')}</span></FieldHelp>
                      )}
                    </div>
                    <Button type='submit' color='primary' borderRadius='8px' disabled={renameSaving}>
                      {renameSaving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
                    </Button>
                    <Button type='button' color='secundary' borderRadius='8px' onClick={stopRename}>
                      {t('CANCEL', 'Cancel')}
                    </Button>
                  </RenameForm>
                  )
                : (
                  <div>
                    <h1>{product.name?.trim() ? product.name : <em>{displayName}</em>}</h1>
                    <RenameButton type='button' aria-label={t('BUILDER_RENAME', 'Rename')} title={t('BUILDER_RENAME', 'Rename')} onClick={() => startRename()}>
                      <PencilSquare aria-hidden='true' />
                    </RenameButton>
                    <Pill status={product.product_status}>{getStatusLabel(product.product_status, t)}</Pill>
                  </div>
                  )}
              <p>
                {[
                  getTypeLabel(product.product_type, t),
                  product.code && t('BUILDER_CODE', 'Code _code_').replace('_code_', product.code),
                  product.created_at && t('BUILDER_CREATED_ON', 'Created _date_').replace('_date_', formatDate(product.created_at))
                ].filter(Boolean).join(' · ')}
              </p>
            </DetailHeader>
            {renderStatusActions()}
          </DetailTop>

          {isWeb && <BuilderWebOverview product={product} onPageFailure={failPage} />}

          {!app && !isWeb && (
            <BuilderMessage
              icon={<Phone aria-hidden='true' />}
              title={t('BUILDER_NO_APP', 'This product has no app')}
            />
          )}

          {app && (
            <>
              <BuilderBuildsCard
                latestState={latestBuildsState || { loading: true, platforms: null, error: false }}
                reloadLatest={reloadLatestBuilds}
                platformOrder={platformOrder}
                productStatus={product.product_status}
                actions={buildActions}
                installUrl={adHocInstallUrl}
                guides={buildGuides}
                formatDate={formatDate}
                onSeeAll={() => goToTab('builds')}
                onChangeStatus={handleChangeStatus}
                statusBusy={!!statusState?.loading}
              />

              {checksEnabled && (
                <BuilderChecksPanel checksState={checksState} reloadChecks={reloadChecks} onGoToTab={goToTab} />
              )}

              <TabList role='tablist' aria-label={t('BUILDER_APP_SECTIONS', 'App sections')}>
                {BUILDER_DETAIL_TABS.map(item => (
                  <TabButton
                    key={item.value}
                    type='button'
                    role='tab'
                    id={`builder-tab-${item.value}`}
                    aria-selected={tab === item.value ? 'true' : 'false'}
                    aria-controls='builder-tab-panel'
                    selected={tab === item.value}
                    onClick={() => goToTab(item.value)}
                  >
                    {item.label(t)}
                  </TabButton>
                ))}
              </TabList>

              <div role='tabpanel' id='builder-tab-panel' aria-labelledby={`builder-tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <TabHint>
                  <InfoCircle aria-hidden='true' />
                  {tabHints[tab]}
                </TabHint>
                {tab === 'general' && (
                  <BuilderAppGeneral app={app} updateApp={updateApp} updatePlatform={updatePlatform} />
                )}
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
              </div>
            </>
          )}
        </>
      )}

      <Confirm
        open={archiveOpen}
        width='min(440px, calc(100vw - 72px))'
        title={t('BUILDER_ARCHIVE_TITLE', 'Archive _name_?').replace('_name_', displayName)}
        acceptText={t('BUILDER_ARCHIVE', 'Archive')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={() => handleChangeStatus('archived')}
        onCancel={() => setArchiveOpen(false)}
        onClose={() => setArchiveOpen(false)}
      >
        <p>
          {isWeb
            ? t('BUILDER_ARCHIVE_HELP_WEB', 'For now this only labels the website as archived. It stays online at _domain_; you can bring it back at any time.')
              .replace('_domain_', getProductDomains(product)[0]?.domain || '')
            : t('BUILDER_ARCHIVE_HELP_BUILDS', 'Archived apps can’t build from here. Installed apps keep working, and you can bring it back at any time.')}
        </p>
      </Confirm>

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
    </PageContainer>
  )
}

export const BuilderProduct = (props) => {
  const detailProps = {
    ...props,
    UIComponent: BuilderProductDetailUI
  }
  return <BuilderProductDetailController {...detailProps} />
}
