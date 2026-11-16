import React, { useEffect, useMemo, useRef, useState } from 'react'

import { BannerDetails as BannerDetailsController, useLanguage } from '../../../../../index'
import { Ellipsis, Maximize2, Minimize2, Trash2, TriangleAlert } from '../../Shared/Icon'
import {
  AsyncSwitch,
  Button,
  ConfirmDialog,
  IconButton,
  InlineNotice,
  Menu,
  RecordPanel,
  TabPanel,
  Tabs,
  TextField,
  useSplitView
} from '../../Shared/Product'
import { BannerBusinesses } from './BannerBusinesses'
import { BannerImagesGrid } from './BannerImagesGrid'
import { BannerNameField, apiErrorText } from './BannerNameField'
import { usePositionText } from './bannerPositions'
import './banner-panel.css'

// redesign AB-B3 (decisions 2 and 4; defects M-AB04, M-AB07, M-AB09, M-AB10, M-AB15, M-AB16, M-AB24): the one panel of the banner, a
// RecordPanel inside the page's SplitView. It is the UIComponent of K/BannerDetails and has two bodies:
//   - create (`isAddMode`): Name (and the businesses, in the «Business page» positions) with «Cancel» and «Create banner» in the footer.
//     No ⋯ menu and no Delete (M-AB04); «Create banner» waits for a name and is busy while it saves, so a double click cannot create
//     two (M-AB09); a name with text is an unsaved draft, so «Cancel» goes through the discard guard (decision 17). On success the
//     controller calls handleSuccessAdd and onClose; this panel hands the new banner to the host (`onCreated`) so it opens it, ready for
//     its first image (M-AB10: the host never builds `?banner=undefined`);
//   - view: the AsyncSwitch of the list row and a ⋯ menu with «Delete banner» in the header, the self-saving name, and the tabs Images
//     (a grid of tiles) and Businesses («Business page» positions only). Deleting asks first, in words (decision 4, M-AB24).

// A stable empty record: the controller's [banner] effect must not see a new object on every render
const EMPTY_BANNER = Object.freeze({})

const hasKeys = (value) => !!value && Object.keys(value).length > 0

// The same businesses, whatever the order or the type of the ids (the API gives numbers, a checkbox may give strings)
const sameIds = (a, b) => {
  const left = new Set(a.map(String))
  const right = new Set(b.map(String))
  return left.size === right.size && [...left].every(id => right.has(id))
}

const groupLabels = {
  web: (t) => t('AD_BANNERS_GROUP_WEB', 'Web'),
  app: (t) => t('AD_BANNERS_GROUP_APP', 'App')
}

const useChrome = ({ expanded, onExpandedChange }) => {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const expandAction = !phone && onExpandedChange && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
    />
  )
  return {
    t,
    expandAction: expandAction || null,
    closeLabel: phone ? t('BACK', 'Back') : t('CLOSE', 'Close'),
    discard: {
      discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
      discardDescription: t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
      discardConfirmLabel: t('DISCARD', 'Discard'),
      keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
    }
  }
}

// ---- create ------------------------------------------------------------------------------------------------------------------------
const BannerCreate = (props) => {
  const {
    position,
    changesState,
    actionState,
    handleChangeItem,
    handleAddBanner,
    onClose,
    onCreated,
    onDirtyChange,
    expanded,
    onExpandedChange
  } = props
  const { t, expandAction, closeLabel, discard } = useChrome({ expanded, onExpandedChange })
  const positionText = usePositionText()
  const panelRef = useRef(null)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const mounted = useRef(true)
  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated
  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange

  const name = changesState?.changes?.name ?? ''
  const hasName = typeof name === 'string' && name.trim() !== ''
  // decision 17: a draft with text is unsaved; the page asks before it drops it
  const dirty = hasName

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => { dirtyRef.current?.(dirty) }, [dirty])
  useEffect(() => () => { dirtyRef.current?.(false) }, [])

  const create = async () => {
    if (submitting.current || !hasName) return
    submitting.current = true
    setBusy(true)
    setFailure(null)
    let result
    try {
      result = await handleAddBanner()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    submitting.current = false
    if (result && result.ok === false) {
      if (mounted.current) {
        setBusy(false)
        setFailure(apiErrorText(t, result.error, t('AD_BANNERS_CREATE_FAILED', "We couldn't create the banner. Try again.")))
      }
      return
    }
    if (mounted.current) setBusy(false)
    // The controller has told the list and asked the host to close (`onClose`), and the host may have unmounted this panel by now:
    // the new banner is handed over either way, so the host can open it.
    if (result?.result) onCreatedRef.current?.({ ...result.result, enabled: true })
  }

  // The buttons are direct children of the panel's foot, so its own rules apply (end-aligned; full width and 44px on a phone)
  const footer = (
    <>
      <Button onClick={() => panelRef.current?.requestClose()}>{t('CANCEL', 'Cancel')}</Button>
      <Button variant='primary' busy={busy || !!actionState?.loading} disabled={!hasName} onClick={create}>
        {t('AD_BANNERS_CREATE', 'Create banner')}
      </Button>
    </>
  )

  return (
    <RecordPanel
      ref={panelRef}
      title={t('ADD_BANNER', 'Add banner')}
      subtitle={position ? positionText(position).title : undefined}
      closeLabel={closeLabel}
      onClose={onClose}
      headerActions={expandAction || undefined}
      dirty={dirty}
      footer={footer}
      {...discard}
    >
      <div className='odc-root odc-banners-panel-body'>
        {failure && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{failure}</InlineNotice>}
        <TextField
          label={t('NAME', 'Name')}
          required
          requiredLabel={t('REQUIRED', 'Required')}
          value={name}
          onChange={value => handleChangeItem?.({ name: value })}
          autoComplete='off'
        />
        {position?.isBusinessPage && (
          <BannerBusinesses
            mode='create'
            businessList={props.businessList}
            selectedBusinessIds={props.selectedBusinessIds}
            handleSelectBusiness={props.handleSelectBusiness}
            handleSelectAllBusiness={props.handleSelectAllBusiness}
            handleSelectEveryBusiness={props.handleSelectEveryBusiness}
            handleChangeBusinessPage={props.handleChangeBusinessPage}
            searchBusinesses={props.searchBusinesses}
            actionState={actionState}
          />
        )}
      </div>
    </RecordPanel>
  )
}

// ---- view --------------------------------------------------------------------------------------------------------------------------
const BannerView = (props) => {
  const {
    banner: row,
    position,
    bannerState,
    bannerItemsState,
    actionState,
    toggle,
    handleUpdateClick,
    handleDeleteBanner,
    handleDeleteBannerItem,
    handleUpdateBannerItem,
    handleSuccessBannerItemAdd,
    selectedBusinessIds,
    onClose,
    onDirtyChange,
    expanded,
    onExpandedChange
  } = props
  const { t, expandAction, closeLabel, discard } = useChrome({ expanded, onExpandedChange })
  const positionText = usePositionText()
  const [tab, setTab] = useState('images')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // The record: what the controller holds, under the freshest row of the list (its switch moved, its images changed), so the header
  // never lags behind the list (M-AB05 is the host's: it passes the list's current row).
  const fetched = bannerState?.banner
  const record = useMemo(() => ({ ...(fetched || {}), ...(row || {}) }), [fetched, row])
  const text = position ? positionText(position) : { title: '' }
  // usePositionText gives `size` as the sentence («Recommended size 1440 x 300») and `dimensions` as the measure alone, which is what
  // the subtitle draws as a figure
  const dimensions = text.dimensions ?? ''
  const group = position?.group && groupLabels[position.group] ? groupLabels[position.group](t) : ''
  const name = record.name || t('BANNER', 'Banner')
  const images = Array.isArray(bannerItemsState?.images) ? bannerItemsState.images : []
  const isBusinessPage = !!position?.isBusinessPage
  const businessCount = Array.isArray(record.business) ? record.business.length : undefined

  // (decision 17): in a «Business page» position the chosen businesses are a draft until «Save businesses»; the person
  // closing the panel (X, Escape) or opening another row (the page's guard, through `onDirtyChange`) is asked first. Saved = the
  // record's own list, which the controller and the list refresh after a save, so a save leaves it clean.
  const savedBusinessIds = Array.isArray(record.business) ? record.business.map(business => business?.id) : []
  const chosenBusinessIds = Array.isArray(selectedBusinessIds) ? selectedBusinessIds : []
  const dirty = isBusinessPage && !sameIds(savedBusinessIds, chosenBusinessIds)
  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  const lastDirty = useRef(false)
  useEffect(() => {
    if (dirty === lastDirty.current) return
    lastDirty.current = dirty
    dirtyRef.current?.(dirty)
  }, [dirty])
  useEffect(() => () => { if (lastDirty.current) dirtyRef.current?.(false) }, [])

  const countLabel = (count, one, other) => (count === 1 ? one : other).replace('_count_', () => String(count))
  const items = [{
    value: 'images',
    label: t('IMAGES', 'Images'),
    count: images.length,
    countLabel: countLabel(images.length, t('AD_BANNERS_IMAGES_COUNT_ONE', '_count_ image'), t('AD_BANNERS_IMAGES_COUNT_OTHER', '_count_ images'))
  }]
  if (isBusinessPage) {
    items.push({
      value: 'businesses',
      label: t('BUSINESSES', 'Businesses'),
      count: businessCount,
      countLabel: businessCount === undefined
        ? undefined
        : countLabel(businessCount, t('AD_BANNERS_BUSINESSES_COUNT_ONE', '_count_ business'), t('AD_BANNERS_BUSINESSES_COUNT_OTHER', '_count_ businesses'))
    })
  }
  const activeTab = items.some(item => item.value === tab) ? tab : 'images'

  const stateLabel = record.enabled ? t('AD_BANNERS_ON', 'On') : t('AD_BANNERS_OFF', 'Off')
  const switchName = t('AD_BANNERS_STATUS_SWITCH', '_status_, _name_').replace('_status_', () => stateLabel).replace('_name_', () => record.name ?? '')

  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteFailure(null)
    let result
    try {
      result = await handleDeleteBanner()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    // On ok the controller has told the list and asked the host to close the panel; there is nothing left to paint
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
    if (result && result.ok === false) {
      setDeleteFailure(apiErrorText(t, result.error, t('AD_BANNERS_DELETE_FAILED', "We couldn't delete the banner. Try again.")))
    }
  }

  const headerActions = (
    <>
      {expandAction}
      <span className='odc-banners-panel-status'>
        <AsyncSwitch
          checked={!!record.enabled}
          busy={(toggle?.pendingIds ?? []).includes(record.id)}
          aria-label={switchName}
          failureText={t('AD_BANNERS_TOGGLE_FAILED', "We couldn't change the banner")}
          onToggle={next => toggle?.setEnabled?.(record, next)}
        >
          {stateLabel}
        </AsyncSwitch>
      </span>
      <Menu
        label={t('MORE_ACTIONS', 'More actions')}
        icon={Ellipsis}
        items={[{
          key: 'delete',
          label: t('AD_BANNERS_DELETE', 'Delete banner'),
          icon: Trash2,
          tone: 'danger',
          onSelect: () => setDeleteOpen(true)
        }]}
      />
    </>
  )

  return (
    <>
      <RecordPanel
        title={name}
        subtitle={(
          <>
            {group ? `${group} · ` : ''}{text.title}{dimensions ? ' · ' : ''}
            {dimensions && <span className='odc-figure'>{dimensions}</span>}
          </>
        )}
        closeLabel={closeLabel}
        onClose={onClose}
        headerActions={headerActions}
        dirty={dirty}
        {...discard}
      >
        <div className='odc-root odc-banners-panel-body'>
          {deleteFailure && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{deleteFailure}</InlineNotice>}
          <BannerNameField name={record.name} onSave={value => handleUpdateClick?.({ name: value })} />
          <Tabs
            label={t('AD_BANNERS_SECTIONS', 'Banner sections')}
            value={activeTab}
            onValueChange={setTab}
            items={items}
            size='sm'
          >
            <TabPanel value='images' keepMounted className='odc-banners-tab-panel'>
              <BannerImagesGrid
                banner={record}
                images={images}
                position={position}
                handleDeleteBannerItem={handleDeleteBannerItem}
                handleUpdateBannerItem={handleUpdateBannerItem}
                handleSuccessBannerItemAdd={handleSuccessBannerItemAdd}
              />
            </TabPanel>
            {isBusinessPage && (
              <TabPanel value='businesses' keepMounted className='odc-banners-tab-panel'>
                <BannerBusinesses
                  mode='edit'
                  businessList={props.businessList}
                  selectedBusinessIds={selectedBusinessIds}
                  handleSelectBusiness={props.handleSelectBusiness}
                  handleSelectAllBusiness={props.handleSelectAllBusiness}
                  handleSelectEveryBusiness={props.handleSelectEveryBusiness}
                  handleChangeBusinessPage={props.handleChangeBusinessPage}
                  searchBusinesses={props.searchBusinesses}
                  actionState={actionState}
                  onSave={() => handleUpdateClick?.({ businesses: selectedBusinessIds })}
                />
              </TabPanel>
            )}
          </Tabs>
        </div>
      </RecordPanel>

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={t('AD_BANNERS_DELETE_TITLE', 'Delete "_name_"?').replace('_name_', () => name)}
        confirmLabel={t('AD_BANNERS_DELETE', 'Delete banner')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteOpen(false) }}
      >
        {t('AD_BANNERS_DELETE_BODY', "It stops showing on _position_. This can't be undone.").replace('_position_', () => text.title)}
      </ConfirmDialog>
    </>
  )
}

const BannerPanelUI = (props) => {
  // Mirrors the controller: an empty record is a new banner (its own `isAddMode` arrives one effect later, after a first frame
  // that would otherwise paint the view of nothing)
  const creating = props.isAddMode || !hasKeys(props.banner)
  return creating ? <BannerCreate {...props} /> : <BannerView {...props} />
}

/**
 * The panel of a banner (redesign AB-B3). Props:
 *  - `banner`: the list's current row, or the stable `EMPTY` object to create one in `position`;
 *  - `position`: the D/bannerPositions object of the banner's position (`key`, `group`, `isBusinessPage`, `aspectRatio`, …);
 *  - `handleSuccessUpdate`, `handleSuccessAdd`, `handleSuccessDelete`: the list controller's, forwarded to K/BannerDetails;
 *  - `toggle`: the result of `useBannerEnabledToggle` (`setEnabled(banner, next) → Promise<{ ok, error }>`); its alert is the host's;
 *  - `onClose()`: the controller calls it after a create or a delete; the host decides what «close» means (focus included);
 *  - `onCreated(banner)`: the new banner, after a create that worked, for the host to open it;
 *  - `onDirtyChange(dirty)`: the create form has text, or the view's chosen businesses differ from the saved ones (false when it is
 *    clean again, leaves create mode or unmounts), for the page's discard guard;
 *  - `expanded`, `onExpandedChange(next)`.
 * It mounts K/BannerDetails with `BannerPanelUI`; opening another banner or position mounts it again (its state is per banner).
 */
export const BannerPanel = (props) => {
  const { banner, position } = props
  return (
    <BannerDetailsController
      key={`${banner?.id ?? 'new'}:${position?.key ?? ''}`}
      {...props}
      banner={banner ?? EMPTY_BANNER}
      defaultPosition={position?.key}
      UIComponent={BannerPanelUI}
    />
  )
}
