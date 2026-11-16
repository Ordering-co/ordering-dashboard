import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils } from '~components'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { SnoozeComponent } from '../SnoozeComponent'
import { useStoreDeactivateConfirm } from '../../../hooks/useStoreDeactivateConfirm'
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  Menu,
  Skeleton,
  Status,
  StatusBadge,
  Switch
} from '../../Shared/Product'
import { ArrowLeft, Copy, Ellipsis, Eye, Maximize2, Minimize2, SlidersHorizontal, Trash2, X } from '../../Shared/Icon'
import './store-editor.css'

// redesign SL-F2 (B2)
// The header of the store editor: the store (logo, name, Enabled / Disabled and its switch), the stream connection, the
// shortcuts (Categories & products, Snooze), Expand, the ⋯ menu and the way out. It is what BusinessSummary drew above its
// overview, and it stays in view when a section is open. It owns the Snooze dialog and the Delete confirmation; everything
// else is a callback of the shell.
//
// @param {object}   props
// @param {boolean}  props.loading                 `businessState.loading`: skeletons instead of the store.
// @param {object}   [props.business]              `businessState.business`. Without it (not found) only the way out is drawn.
// @param {Function} props.handleChangeActiveBusiness  `(enabled) => Promise<{ ok, error } | void>`. The switch shows the value it
//                                                 asks for while it saves and goes back to the stored one if the save did not land.
// @param {Function} props.onOpenCategories        «Categories & products».
// @param {string}   [props.storeUrl]              Public URL of the store; Preview is disabled without it.
// @param {Function} props.onOpenSite              Preview.
// @param {boolean}  props.isAllowRegisteredBusiness  Duplicate is only in the menu when true (canRegisterStores, ).
// @param {Function} props.handleDuplicateBusiness   `() => Promise<{ ok } | void>`. redesign stores 4.B (decision 6, G1-27): asked first,
//                                                 and the confirmation stays busy (no second copy) until it answers.
// @param {Function} props.handleDeleteBusiness
// @param {Function} props.onSelectSection         `(id) => void`: «Custom fields» opens that section.
// @param {boolean}  [props.showCustomFields=true]  redesign bugs C (): «Custom fields» is in the menu only when
//                                                 true (the shell asks `isCustomFieldsShortcutOffered`).
// @param {object}   props.formState, props.setFormState, props.handleUpdateBusinessClick  What SnoozeComponent writes and saves.
// @param {{enabled?: boolean, loading?: boolean, status?: string}} [props.streamConnectionState]
// @param {boolean}  props.showExpand              Expand / Collapse is only offered when true (window > 576px and no section open).
// @param {boolean}  props.isExpand
// @param {Function} props.onToggleExpand
// @param {boolean}  props.isExtendExtraOpen       A section asked for the whole width: «All sections» is drawn.
// @param {Function} props.onShowAllSections
// @param {Function} props.onClose

const STREAM_FAMILY = {
  connected: 'done',
  paused: 'pending',
  disconnected: 'cancel'
}

export const StoreEditorHeader = ({
  loading,
  business,
  handleChangeActiveBusiness,
  onOpenCategories,
  storeUrl,
  onOpenSite,
  isAllowRegisteredBusiness,
  handleDuplicateBusiness,
  handleDeleteBusiness,
  onSelectSection,
  showCustomFields = true,
  formState,
  setFormState,
  handleUpdateBusinessClick,
  streamConnectionState,
  showExpand,
  isExpand,
  onToggleExpand,
  isExtendExtraOpen,
  onShowAllSections,
  onClose,
  titleId
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [pendingEnabled, setPendingEnabled] = useState(null)
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [duplicateState, setDuplicateState] = useState({ open: false, busy: false })
  const deactivate = useStoreDeactivateConfirm()
  const asking = useRef(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // redesign tanda AB (S-2): on a phone the panel is full screen and its way out is a Back arrow at the start
  // (as Orders and Customers: ArrowLeft, flipInRtl, «Back»); from 768px it stays the «×» at the end. Same handler either way.
  const isPhone = useIsPhone()
  const backButton = isPhone && (
    <IconButton icon={ArrowLeft} flipInRtl label={t('BACK', 'Back')} onClick={onClose} />
  )
  const closeButton = !isPhone && (
    <IconButton icon={X} label={t('CLOSE', 'Close')} onClick={onClose} />
  )

  // Not found: nothing to act on, only the way out
  if (!loading && !business) {
    return (
      <header className='odc-se-head'>
        <div className='odc-se-head-row'>
          {backButton}
          <h2 id={titleId} className='odc-se-title'>{t('STORE', 'Store')}</h2>
          <span className='odc-se-spacer' />
          {closeButton && <div className='odc-se-actions'>{closeButton}</div>}
        </div>
      </header>
    )
  }

  const name = business?.name
  const enabled = pendingEnabled ?? !!business?.enabled

  // The switch shows what was asked while it saves. Whatever the save returns, it goes back to the stored value: that one
  // is already the new one when the save landed (the controller writes it) and the old one when it did not.
  // redesign (owner decision 31 A): switching the store off asks first (the switch stays on, not busy, while it asks);
  // switching it on does not. A second press while it saves or asks does nothing.
  const handleToggle = async (next) => {
    if (pendingEnabled !== null || asking.current) return
    if (!next) {
      asking.current = true
      const confirmed = await deactivate.confirmChange(next, name)
      asking.current = false
      if (!confirmed || !mounted.current) return
    }
    setPendingEnabled(next)
    try {
      await handleChangeActiveBusiness(next)
    } catch (error) {
      // the controller reports its own failures in `actionStatus` (the shell's alert); here the switch only goes back
    } finally {
      if (mounted.current) setPendingEnabled(null)
    }
  }

  // The copy is created when the API answers; until then the confirmation stays open and busy. Whatever it answers, it
  // closes: a failure is the shell's alert (`actionStatus`), a success the controller's toast naming the copy.
  const handleConfirmDuplicate = async () => {
    if (duplicateState.busy) return
    setDuplicateState({ open: true, busy: true })
    try {
      await handleDuplicateBusiness()
    } finally {
      if (mounted.current) setDuplicateState({ open: false, busy: false })
    }
  }

  const handleCategoriesClick = (event) => {
    if (loading) {
      event.preventDefault()
      return
    }
    // Cmd / Ctrl / Shift / Alt or a button other than the main one (the middle click arrives as `auxclick`, which has no handler
    // here): the browser opens the link by itself, and the shell is not asked to leave.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenCategories()
  }

  const streamStatus = streamConnectionState?.status
  const streamLabels = {
    connected: t('CONNECTION_OK', 'Correct connection'),
    paused: t('CONNECTION_PAUSED', 'Connection paused'),
    disconnected: t('CONNECTION_DISCONNECTED', 'Connection disconnected')
  }

  const menuItems = [
    {
      key: 'preview',
      label: t('PREVIEW', 'Preview'),
      icon: Eye,
      disabled: !storeUrl || loading,
      onSelect: onOpenSite
    },
    ...(isAllowRegisteredBusiness
      ? [{
          key: 'duplicate',
          label: t('DUPLICATE', 'Duplicate'),
          icon: Copy,
          disabled: duplicateState.busy,
          onSelect: () => setDuplicateState({ open: true, busy: false })
        }]
      : []),
    ...(showCustomFields
      ? [{
          key: 'custom_fields',
          label: t('CUSTOM_FIELDS', 'Custom fields'),
          icon: SlidersHorizontal,
          onSelect: () => onSelectSection('custom_fields')
        }]
      : []),
    {
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      separatorBefore: true,
      onSelect: () => setIsDeleteOpen(true)
    }
  ]

  return (
    <header className='odc-se-head'>
      <div className='odc-se-head-row'>
        {backButton}
        {loading
          ? (
            <>
              <Skeleton size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' shape='box' />
              <h2 id={titleId} className='odc-se-title'>
                <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
                <Skeleton size='var(--od-x-cell-person)' />
              </h2>
            </>
            )
          : (
            <>
              <Avatar
                kind='business'
                size='lg'
                name={name}
                src={optimizeImage(business?.logo, 'h_100,c_limit') || undefined}
              />
              <h2 id={titleId} className='odc-se-title' title={name}>{name}</h2>
              <StatusBadge
                family={enabled ? 'done' : 'cancel'}
                label={enabled ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')}
              />
              <Switch
                label={t('ENABLE', 'Enable')}
                checked={enabled}
                busy={pendingEnabled !== null}
                onCheckedChange={handleToggle}
              />
            </>
            )}
        <span className='odc-se-spacer' />
        <div className='odc-se-actions'>
          {showExpand && (
            <IconButton
              icon={isExpand ? Minimize2 : Maximize2}
              label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
              onClick={onToggleExpand}
            />
          )}
          <Menu icon={Ellipsis} label={t('MORE_ACTIONS', 'More actions')} items={menuItems} />
          {closeButton}
        </div>
      </div>
      <div className='odc-se-head-tools'>
        {isExtendExtraOpen && (
          <Button icon={ArrowLeft} onClick={onShowAllSections}>{t('ALL_SECTIONS', 'All sections')}</Button>
        )}
        {/* redesign bugs Q: a real link, as it was in main (a new tab, copy link). A plain click is the shell's
            (it asks before leaving with unsaved changes, G5-48); a modified or middle click is the browser's. */}
        <a
          className='odc-btn'
          data-variant='secondary'
          data-size='md'
          href={loading || !business?.slug ? undefined : `/stores/products/${business.slug}`}
          role='link'
          aria-disabled={loading || undefined}
          tabIndex={loading ? -1 : undefined}
          onClick={handleCategoriesClick}
        >
          {t('CATEGORIES_AND_PRODUCTS', 'Categories & products')}
        </a>
        <Button disabled={loading} onClick={() => setIsSnoozeOpen(true)}>{t('SNOOZE', 'Snooze')}</Button>
        {streamConnectionState?.enabled && !loading && (
          <>
            {streamConnectionState.loading && <Skeleton size='var(--od-x-cell-person)' block='var(--od-x-badge-height)' />}
            {streamStatus && (
              <Status
                family={STREAM_FAMILY[streamStatus] || 'progress'}
                label={streamLabels[streamStatus] || t('CONNECTION', 'Connection')}
              />
            )}
          </>
        )}
      </div>
      <Dialog
        open={isSnoozeOpen}
        onOpenChange={setIsSnoozeOpen}
        size='lg'
        title={t('SNOOZE', 'Snooze')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <SnoozeComponent
          dataState={business}
          // redesign bugs C: the store's clock, as the Overview reads the snooze
          timeZone={business?.timezone}
          handleUpdate={handleUpdateBusinessClick}
          setFormState={setFormState}
          formState={formState}
          onClose={() => setIsSnoozeOpen(false)}
        />
      </Dialog>
      <ConfirmDialog
        open={duplicateState.open}
        tone='primary'
        busy={duplicateState.busy}
        title={t('STORE_EDITOR_DUPLICATE_TITLE', 'Duplicate _name_?').replace('_name_', name || '')}
        confirmLabel={t('STORE_EDITOR_DUPLICATE_CONFIRM', 'Duplicate store')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDuplicateState({ open: false, busy: false })}
        onConfirm={handleConfirmDuplicate}
      >
        {t('STORE_EDITOR_DUPLICATE_DESCRIPTION', 'This creates a new store, a copy of this one, and adds it to your stores. This store does not change.')}
      </ConfirmDialog>
      <ConfirmDialog
        open={isDeleteOpen}
        title={t('STORE_EDITOR_DELETE_TITLE', 'Delete _name_?').replace('_name_', name || '')}
        confirmLabel={t('STORE_EDITOR_DELETE_CONFIRM', 'Delete store')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          setIsDeleteOpen(false)
          handleDeleteBusiness()
        }}
      >
        {t('QUESTION_DELETE_BUSINESS', 'Are you sure that you want to delete this business?')}
      </ConfirmDialog>
      {deactivate.dialog}
    </header>
  )
}
