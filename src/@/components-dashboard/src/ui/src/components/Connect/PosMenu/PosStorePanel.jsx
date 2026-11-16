import React, { useCallback, useEffect, useRef, useState } from 'react'

import { PosMenuBusinessDetails as BusinessDetailsController, useLanguage, useSession } from '../../../../../index'
import { CircleAlert, Ellipsis, FileText, Maximize2, Minimize2, TriangleAlert } from '../../Shared/Icon'
import {
  AlertDialog,
  Button,
  Dialog,
  EmptyState,
  IconButton,
  InlineNotice,
  Menu,
  AsyncSwitch,
  RecordPanel,
  Skeleton,
  useSplitView
} from '../../Shared/Product'
import { BusinessSchedule } from '../../Stores'
import { isNetworkFailure } from '../../../../../utils/networkFailure'
import { useStoreDeactivateConfirm } from '../../../hooks/useStoreDeactivateConfirm'
import { ConnectedPosCard } from './ConnectedPosCard'
import { PosCustomFieldsDialog } from './PosCustomFieldsDialog'
import { PosCatalogList } from './PosCatalogList'
import { connectKind } from './connectKinds'
import { catalogOptions, connectedLinks } from './posMenuModel'
import './pos-store-panel.css'

const BodySkeleton = ({ label }) => (
  <div className='psp-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

/**
 * The UI of the store panel of /connect/pos-menu (redesign G1 and H1, decisions 3 to 9): one RecordPanel with the store, its
 * enabled switch, the POS it is connected to (a card each) and the other POS systems. It replaces the two side panels of main
 * (BusinessDetails, BusinessSummary and BusinessIntegration). It is the UIComponent of PosMenuBusinessDetails, which brings
 * `businessState`, `actionStatus`, `formState` and every handler; the list brings `integrationsList`, `getIntegrations`,
 * `handleInstallPosIntegration` and `installingPluginRoot`; the page brings the URL state (`initialSection`, `onSectionChange`).
 */
const PosStorePanelUI = ({
  businessState,
  actionStatus,
  formState,
  setFormState,
  integrationsList,
  getIntegrations,
  handleInstallPosIntegration,
  installingPluginRoot,
  checkingPluginRoot,
  handleCheckPluginInstall,
  initialSection,
  onSectionChange,
  expanded = false,
  onExpandedChange,
  onClose,
  handleChangeActiveBusiness,
  handleConnectBusiness,
  handleDisconnectBusiness,
  handlePushAction,
  handleUpdateBusinessState,
  handleSuccessAddBusinessItem,
  handleSuccessDeleteBusinessItem,
  updateBusiness,
  kind = 'pos'
}) => {
  const [, t] = useLanguage()
  // redesign SC-B: `kind` ('pos' by default) says which links the panel reads and which words it uses
  const { kind: kindName, integrationType } = connectKind(kind)
  const isSalesChannel = kindName === 'sales_channel'
  const [{ user: sessionUser }] = useSession()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const deactivate = useStoreDeactivateConfirm()

  const business = businessState?.business ?? null
  const integrations = integrationsList?.thirdPartyIntegrations
  const listFailed = !!integrationsList?.error

  // redesign PM-15: PosMenuBusinessDetails sets `loading: false` BEFORE it asks for the store (getBusiness, :38-43), and
  // it cannot be touched (sales-channels and importers share it). So «not loading and no store» is not yet «not found». Each new
  // `businessState` object is an update: the first one after the initial state is that «loading: false» before the request, and the
  // second is the answer. A store (from the row or from the answer) or an error ends the wait at once.
  const seenState = useRef(businessState)
  const updates = useRef(0)
  if (seenState.current !== businessState) {
    seenState.current = businessState
    updates.current += 1
  }
  const answered = !!business || !!businessState?.error || updates.current >= 2
  const loading = !!businessState?.loading || (!business && !answered)
  const notFound = !loading && !business

  // Errors of the controller (C20) and of a call that threw (PM-15), in one alert
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // redesign bugs-d row 80: a request that never reached the API says so in words, not the browser's «Failed to fetch»
  const readable = useCallback((content) => {
    const say = (message) => isNetworkFailure(message) ? t('INTEGRATION_REQUEST_FAILED', 'The integration did not respond. Please try again.') : message
    return Array.isArray(content) ? content.map(say) : say(content)
  }, [t])
  useEffect(() => {
    if (actionStatus?.error) setAlertState({ open: true, content: readable(actionStatus.error) })
  }, [actionStatus?.error])
  useEffect(() => {
    if (businessState?.error) setAlertState({ open: true, content: readable(businessState.error) })
  }, [businessState?.error])
  const reportRequestFailure = useCallback(() => {
    setAlertState({ open: true, content: [t('INTEGRATION_REQUEST_FAILED', 'The integration did not respond. Please try again.')] })
  }, [t])

  // Custom fields (C12) and schedule (C21) are large dialogs; the URL (?section=) opens them and follows them
  const [customOpen, setCustomOpen] = useState(initialSection === 'custom_fields')
  const [scheduleOpen, setScheduleOpen] = useState(initialSection === 'schedule')
  useEffect(() => {
    if (initialSection === 'custom_fields') setCustomOpen(true)
    if (initialSection === 'schedule') setScheduleOpen(true)
  }, [initialSection])
  const openCustomFields = () => {
    setCustomOpen(true)
    onSectionChange?.('custom_fields')
  }
  const closeCustomFields = () => {
    setCustomOpen(false)
    onSectionChange?.(null)
  }
  const closeSchedule = () => {
    setScheduleOpen(false)
    onSectionChange?.(null)
  }

  // The model decides what is connected and what is offered
  const isBusinessOwner = sessionUser?.level === 2
  // main, administrators (level 0) are the only ones who reach the Calendly pages
  const isAdmin = sessionUser?.level === 0
  const connected = connectedLinks(business, integrations, integrationType)
  // When the list failed, install and connect are not offered (PM-15): reinstalling what is installed is the risk
  const options = catalogOptions({
    business,
    integrations,
    isBusinessOwner,
    installingPluginRoot,
    checkingPluginRoot,
    formLoading: formState?.loading,
    businessLoading: businessState?.loading,
    isAdmin,
    kind
  }).filter(option => !option.connected && !(listFailed && option.kind === 'integration'))
  // main #394: one POS per store; the note names the one it has (a sales channel store can have several)
  const currentPos = !isSalesChannel ? connected[0] || null : null
  const currentPosName = currentPos ? (currentPos.integration?.name || 'POS') : null

  // Focus: the title of a card (the POS just connected, or the first one for ?section=integration, PM-17)
  const titles = useRef(new Map())
  const titleRefFor = (id) => (node) => {
    if (node) titles.current.set(id, node)
    else titles.current.delete(id)
  }
  const connectHeading = useRef(null)
  const [focusId, setFocusId] = useState(null)
  const connectedKey = connected.map(item => item.link.third_party_integration_id).join(',')
  useEffect(() => {
    if (focusId == null) return
    const target = titles.current.get(focusId)
    if (!target) return
    target.focus()
    setFocusId(null)
  }, [focusId, connectedKey])

  const sectionHandled = useRef(false)
  useEffect(() => {
    if (initialSection !== 'integration' || sectionHandled.current || loading || !business) return
    sectionHandled.current = true
    const first = connected[0]
    const target = first ? titles.current.get(first.link.third_party_integration_id) : connectHeading.current
    target?.focus()
    onSectionChange?.(null)
  })

  const menuItems = [
    {
      key: 'custom-fields',
      label: t('CUSTOM_FIELDS', 'Custom fields'),
      icon: FileText,
      onSelect: openCustomFields
    }
  ]

  const headerActions = (
    <>
      {!phone && onExpandedChange && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => onExpandedChange(!expanded)}
        />
      )}
      <Menu label={t('MORE_ACTIONS', 'More actions')} icon={Ellipsis} items={menuItems} />
    </>
  )

  // redesign PM-02: the switch of the STORE (it enables it for customers) has its name, beside the title
  // redesign (owner decision 31 A): switching it off asks first, as on /stores/list; switching it on does not
  const status = business && (
    <span className='psp-status'>
      <AsyncSwitch
        checked={!!business.enabled}
        failureText={t('STORES_CHANGE_FAILED', "We couldn't save the change.")}
        confirmChange={next => deactivate.confirmChange(next, business.name)}
        onToggle={next => handleChangeActiveBusiness(next)}
      >
        {t('POS_MENU_STORE_ENABLED', 'Store enabled')}
      </AsyncSwitch>
      {deactivate.dialog}
    </span>
  )

  let body
  if (loading) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else if (notFound) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('NOT_FOUND_BUSINESS', "Sorry, we couldn't find the requested business.")}
        action={onClose && <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
      />
    )
  } else {
    body = (
      <div className='psp-body'>
        {listFailed && (
          <InlineNotice
            tone='danger'
            icon={TriangleAlert}
            action={<Button size='sm' onClick={() => getIntegrations?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
          >
            {isSalesChannel
              ? t('SALES_CHANNELS_INTEGRATIONS_ERROR', "The sales channel list couldn't load.")
              : t('POS_MENU_INTEGRATIONS_ERROR', "The POS list couldn't load.")}
          </InlineNotice>
        )}

        {connected.length > 0 && (
          <section className='psp-section' aria-labelledby='psp-connected-title'>
            <h3 id='psp-connected-title' className='psp-heading'>
              {isSalesChannel ? t('SALES_CHANNELS_CONNECTED', 'Connected sales channels') : t('POS_MENU_CONNECTED_POS', 'Connected POS')}
            </h3>
            {connected.map(({ link, integration }) => {
              const id = integration?.id ?? link.third_party_integration_id
              return (
                <ConnectedPosCard
                  key={id}
                  business={business}
                  link={link}
                  integration={integration}
                  formState={formState}
                  setFormState={setFormState}
                  handleConnectBusiness={handleConnectBusiness}
                  handleDisconnectBusiness={handleDisconnectBusiness}
                  handlePushAction={handlePushAction}
                  handleUpdateBusinessState={handleUpdateBusinessState}
                  getIntegrations={getIntegrations}
                  updateBusiness={updateBusiness}
                  titleRef={titleRefFor(id)}
                  onRequestError={reportRequestFailure}
                  isAdmin={isAdmin}
                  kind={kind}
                />
              )
            })}
          </section>
        )}

        {/* main: a loaded sales channel catalog with nothing left to connect says why, instead of an empty panel */}
        {isSalesChannel && !integrationsList?.loading && !listFailed && options.length === 0 && (
          <p className='psp-note psp-section-note'>
            {connected.length > 0
              ? t('ALL_SALES_CHANNELS_CONNECTED', 'All available sales channels are connected.')
              : t('NO_SALES_CHANNELS_AVAILABLE', 'No sales channels available.')}
          </p>
        )}

        {/* redesign SC-R1-1: a sales channel catalog can be empty (every channel connected, or the list failed and the
            notice above says so); then there is no «Other sales channels» heading over nothing. A POS always has its call options. */}
        {(!isSalesChannel || !!integrationsList?.loading || options.length > 0) && (
        <section className='psp-section' aria-labelledby='psp-other-title'>
          <h3 id='psp-other-title' ref={connectHeading} tabIndex={-1} className='psp-heading'>
            {isSalesChannel
              ? (connected.length > 0 ? t('SALES_CHANNELS_OTHER', 'Other sales channels') : t('SALES_CHANNELS_CONNECT_ONE', 'Connect a sales channel'))
              : (connected.length > 0 ? t('POS_MENU_OTHER_POS', 'Other POS systems') : t('POS_MENU_CONNECT_A_POS', 'Connect a POS'))}
          </h3>
          {currentPosName && options.some(option => option.blockedByPos) && (
            <p className='psp-note psp-section-note'>
              {t('POS_ALREADY_CONNECTED_NOTE', 'This store already uses _name_. Disconnect it to switch POS.').replace('_name_', () => currentPosName)}
            </p>
          )}
          <PosCatalogList
            options={options}
            loading={!!integrationsList?.loading}
            business={business}
            integrations={integrations}
            handleInstallPosIntegration={handleInstallPosIntegration}
            handleConnectBusiness={handleConnectBusiness}
            getIntegrations={getIntegrations}
            updateBusiness={updateBusiness}
            onConnected={setFocusId}
            onRequestError={reportRequestFailure}
            handleCheckPluginInstall={handleCheckPluginInstall}
            keepsCurrentPos={!!currentPos}
          />
        </section>
        )}
      </div>
    )
  }

  return (
    <>
      <RecordPanel
        title={business || notFound ? (business?.name || t('BUSINESS', 'Business')) : <span className='psp-title-skeleton'><Skeleton /></span>}
        subtitle={business?.city?.name || undefined}
        status={status}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
      >
        {body}
      </RecordPanel>

      {/* one title and a delete confirmation with its own scrim (PosCustomFieldsDialog says why) */}
      <PosCustomFieldsDialog
        open={customOpen && !!business}
        onClose={closeCustomFields}
        business={business}
        onAdded={(result) => handleSuccessAddBusinessItem('metafields', result)}
        onDeleted={(id) => handleSuccessDeleteBusinessItem('metafields', id)}
      />

      <Dialog
        open={scheduleOpen && !!business}
        onOpenChange={(next) => { if (!next) closeSchedule() }}
        size='lg'
        title={t('SCHEDULE', 'Schedule')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <BusinessSchedule business={business} handleSuccessUpdate={handleUpdateBusinessState} />
      </Dialog>

      <AlertDialog
        open={alertState.open}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={() => setAlertState({ open: false, content: [] })}
      />
    </>
  )
}

/**
 * The panel of a store of /connect/pos-menu. Props:
 *  - `businessId`, `business` (the row of the list; null when it was opened by `?id=`);
 *  - `integrationsList`, `getIntegrations`, `handleInstallPosIntegration`, `installingPluginRoot`, `checkingPluginRoot` and
 *    `handleCheckPluginInstall` (main #399): the list's controller;
 *  - `refreshSignal` (main #399): a new number makes PosMenuBusinessDetails read the store again (the list's Refresh);
 *  - `handleSucessUpdateBusiness(business)`: the list's, called by PosMenuBusinessDetails when the store changes;
 *  - `initialSection` (`?section=`: `custom_fields`, `schedule` or `integration`) and `onSectionChange(section | null)`;
 *  - `expanded`, `onExpandedChange`, `onClose`;
 *  - `kind` (redesign SC-B, ): `'pos'` (default) or `'sales_channel'`, see connectKinds. It travels through the controller to the UI.
 * It mounts PosMenuBusinessDetails with `PosStorePanelUI`; no handler of its own. A new store mounts it again (its dialogs and its
 * focus start clean).
 */
export const PosStorePanel = ({ businessId, business, handleSucessUpdateBusiness, ...props }) => (
  <BusinessDetailsController
    key={businessId}
    {...props}
    businessId={businessId}
    business={business}
    asDashboard
    handleSucessUpdateBusiness={handleSucessUpdateBusiness}
    UIComponent={PosStorePanelUI}
  />
)
