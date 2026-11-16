import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, SitesAuthSettings as SitesAuthSettingsController } from '../../../../../index'
import { Alert } from '../../Shared'
import { ConfirmDialog, IconButton, SelectField, Skeleton } from '../../Shared/Product'
import { Maximize2, Minimize2 } from '../../Shared/Icon'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useSettingsHubForm } from '../SettingsHubForm/SettingsHubFormContext' // n.1 (D-56 a)
import { useHubFormReport, useSavedNotice } from '../SettingsHubForm/useHubFormReport'
import { SettingsSaveBar } from '../SettingsHubForm/SettingsSaveBar'
import { SiteSettingDetails } from '../SiteSettingDetails'
import { useWindowSize } from '../../../hooks/useWindowSize'
import './sites-auth-settings.css'

// n.1 (D-56 a): memoized so a pending change (the screen's own state) does not re-render the fields. A re-render would
// rebuild the options of every select from the stored value and snap a freshly picked option back to it.
const SiteSettingDetailsMemo = React.memo(SiteSettingDetails)

// the stored value and a typed or picked one are the same field value when they read the same (a select gives text, the API may give a number)
const sameValue = (a, b) => String(a ?? '') === String(b ?? '')

// review r1 (R-1): the configs the detail draws, with the pending values over the stored ones. When the controller's configs change
// (a load, or the values a save stored) the memoized detail draws again and its selects rebuild from what they are given: without
// this, a select that was not stored went back to the stored value while the bar still counted it.
const withPending = (configs, pending) => (configs || []).map(config => (
  Object.prototype.hasOwnProperty.call(pending, config?.id) ? { ...config, value: pending[config.id] } : config
))

// the text of an error of the API, whatever shape it comes in (a list of messages, a message, an Error)
const getApiErrorMessage = (result, t) => {
  if (Array.isArray(result)) return result.map(item => translateApiMessage(t, item, '')).filter(Boolean).join(' ')
  if (typeof result === 'string') return translateApiMessage(t, result, '')
  if (result && typeof result.message === 'string') return translateApiMessage(t, result.message, '')
  return ''
}

const SitesAuthSettingsUI = (props) => {
  const {
    sitesState,
    actionState,
    siteConfigsState,
    siteGroupConfigsState,
    handleGetSiteConfigs,
    handleChangeConfig,
    handleSaveConfigs,
    avoidExpand
  } = props

  const history = useHistory()
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()

  const [selectedSiteId, setSelectedSiteId] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isExpand, setIsExpand] = useState(false)

  // n.1 (D-56 a): inside the Settings hub the fields keep their changes here ({ configId: value }) and the shared save bar
  // stores them; outside the hub every change is saved at once, as before.
  const hubForm = useSettingsHubForm()
  const product = !!hubForm
  const [pending, setPending] = useState({})
  const [revision, setRevision] = useState(0)
  const [saveState, setSaveState] = useState({ saving: false, error: null, savedCount: 0, totalCount: 0, failedId: null })
  const [leaveTargetId, setLeaveTargetId] = useState(null)
  const formRef = useRef(null)
  const configsRef = useRef([])
  configsRef.current = siteConfigsState?.configs || []
  // computed when the controller's state or the revision changes, not on every keystroke (see withPending)
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const detailConfigsState = useMemo(
    () => ({ ...siteConfigsState, configs: withPending(siteConfigsState?.configs, pendingRef.current) }),
    [siteConfigsState, revision]
  )
  const detailGroupConfigsState = useMemo(
    () => ({
      ...siteGroupConfigsState,
      categories: (siteGroupConfigsState?.categories || []).map(category => ({ ...category, configs: withPending(category.configs, pendingRef.current) }))
    }),
    [siteGroupConfigsState, revision]
  )
  const selectedSiteRef = useRef(null)
  selectedSiteRef.current = selectedSiteId

  const handleFieldChange = useCallback((value, siteId, configId) => {
    const stored = configsRef.current.find(config => config?.id === configId)
    setPending(current => {
      const next = { ...current }
      if (stored && sameValue(stored.value, value)) delete next[configId]
      else next[configId] = value
      return next
    })
  }, [])

  // the Product select compares values as text and hands back the option's own value, so the numeric site id round-trips
  const siteOptions = useMemo(
    () => (sitesState?.sites || []).map(site => ({ value: site.id, label: site.name })),
    [sitesState?.sites]
  )

  // The changed fields in the order of the form, for the bar's count and names and for the save.
  const changedConfigs = product ? configsRef.current.filter(config => Object.prototype.hasOwnProperty.call(pending, config?.id)) : []
  const isDirty = changedConfigs.length > 0
  const saving = saveState.saving
  const selectedSiteName = sitesState?.sites?.find(site => site.id === selectedSiteId)?.name || ''

  const saved = useSavedNotice({ saving, succeeded: product && !saveState.error && !isDirty })
  useHubFormReport('sites', { dirty: isDirty, saving })

  let barError = null
  if (product && saveState.error && isDirty) {
    const failedConfig = saveState.failedId != null ? configsRef.current.find(config => config?.id === saveState.failedId) : null
    barError = saveState.savedCount > 0 && failedConfig
      ? { kind: 'partial', savedCount: saveState.savedCount, totalCount: saveState.totalCount, failedName: failedConfig.name, message: saveState.error.message }
      : { kind: 'api', message: saveState.error.message }
  }

  const resetPending = () => {
    setPending({})
    setRevision(current => current + 1)
    setSaveState({ saving: false, error: null, savedCount: 0, totalCount: 0, failedId: null })
  }

  const handleDiscard = () => {
    resetPending()
    // the buttons that had the focus are gone with the bar: keep the keyboard user inside the form
    formRef.current?.focus({ preventScroll: true })
  }

  const handleSave = async () => {
    if (saving || !isDirty || !handleSaveConfigs) return
    const changes = changedConfigs.map(config => ({ id: config.id, value: pending[config.id] }))
    setSaveState({ saving: true, error: null, savedCount: 0, totalCount: changes.length, failedId: null })
    const { savedCount, failedId, error } = await handleSaveConfigs(changes, selectedSiteId)
    const storedIds = changes.slice(0, savedCount).map(change => change.id)
    setPending(current => {
      const next = { ...current }
      storedIds.forEach(id => { delete next[id] })
      return next
    })
    setSaveState({
      saving: false,
      error: error ? { message: getApiErrorMessage(error, t) } : null,
      savedCount,
      totalCount: changes.length,
      failedId
    })
  }

  const handleOpenSiteSettingDetails = (siteId, isInitialRender) => {
    handleGetSiteConfigs(siteId)
    setSelectedSiteId(siteId)
    if (!isInitialRender) {
      const category = query.get('category')
      history.replace(`${location.pathname}?category=${category}&site=${siteId}`)
    }
  }

  // Inside the hub, leaving a site with unsaved changes asks first; the select is controlled, so it keeps showing the open site meanwhile.
  const requestOpenSite = (siteId) => {
    if (product && (isDirty || saving)) {
      if (saving || siteId === selectedSiteId) return
      setLeaveTargetId(siteId)
      return
    }
    handleOpenSiteSettingDetails(siteId)
  }

  const lastLeaveRef = useRef({ siteName: '' })
  if (leaveTargetId !== null) lastLeaveRef.current = { siteName: selectedSiteName }

  // review r1 (R-2): once the dialog has closed, the focus goes back to the site select's trigger instead of <body>
  const selectAreaRef = useRef(null)
  const [focusSelect, setFocusSelect] = useState(0)
  useEffect(() => {
    if (!focusSelect) return undefined
    const timer = setTimeout(() => selectAreaRef.current?.querySelector('button, [tabindex="0"]')?.focus())
    return () => clearTimeout(timer)
  }, [focusSelect])

  const handleKeepEditing = () => {
    setLeaveTargetId(null)
    setFocusSelect(current => current + 1)
  }

  const handleConfirmLeave = () => {
    const siteId = leaveTargetId
    setLeaveTargetId(null)
    resetPending()
    handleOpenSiteSettingDetails(siteId)
  }

  const expandSideBar = () => {
    const element = document.getElementById('sideSlider')
    if (isExpand) element.style.width = '500px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  useEffect(() => {
    if (actionState.error) {
      setAlertState({
        open: true,
        content: actionState.error
      })
    }
  }, [actionState.error])

  useEffect(() => {
    if (sitesState.loading) return
    const site = query.get('site')
    if (site) {
      handleOpenSiteSettingDetails(Number(site), true)
    }
  }, [sitesState.loading])

  return (
    <>
      <div className='sas'>
        {/* the hub prints the section title; only the side panel's expand button is left here */}
        {width > 576 && !selectedSiteId && !avoidExpand && (
          <div className='odc-root sas-header'>
            <IconButton
              icon={isExpand ? Minimize2 : Maximize2}
              label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
              onClick={expandSideBar}
            />
          </div>
        )}
        {sitesState.loading
          ? (
            <div className='odc-root sas-loading' aria-busy='true'>
              <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
              {[...Array(5).keys()].map(i => (
                <div key={i} className='sas-loading-row'>
                  <Skeleton size='40%' />
                </div>
              ))}
            </div>
            )
          : (
            <>
              <div ref={selectAreaRef} className='odc-root sas-site'>
                <SelectField
                  label={t('SITE', 'Site')}
                  value={selectedSiteId}
                  options={siteOptions}
                  onValueChange={requestOpenSite}
                  placeholder={t('SELECT_SITE', 'Select a site')}
                />
              </div>
              {selectedSiteId && siteOptions.find((option) => (option.value === selectedSiteId)) && (
                product
                  ? (
                    // inside the hub the form stays mounted while it saves (inert, aria-busy), so there is no skeleton
                    <div
                      ref={formRef}
                      className='odc-hub-form'
                      tabIndex={-1}
                      inert={saving ? '' : undefined}
                      aria-busy={saving ? 'true' : undefined}
                    >
                      <SiteSettingDetailsMemo
                        // SiteSettingDetails' SiteSelectControl takes its value when it mounts; this remount (new site, Save,
                        // Discard) is what shows the stored values again
                        key={`${selectedSiteId}:${revision}`}
                        selectedSiteId={selectedSiteId}
                        siteConfigsState={detailConfigsState}
                        siteGroupConfigsState={detailGroupConfigsState}
                        handleChangeConfig={handleFieldChange}
                      />
                    </div>
                    )
                  : (
                    <SiteSettingDetails
                      selectedSiteId={selectedSiteId}
                      siteConfigsState={siteConfigsState}
                      siteGroupConfigsState={siteGroupConfigsState}
                      handleChangeConfig={handleChangeConfig}
                    />
                    )
              )}
            </>
            )}
      </div>
      {product && (
        <>
          <SettingsSaveBar
            count={changedConfigs.length}
            names={changedConfigs.map(config => config.name)}
            saving={saving}
            error={barError}
            saved={saved}
            onDiscard={handleDiscard}
            onSave={handleSave}
          />
          <ConfirmDialog
            open={leaveTargetId !== null}
            title={t('SETTINGS_DISCARD_TITLE', 'Discard your changes?')}
            confirmLabel={t('DISCARD', 'Discard')}
            cancelLabel={t('KEEP_EDITING', 'Keep editing')}
            closeLabel={t('CLOSE', 'Close')}
            tone='danger'
            onConfirm={handleConfirmLeave}
            onCancel={handleKeepEditing}
          >
            {t('SETTINGS_DISCARD_DESCRIPTION', 'You have unsaved changes in _section_. If you leave, they are lost.')
              .replace('_section_', lastLeaveRef.current.siteName)}
          </ConfirmDialog>
        </>
      )}
      <Alert
        title={t('SETTINGS', 'Settings')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const SitesAuthSettings = (props) => {
  const sitesAuthSettinsProps = {
    ...props,
    UIComponent: SitesAuthSettingsUI
  }
  return <SitesAuthSettingsController {...sitesAuthSettinsProps} />
}
