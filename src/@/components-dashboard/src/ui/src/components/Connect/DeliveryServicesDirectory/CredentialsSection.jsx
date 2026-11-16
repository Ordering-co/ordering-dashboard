import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { useLanguage, useSession } from '../../../../../index'
import { usePluginPage } from '../../../hooks/usePluginPage'
import { hasPluginLaunch } from '../../../../../utils/pluginPages'
import { CircleAlert } from '../../Shared/Icon'
import { Button, Dialog, EmptyState, InlineNotice, Skeleton } from '../../Shared/Product'
import { SettingsList } from '../../Settings'
import { SettingsHubFormContext } from '../../Settings/SettingsHubForm/SettingsHubFormContext'
import { DoordashContent, hasSetupGuide } from '../DeliveryServiceDetails/DoordashContent'
import { DriversGroupsLogisticsService } from '../DriversGroupsLogisticsService'
import { autosaveChanges } from './providerSections'
import './provider-panel.css'

/**
 * The Credentials section of the provider panel (redesign DS-B3, decision 2 | M-DS12, M-DS13), in place of
 * C/N/DeliveryServiceGeneralForm. Same data and requests (`PUT /configs/:id`, same keys and order, with their dependencies): what
 * changes is the frame.
 *
 *  - It is a plain container with the tour anchor, not a `<form>` (M-DS12: the form of main handed `changesState` to
 *    `handleUpdateDeliveryService` on any implicit submit).
 *  - The fields are `SettingsList` in the hub mode (`SettingsHubFormContext` with `product: true`): Product fields, the save bar with
 *    «Discard», errors by field. `report` tells the panel when the form has unsaved changes (what feeds its discard guard). It is
 *    given neither `deliveryGroups` nor `changesState` nor `handleChangesState`, so it does not draw the automatic assignment under
 *    its pinned save bar.
 *  - The automatic assignment is a block of its own after the form, «Saves on change», as it always did: an effect over
 *    `changesState` saves the autoassignment keys of the group and nothing else (M-DS13: a pending Businesses or Payment methods
 *    is not sent from here).
 *  - «Setting up…» is now the secondary button «Setup guide» (a Product Dialog with the guide, unchanged: ); the message and
 *    «Start Setup» keep the href of main for a plugin without `links.launch` (the session token in the URL is , not fixed
 *    here). A plugin with `links.launch` opens its setup the same way main does (#400): a Product `Button` opens the tab on the
 *    click, then sends it to the one-time URL `usePluginPage()` gets from the plugin.
 *
 * Props, all given by the panel (they are the ones the controller K/DeliveryServiceDetails and the page give): `deliveryServiceState`,
 * `pluginState`, `availableModifyData`, `setAvailableModifyData`, `reloadPluginInformation`, `projectCode`, `deliveryServiceId`,
 * `deliveryGroups`, `changesState`, `handleChangesState`, `handleUpdateDeliveryGroup`, `actionDisabled`, `onDirtyChange(bool)`.
 */

const noop = () => {}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// #400 (main): a plugin with links.launch gives a one-time URL instead of taking the session in
// the URL. Split out so usePluginPage() (and the API/toast contexts it reads) only mounts for a
// plugin that actually launches — every other plugin keeps the plain href below untouched.
const LaunchSetupButton = ({ plugin, deliveryServiceId, label }) => {
  const openPluginPage = usePluginPage()

  const handleStartSetup = async () => {
    // the tab opens on the click, before the plugin answers, so the browser does not block it as a popup
    const setupWindow = window.open('', '_blank')
    const url = await openPluginPage(plugin, 'setup', { driverCompanyId: deliveryServiceId })
    if (!setupWindow) return
    if (!url) {
      setupWindow.close()
      return
    }
    setupWindow.opener = null
    setupWindow.location.href = url
  }

  return <Button onClick={handleStartSetup}>{label}</Button>
}

const FieldsSkeleton = ({ label }) => (
  <div className='cs-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

export const CredentialsSection = (props) => {
  const {
    deliveryServiceState,
    pluginState,
    availableModifyData,
    setAvailableModifyData,
    reloadPluginInformation,
    projectCode,
    deliveryServiceId,
    deliveryGroups,
    changesState,
    handleChangesState,
    handleUpdateDeliveryGroup,
    actionDisabled,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [{ token }] = useSession()
  const titleId = useId()
  const [guideOpen, setGuideOpen] = useState(false)

  const plugin = deliveryServiceState?.deliveryService?.plugin
  const pluginKey = plugin?.key

  // redesign DS-B3 (decision 2): what the form says about itself is what the panel's discard guard asks about
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  const report = useCallback((_sectionKey, state) => onDirtyChangeRef.current?.(Boolean(state?.dirty)), [])
  const hub = useMemo(() => ({ product: true, report }), [report])

  // redesign DS-B3 (decision 2 | M-DS13): the automatic assignment saves on change, with its own keys only
  useEffect(() => {
    const changes = autosaveChanges(changesState)
    if (Object.keys(changes).length > 0) handleUpdateDeliveryGroup?.(changes)
  }, [changesState])

  // main one name for every service, and no button when the plugin has no guide
  const guideTitle = t('SETUP_GUIDE', 'Setup guide')
  const showGuide = hasSetupGuide(plugin)

  const setupUrl = plugin?.setup_url
  const failed = hasError(pluginState?.error)
  const loaded = !failed && !pluginState?.loading && Boolean(pluginState?.configs)

  let fields
  if (failed) {
    fields = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('DELIVERY_SERVICES_CREDENTIALS_LOAD_ERROR', "We couldn't load the credentials.")}
        action={<Button onClick={() => reloadPluginInformation?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (!loaded) {
    fields = <FieldsSkeleton label={t('LOADING', 'Loading')} />
  } else {
    fields = (
      <div className='cs-form'>
        <SettingsHubFormContext.Provider value={hub}>
          <SettingsList
            staticConfigs={pluginState.configs}
            onCloseSettingsList={() => null}
            isRemoveGeneralTitle
            setAvailableModifyData={setAvailableModifyData}
          />
        </SettingsHubFormContext.Provider>
      </div>
    )
  }

  const autoGroup = Array.isArray(deliveryGroups?.groups) && deliveryGroups.groups.length > 0 ? deliveryGroups.groups[0] : null

  return (
    <div className='cs-root' data-tour='tour_fill_group'>
      {loaded && availableModifyData !== true && (
        <InlineNotice tone='info'>
          {t('DELIVERY_SERVICES_UNLOCK_NOTICE', 'Fill in every field below to unlock Businesses, Schedule, Payment methods and Delivery zones.')}
        </InlineNotice>
      )}

      <div className='cs-intro'>
        <p className='cs-message'>
          {setupUrl
            ? t('CLICK_FOLLOW_STEPS_TO_FINISH_SETUP', 'Click and Follow steps to finish setup')
            : t('FILL_REQUESTED_FIELDS', 'Please fill in the fields requested below.')}
        </p>
        <div className='cs-actions'>
          {setupUrl && (
            hasPluginLaunch(plugin) // #400 (main): no token in the URL, launched through usePluginPage()
              ? (
                <LaunchSetupButton plugin={plugin} deliveryServiceId={deliveryServiceId} label={t('START_SETUP', 'Start Setup')} />
                )
              : (
                <a
                  className='odc-btn'
                  data-variant='secondary'
                  href={`${setupUrl}?project_code=${projectCode}&access_token=${token}&driver_company_id=${deliveryServiceId}`}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {t('START_SETUP', 'Start Setup')}
                </a>
                )
          )}
          {showGuide && <Button onClick={() => setGuideOpen(true)}>{t('DELIVERY_SERVICES_SETUP_GUIDE', 'Setup guide')}</Button>}
        </div>
      </div>

      {fields}

      {autoGroup && (
        <section className='cs-block' aria-labelledby={titleId}>
          <div className='cs-block-head'>
            <h3 id={titleId} className='cs-block-title'>{t('DELIVERY_SERVICES_AUTOMATIC_ASSIGNMENT', 'Automatic assignment')}</h3>
            <span className='cs-block-note'>{t('DELIVERY_SERVICES_SAVES_ON_CHANGE', 'Saves on change')}</span>
          </div>
          <DriversGroupsLogisticsService
            curDriversGroup={autoGroup}
            driversGroupState={{ ...deliveryGroups, driversGroup: autoGroup }}
            changesState={changesState}
            handleChangesState={handleChangesState}
            handleUpdateDriversGroup={handleUpdateDeliveryGroup}
            handleParentSidebarMove={noop}
            actionDisabled={actionDisabled}
          />
        </section>
      )}

      <Dialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        size='lg'
        title={guideTitle}
        closeLabel={t('CLOSE', 'Close')}
      >
        <DoordashContent pluginKey={pluginKey} plugin={plugin} />
      </Dialog>
    </div>
  )
}
