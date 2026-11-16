import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, MultiCountrySettings as MultiCountrySettingsController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import BsChevronRight from '@meronex/icons/bs/BsChevronRight'
import { CountrySettingDetail } from '../CountrySettingDetail'
import { Alert, SideBar } from '../../Shared'
import { ConfirmDialog } from '../../Shared/Product'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useSettingsHubForm } from '../SettingsHubForm/SettingsHubFormContext' // n.1 (D-56 a)
import { useHubFormReport, useSavedNotice } from '../SettingsHubForm/useHubFormReport'
import { SettingsSaveBar } from '../SettingsHubForm/SettingsSaveBar'

import {
  SitesListContainer,
  SitesWrapper,
  SiteItem,
  HubFormColumn
} from './styles'

// n.1 (D-56 a): memoized so a pending change (the screen's own state) does not re-render the fields. A re-render would
// rebuild the options of every select from the stored value and snap a freshly picked option back to it.
const CountrySettingDetailMemo = React.memo(CountrySettingDetail)

// review r1 (R-1): the configs the detail draws, with the pending values over the stored ones. When the controller's configs change
// (a load, or the values a save stored) the memoized detail draws again and its selects rebuild from what they are given: without
// this, a select that was not stored went back to the stored value while the bar still counted it.
const withPending = (configs, pending) => (configs || []).map(config => (
  Object.prototype.hasOwnProperty.call(pending, config?.id) ? { ...config, value: pending[config.id] } : config
))

// the stored value and a typed or picked one are the same field value when they read the same (a select gives text, the API may give a number)
const sameValue = (a, b) => String(a ?? '') === String(b ?? '')

// the text of an error of the API, whatever shape it comes in (a list of messages, a message, an Error)
const getApiErrorMessage = (result, t) => {
  if (Array.isArray(result)) return result.map(item => translateApiMessage(t, item, '')).filter(Boolean).join(' ')
  if (typeof result === 'string') return translateApiMessage(t, result, '')
  if (result && typeof result.message === 'string') return translateApiMessage(t, result.message, '')
  return ''
}

const MultiCountrySettingsUI = (props) => {
  const {
    countryState,
    actionState,
    setMoveDistance,
    countryConfigState,
    handleGetContryConfigs,
    handleChangeConfig,
    handleSaveConfigs
  } = props

  const [, t] = useLanguage()
  const [selectedCountryId, setSelectedCountryId] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  // n.1 (D-56 a): inside the Settings hub the fields of the open country keep their changes here ({ configId: value })
  // and the shared save bar stores them; outside the hub every change is saved at once, as before.
  const hubForm = useSettingsHubForm()
  const product = !!hubForm
  const [pending, setPending] = useState({})
  const [revision, setRevision] = useState(0)
  const [saveState, setSaveState] = useState({ saving: false, error: null, savedCount: 0, totalCount: 0, failedId: null })
  // what the confirmation is about: { type: 'switch', countryId } or { type: 'close' }
  const [leaveTarget, setLeaveTarget] = useState(null)
  const formRef = useRef(null)
  const configsRef = useRef([])
  configsRef.current = countryConfigState?.configs || []
  // computed when the controller's state or the revision changes, not on every keystroke (see withPending)
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const detailConfigState = useMemo(
    () => ({ ...countryConfigState, configs: withPending(countryConfigState?.configs, pendingRef.current) }),
    [countryConfigState, revision]
  )

  const handleFieldChange = useCallback((value, countryId, configId) => {
    const stored = configsRef.current.find(config => config?.id === configId)
    setPending(current => {
      const next = { ...current }
      if (stored && sameValue(stored.value, value)) delete next[configId]
      else next[configId] = value
      return next
    })
  }, [])

  // The changed fields in the order of the form, for the bar's count and names and for the save.
  const changedConfigs = product ? configsRef.current.filter(config => Object.prototype.hasOwnProperty.call(pending, config?.id)) : []
  const isDirty = changedConfigs.length > 0
  const saving = saveState.saving
  const selectedCountryName = countryState?.countries?.find(country => country?.id === selectedCountryId)?.name || ''

  const saved = useSavedNotice({ saving, succeeded: product && !saveState.error && !isDirty })
  useHubFormReport('multi_country', { dirty: isDirty, saving })

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
    const { savedCount, failedId, error } = await handleSaveConfigs(changes, selectedCountryId)
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

  const handleOpenCountrySettingDetails = (countryId) => {
    handleGetContryConfigs(countryId)
    setSelectedCountryId(countryId)
    setMoveDistance && setMoveDistance(500)
  }

  const handleCloseDetails = () => {
    setSelectedCountryId(null)
    setMoveDistance && setMoveDistance(0)
  }

  // Inside the hub, leaving the open country (another country, or closing the side bar) with unsaved changes asks first.
  // While it saves, leaving is ignored. The side bar keeps the `onClose` of the render where it opened (its Escape listener
  // is set up once), so it calls this through a ref to see the current state.
  const guardedLeave = (target, leave) => {
    if (product && (isDirty || saving)) {
      if (!saving && !(target.type === 'switch' && target.countryId === selectedCountryId)) setLeaveTarget(target)
      return
    }
    leave()
  }
  const requestCloseRef = useRef(null)
  requestCloseRef.current = () => guardedLeave({ type: 'close' }, handleCloseDetails)

  const lastLeaveRef = useRef({ countryName: '' })
  if (leaveTarget !== null) lastLeaveRef.current = { countryName: selectedCountryName }

  const handleKeepEditing = () => setLeaveTarget(null)

  const handleConfirmLeave = () => {
    const target = leaveTarget
    setLeaveTarget(null)
    resetPending()
    if (target?.type === 'switch') handleOpenCountrySettingDetails(target.countryId)
    else handleCloseDetails()
  }

  useEffect(() => {
    if (actionState.error) {
      setAlertState({
        open: true,
        content: actionState.error
      })
    }
  }, [actionState.error])

  return (
    <>
      <SitesListContainer>
        <h1>{t('MULTI_COUNTRY_SETTINGS', 'Multi country settings')}</h1>
        {countryState.loading
          ? (
          <SitesWrapper>
            {/*
              `disabled` on the loading placeholders below, now that SiteItem is
              a native button: without it every skeleton row would sit in the tab
              order as an empty, unactionable control while the list loads. They
              carry no onClick and never did.
            */}
            {[...Array(5).keys()].map(i => (
              <SiteItem key={i} disabled>
                <Skeleton width={100} height={14} />
              </SiteItem>
            ))}
          </SitesWrapper>
            )
          : (
          <SitesWrapper>
            {countryState.countries.map(country => (
              <SiteItem
                key={country?.id}
                active={country?.id === selectedCountryId}
                disabled={!country?.enabled}
                onClick={() => country?.enabled && guardedLeave(
                  { type: 'switch', countryId: country?.id },
                  () => handleOpenCountrySettingDetails(country?.id)
                )}
              >
                <span>{country?.name}</span>
                <BsChevronRight />
              </SiteItem>
            ))}
          </SitesWrapper>
            )}
      </SitesListContainer>
      {selectedCountryId && (
        <SideBar
          isBorderShow
          open={selectedCountryId}
          onClose={() => requestCloseRef.current()}
        >
          {product
            ? (
              // the legacy SideBar lays its children in a row: the form and its bar go in one column that takes the panel's width
              <HubFormColumn>
                {/* inside the hub the form stays mounted while it saves (inert, aria-busy), so there is no skeleton */}
                <div
                  ref={formRef}
                  className='odc-hub-form'
                  tabIndex={-1}
                  inert={saving ? '' : undefined}
                  aria-busy={saving ? 'true' : undefined}
                >
                  <CountrySettingDetailMemo
                    key={`${selectedCountryId}:${revision}`}
                    selectedCountryId={selectedCountryId}
                    countryConfigState={detailConfigState}
                    handleChangeConfig={handleFieldChange}
                  />
                </div>
                <SettingsSaveBar
                  count={changedConfigs.length}
                  names={changedConfigs.map(config => config.name)}
                  saving={saving}
                  error={barError}
                  saved={saved}
                  onDiscard={handleDiscard}
                  onSave={handleSave}
                />
              </HubFormColumn>
              )
            : (
              <CountrySettingDetail
                selectedCountryId={selectedCountryId}
                countryConfigState={countryConfigState}
                handleChangeConfig={handleChangeConfig}
              />
              )}
        </SideBar>
      )}
      {product && (
        <ConfirmDialog
          open={leaveTarget !== null}
          title={t('SETTINGS_DISCARD_TITLE', 'Discard your changes?')}
          confirmLabel={t('DISCARD', 'Discard')}
          cancelLabel={t('KEEP_EDITING', 'Keep editing')}
          closeLabel={t('CLOSE', 'Close')}
          tone='danger'
          onConfirm={handleConfirmLeave}
          onCancel={handleKeepEditing}
        >
          {t('SETTINGS_DISCARD_DESCRIPTION', 'You have unsaved changes in _section_. If you leave, they are lost.')
            .replace('_section_', lastLeaveRef.current.countryName)}
        </ConfirmDialog>
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

export const MultiCountrySettings = (props) => {
  const sitesAuthSettinsProps = {
    ...props,
    UIComponent: MultiCountrySettingsUI
  }
  return <MultiCountrySettingsController {...sitesAuthSettinsProps} />
}
