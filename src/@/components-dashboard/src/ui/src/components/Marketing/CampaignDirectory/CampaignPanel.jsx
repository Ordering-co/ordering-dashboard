import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CampaignDetail as CampaignDetailController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Ellipsis, Maximize2, Minimize2, Trash2, TriangleAlert } from '../../Shared/Icon'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Menu,
  RecordPanel,
  Skeleton,
  StatusBadge,
  Switch,
  useSplitView
} from '../../Shared/Product'
import { CampaignDetail as LegacyCampaignDetail } from '../CampaignDetail'
import { campaignStatus } from './campaignData'
import { CampaignCreateForm } from './CampaignCreateForm'
import { CampaignView } from './CampaignView'
import './campaign-panel.css'

// redesign CA-B6 (decisions 1, 4 and 5; defects M-CA3, M-CA4, M-CA8, M-CA10, M-CA11; auditor #7, #18): the one panel of the campaigns page,
// a RecordPanel inside the page's SplitView. It is the UIComponent of K/CampaignDetail and has three bodies:
//   - create (`isAddMode`): CampaignCreateForm (CA-B5), whose render prop gives the panel its `body`, `footer` and `dirty`; «Cancel» asks the
//     panel to close, so the discard guard applies (M-CA11);
//   - a created campaign with a `status`: CampaignView, read-only (decision 4), with the status (the switch of a dynamic one) and a ⋯ menu with
//     Delete in the header. No guard: the view has nothing to lose;
//   - a created campaign WITHOUT `status` (none in `orderingv1`, but the API may return one): `main` edits it with the mouse today
//     (`isDisabled={!!status}`), so it keeps main's detail, unchanged, in the body (auditor #7).

const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error.flat(Infinity) : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const BodySkeleton = ({ label }) => (
  <div className='odc-campaign-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

const CampaignPanelUI = (props) => {
  const {
    isAddMode,
    campaign: row,
    campaignState,
    toggle,
    onClose,
    expanded = false,
    onExpandedChange,
    onRetry,
    onDirtyChange,
    handleDeleteCampaign
  } = props
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const panelRef = useRef(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // redesign CA-B6 (coordinator addition): the page asks before it drops a half-typed draft, so it needs to know when there is one. The form
  // reports its dirty state while it is mounted; leaving create mode, or the panel going away, says «clean» (nothing is left to lose).
  const creating = !!isAddMode
  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  useEffect(() => {
    if (!creating) return undefined
    return () => { dirtyRef.current?.(false) }
  }, [creating])

  // The record: what the controller loaded, under the freshest row of the list (its switch moved, its figures changed), so the header and
  // the view never lag behind the table.
  const fetched = campaignState?.campaign
  const record = useMemo(() => ({ ...(fetched || {}), ...(row || {}) }), [fetched, row])
  const hasRecord = record.id != null
  const failed = !hasRecord && hasError(campaignState?.error)
  const loading = !creating && !failed && (!!campaignState?.loading || !hasRecord)
  const name = record.name || t('CAMPAIGN', 'Campaign')

  const expandAction = !phone && onExpandedChange && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
    />
  )
  const closeLabel = phone ? t('BACK', 'Back') : t('CLOSE', 'Close')
  const discard = {
    discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
    discardDescription: t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
    discardConfirmLabel: t('DISCARD', 'Discard'),
    keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
  }

  // ---- create ----
  if (creating) {
    return (
      <CampaignCreateForm {...props} onDirtyChange={onDirtyChange} onCancel={() => panelRef.current?.requestClose()}>
        {({ body, footer, dirty }) => (
          <RecordPanel
            ref={panelRef}
            title={t('CAMPAIGNS_NEW', 'New campaign')}
            closeLabel={closeLabel}
            onClose={onClose}
            headerActions={expandAction || undefined}
            dirty={dirty}
            footer={footer}
            {...discard}
          >
            {body}
          </RecordPanel>
        )}
      </CampaignCreateForm>
    )
  }

  // ---- delete (view mode) ----
  const deleteFallback = t('CAMPAIGNS_DELETE_ERROR', "We couldn't delete this campaign. Try again.")
  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    let result
    try {
      result = await handleDeleteCampaign()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    // On ok the controller has told the list and closed the panel; there is nothing left to paint
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
    if (!result?.ok) setDeleteErrors(errorLines(result?.error, deleteFallback))
  }
  const cancelDelete = () => { if (!deleting) setDeleteOpen(false) }

  const withStatus = hasRecord && !!record.status
  const isLegacy = hasRecord && !record.status

  // ---- header ----
  let status
  if (withStatus) {
    const info = campaignStatus(record, t)
    if (info.toggle) {
      const switchName = t('CAMPAIGNS_STATUS_SWITCH', '_status_, _name_').replace('_status_', () => info.label).replace('_name_', () => record.name ?? '')
      status = (
        // redesign CA-B6: the wrapper lets the narrow header give this row the room its 44px area needs
        <span className='odc-campaign-panel-status'>
          <Switch
            checked={!!record.enabled}
            busy={(toggle?.pendingIds ?? []).includes(record.id)}
            aria-label={switchName}
            onCheckedChange={next => toggle?.setEnabled?.(record, next)}
          >
            {info.label}
          </Switch>
        </span>
      )
    } else {
      status = <StatusBadge family={info.family} label={info.label} />
    }
  }

  const menu = withStatus && (
    <Menu
      label={t('MORE_ACTIONS', 'More actions')}
      icon={Ellipsis}
      items={[{
        key: 'delete',
        label: t('DELETE', 'Delete'),
        icon: Trash2,
        tone: 'danger',
        onSelect: () => setDeleteOpen(true)
      }]}
    />
  )
  const headerActions = (expandAction || menu) ? <>{expandAction}{menu}</> : undefined

  // ---- body ----
  let body
  if (failed) {
    body = (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('CAMPAIGNS_VIEW_LOAD_ERROR', "We couldn't load this campaign.")}
        description={errorText(t, campaignState?.error)}
        action={onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (loading) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else if (isLegacy) {
    body = (
      <div className='odc-campaign-legacy'>
        <LegacyCampaignDetail
          campaign={record}
          campaignId={record.id}
          campaignList={props.campaignList}
          handleSuccessAddCampaign={props.handleSuccessAddCampaign}
          handleSuccessUpdateCampaign={props.handleSuccessUpdateCampaign}
          handleSuccessDeleteCampaign={props.handleSuccessDeleteCampaign}
          onClose={onClose}
        />
      </div>
    )
  } else {
    body = <CampaignView {...props} campaignState={{ ...campaignState, campaign: record }} />
  }

  return (
    <>
      <RecordPanel
        title={hasRecord || failed ? name : <span className='odc-campaign-title-skeleton'><Skeleton /></span>}
        status={status}
        closeLabel={closeLabel}
        onClose={onClose}
        headerActions={headerActions}
      >
        {body}
      </RecordPanel>

      {withStatus && (
        <ConfirmDialog
          open={deleteOpen}
          tone='danger'
          title={t('CAMPAIGNS_DELETE_TITLE', 'Delete "_name_"?').replace('_name_', () => name)}
          confirmLabel={t('CAMPAIGNS_DELETE_CONFIRM', 'Delete campaign')}
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        >
          {t('CAMPAIGNS_DELETE_BODY', "This can't be undone.")}
        </ConfirmDialog>
      )}

      <AlertDialog
        open={!!deleteErrors}
        title={t('CAMPAIGNS_DELETE_ERROR_TITLE', "The campaign wasn't deleted")}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />
    </>
  )
}

/**
 * The panel of a campaign (redesign CA-B6). Props:
 *  - `campaign`: the row of the list, `{}` for a new campaign (or when opened by `?id=`); `campaignId`: number|null (with `?id=` only the id is known);
 *  - `campaignList`, `handleSuccessAddCampaign`, `handleSuccessUpdateCampaign`, `handleSuccessDeleteCampaign`: the list controller's, forwarded
 *    to K/CampaignDetail (and to main's detail for a campaign without status) exactly as M/CampaignListing passes them today;
 *  - `toggle`: the result of `useCampaignEnabledToggle` (`pendingIds`, `setEnabled(campaign, next)`); its alert is the host's to draw;
 *  - `onOpenOpens(campaign)`: the Opens link of the view;
 *  - `onClose()`, `expanded`, `onExpandedChange(next)`;
 *  - `onDirtyChange(dirty)`: the create form's unsaved state (false when the panel leaves create mode or unmounts), for the page's discard guard.
 * It mounts K/CampaignDetail with `CampaignPanelUI`. The controller has no refetch: a new `key` mounts it again, which asks the API again.
 */
export const CampaignPanel = (props) => {
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(count => count + 1), [])
  const { campaign, campaignId } = props
  return (
    <CampaignDetailController
      key={`${campaign?.id ?? campaignId ?? 'new'}:${attempt}`}
      {...props}
      campaign={campaign ?? {}}
      campaignId={campaignId ?? null}
      onRetry={retry}
      UIComponent={CampaignPanelUI}
    />
  )
}
