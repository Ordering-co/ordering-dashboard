import React, { useEffect, useId, useRef, useState } from 'react'
import {
  useLanguage,
  EnterprisePromotionDetails as EnterprisePromotionDetailsController
} from '../../../../../index'
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
  SectionNav,
  Skeleton,
  Switch,
  useSplitView
} from '../../Shared/Product'
import { SelectBusinesses, SelectSites, SelectUsers, SelectLoyaltyLevels } from '../../Shared'
import { EnterprisePromotionGeneralDetails } from '../EnterprisePromotionGeneralDetails'
import { EnterprisePromotionRules } from '../EnterprisePromotionRules'
import './promotion-panel.css'

// redesign PE-B3 (decisions 5, 9 and 17; decision 35; PE-07, PE-13, PE-14, PE-16, PE-18): the advanced editor of a promotion, a RecordPanel with
// a SectionNav that the page mounts inside its SplitView (as the campaigns page mounts CampaignPanel). It is the UIComponent of
// K/EnterprisePromotionDetails and keeps what main did: one section at a time (Rules stages `{ rate_type, target }` when it mounts, so mounting
// them all would dirty every record), each section with its own Save and the >100% check when leaving Rules. Main's auto-save of a change of
// businesses when the section changed (PE-11) is gone (n.º 2, D-56 b, owner P-4, 2026-10-20). What is new: the discard guard, the delete confirmation that
// names the offer, a skeleton and a retry while the record loads, and «Open as page» instead of the `#sideSlider` DOM hack.

const has = (changes, key) => Object.prototype.hasOwnProperty.call(changes, key)

// The same staged changes always give the same text, whatever the order the keys were staged in
const stableKey = (value) => JSON.stringify(value, (_key, item) => (
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item
))

// What Rules stages by itself when it mounts on an offer whose condition type is not Subtotal (inventory D10): a mount, not an edit
const RULES_MOUNT_STAGING = { rate_type: 2, target: 1 }

// The staged changes as they are compared with the snapshot: Rules' mount-time staging is not a change the user made
const comparable = (changes, record) => {
  const staged = { ...changes }
  const condition = has(staged, 'condition_type') ? staged.condition_type : record?.condition_type
  if (
    condition !== 1 &&
    staged.rate_type === RULES_MOUNT_STAGING.rate_type &&
    staged.target === RULES_MOUNT_STAGING.target
  ) {
    delete staged.rate_type
    delete staged.target
  }
  return stableKey(staged)
}

// Lines of text out of what the API left as an error: a string, a list of strings or a list of lists
const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error.flat(Infinity) : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// The panel is wide when the PANEL is, not when its own column is (a stable function: SectionNav sets its observer up again when it changes)
const measurePanel = (root) => root.closest('.odc-record')

const BodySkeleton = ({ label }) => (
  <div className='odc-promo-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

const EnterprisePromotionDetailsUI = (props) => {
  const {
    isAddMode,
    promotionState,
    formState,
    actionState,
    handleChangeItem,
    sitesState,
    handleSelectSite,
    handleUpdateClick,
    handleAddPromotion,
    handleSelectAllSites,
    selectedSitesIds,
    selectedBusinessIds,
    isSelectingAllBusinesses,
    businessesList,
    businessesPaginationProps,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    handleSelectBusiness,
    handleSelectAllBusiness,
    handleDeletePromotion,
    selectedUserIds,
    handleSelectUser,
    selectedLoyaltyLevelIds,
    handleSelectLoyaltyLevel,
    handleSelectAllLoyaltyLevels,
    handleSelectAllUsers,
    getPromotion,
    onClose,
    expanded = false,
    onExpandedChange,
    onDirtyChange,
    panelRef
  } = props

  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const [selectedOption, setSelectedOption] = useState('general')
  const [rateAlert, setRateAlert] = useState({ open: false, content: [] })
  const [saveAlert, setSaveAlert] = useState({ open: false, content: [] })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const changes = formState?.changes || {}
  const record = promotionState?.promotion
  const hasRecord = record?.id != null
  const adding = !!isAddMode
  const failed = !adding && !hasRecord && hasError(promotionState?.error)
  // redesign PE-B3 (PE-13): a record that is not on the loaded page has no id until its GET answers
  const loading = !adding && !failed && (!!promotionState?.loading || !hasRecord)

  // ---- the discard guard (decision 17, PE-16) ----
  // The snapshot is the staged changes once the record (edit) or the defaults of a new offer (add) are in place, and again after a save that
  // worked. Rules' mount-time staging does not count as a change (see `comparable`).
  const [snapshot, setSnapshot] = useState(null)
  const recordKey = adding ? 'new' : String(record?.id ?? props.promotionId ?? '')
  const recordKeyRef = useRef(recordKey)
  useEffect(() => {
    if (recordKeyRef.current === recordKey) return
    recordKeyRef.current = recordKey
    setSnapshot(null)
  }, [recordKey])

  const ready = adding ? Object.keys(changes).length > 0 : hasRecord && !loading
  useEffect(() => {
    if (snapshot === null && ready) setSnapshot(comparable(changes, record))
  }, [snapshot, ready])

  // redesign (row 20b): a save that worked clears the staged changes, so «Save» turns disabled (it stays `disabled`, not
  // aria-disabled) and takes the focus with it. When that leaves the focus on <body>, it goes to the panel itself. A focus that is
  // somewhere else (a dialog, another field) is left alone.
  const panelId = useId()
  const wasSaving = useRef(false)
  useEffect(() => {
    let frame = 0
    if (wasSaving.current && !actionState?.loading && !actionState?.error) {
      setSnapshot(comparable(changes, record))
      frame = window.requestAnimationFrame(() => {
        const active = document.activeElement
        if (active && active !== document.body && active.isConnected && !active.disabled) return
        document.getElementById(panelId)?.focus({ preventScroll: true })
      })
    }
    wasSaving.current = !!actionState?.loading
    return () => window.cancelAnimationFrame(frame)
  }, [actionState?.loading, actionState?.error])

  const dirty = snapshot !== null && comparable(changes, record) !== snapshot

  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  useEffect(() => {
    dirtyRef.current?.(dirty)
  }, [dirty])
  useEffect(() => () => { dirtyRef.current?.(false) }, [])

  // ---- sections ----
  const sectionItems = [
    { id: 'general', label: t('GENERAL', 'General') },
    { id: 'sites', label: t('SITES', 'Sites') },
    { id: 'businesses', label: t('CONTROL_PANEL_BUSINESS', 'Business') },
    { id: 'users', label: t('USERS', 'Users') },
    { id: 'loyalty_levels', label: t('LOYALTY_LEVELS', 'Loyalty Levels') },
    { id: 'rules', label: t('RULES', 'Rules') }
  ]

  const handleCheckDiscountPercentageValidation = () => {
    const rateType = changes.rate_type ?? record?.rate_type
    const rate = changes.rate ?? record?.rate ?? ''
    if (rateType === 1 && parseFloat(rate) > 100) {
      // The field gets the focus first: it is where the alert opens from, so it is where the focus comes back to when it closes
      document.getElementById('discount_value')?.focus()
      setRateAlert({
        open: true,
        content: [
          t('VALIDATION_ERROR_MAX_NUMERIC', 'The _attribute_ may not be greater than _max_.')
            .replace('_attribute_', t('DISCOUNT_PERCENTAGE', 'Discount percentage'))
            .replace('_max_', 100)
        ]
      })
      return false
    }
    return true
  }

  // main's handleClickTab without its auto-save: the percentage check when leaving Rules, then the section. n.º 2, D-56 (b),
  // promotions-enterprise P-4 (owner, 2026-10-20): main saved the staged businesses here (PE-11); now only «Save» writes, and what is
  // staged stays pending (the discard guard asks on the way out).
  const handleClickTab = (option) => {
    if (selectedOption === 'rules') {
      const isValid = handleCheckDiscountPercentageValidation()
      if (!isValid) return
    }
    setSelectedOption(option)
  }

  const closeRateAlert = () => {
    setRateAlert({ open: false, content: [] })
    document.getElementById('discount_value')?.focus()
  }

  // ---- errors of a save (the delete has its own, inside its confirmation) ----
  const deletingRef = useRef(false)
  const deleteErrorRef = useRef(null)
  useEffect(() => {
    if (!actionState?.error || actionState.loading) return
    if (deletingRef.current || actionState.error === deleteErrorRef.current) return
    setSaveAlert({ open: true, content: actionState.error })
  }, [actionState])

  // ---- delete (decision 9, PE-07) ----
  const name = changes.name ?? record?.name
  const title = name || (adding ? t('ADD_PROMOTION', 'Add promotion') : t('PROMOTION', 'Promotion'))
  const deleteFallback = t('PROMOTION_DELETE_ERROR', "We couldn't delete this promotion. Try again.")

  const openDelete = () => {
    setDeleteErrors(null)
    setDeleteOpen(true)
  }
  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteErrors(null)
    deletingRef.current = true
    let result
    try {
      result = await handleDeletePromotion()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    // The controller put this very error in actionState: it belongs to the confirmation, not to the «couldn't save» alert
    deleteErrorRef.current = result?.error ?? null
    deletingRef.current = false
    // On ok the controller told the list and closed the panel; there is nothing left to paint
    if (!mounted.current) return
    setDeleting(false)
    if (result?.ok) setDeleteOpen(false)
    else setDeleteErrors(errorLines(result?.error, deleteFallback))
  }
  const cancelDelete = () => { if (!deleting) setDeleteOpen(false) }

  // ---- header ----
  const showSwitch = adding || hasRecord
  const enabledSwitch = showSwitch && (
    <Switch
      label={t('ENABLE', 'Enable')}
      checked={typeof changes.enabled !== 'undefined' ? !!changes.enabled : !!(record?.enabled ?? false)}
      onCheckedChange={next => handleChangeItem({ enabled: next })}
    />
  )
  const expandAction = !phone && onExpandedChange && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
    />
  )
  const menu = !adding && hasRecord && (
    <Menu
      label={t('MORE_ACTIONS', 'More actions')}
      icon={Ellipsis}
      items={[{
        key: 'delete',
        label: t('DELETE', 'Delete'),
        icon: Trash2,
        tone: 'danger',
        onSelect: openDelete
      }]}
    />
  )
  const headerActions = (enabledSwitch || expandAction || menu) ? <>{enabledSwitch}{expandAction}{menu}</> : undefined

  const discard = {
    discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
    discardDescription: t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
    discardConfirmLabel: t('DISCARD', 'Discard'),
    keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
  }

  // ---- body ----
  const saveDisabled = Object.keys(changes).length === 0 || actionState.loading
  let body
  if (failed) {
    const first = (Array.isArray(promotionState.error) ? promotionState.error.flat(Infinity) : [promotionState.error])
      .map(item => (typeof item === 'string' ? item : item?.message))
      .find(Boolean)
    body = (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('PROMOTION_LOAD_ERROR', "We couldn't load this promotion.")}
        description={translateApiMessage(t, first, undefined)}
        action={getPromotion && <Button onClick={() => getPromotion()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (loading) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else {
    body = (
      <div className='odc-promo-section'>
        {selectedOption === 'general' && (
          <EnterprisePromotionGeneralDetails
            {...props}
            handleUpdateClick={handleUpdateClick}
            handleAddPromotion={handleAddPromotion}
          />
        )}
        {selectedOption === 'sites' && (
          <SelectSites
            isAddMode={isAddMode}
            allSites={sitesState.sites}
            selectedSitesIds={selectedSitesIds}
            handleSelectSite={handleSelectSite}
            handleSelectAllSites={() => handleSelectAllSites(true)}
            handleSelectNoneSites={() => handleSelectAllSites(false)}
            isDisabled={saveDisabled}
            handleUpdateClick={handleUpdateClick}
            handleAddClick={handleAddPromotion}
          />
        )}
        {selectedOption === 'businesses' && (
          <SelectBusinesses
            isAddMode={isAddMode}
            isSkeleton={businessesList.loading}
            allBusinesses={businessesList.businesses}
            selectedBusinessIds={selectedBusinessIds}
            handleSelectBusiness={handleSelectBusiness}
            handleSelectAllBusinesses={() => handleSelectAllBusiness(true)}
            handleSelectNoneBusinesses={() => handleSelectAllBusiness(false)}
            isLocked={!!isSelectingAllBusinesses}
            isDisabled={saveDisabled || !!isSelectingAllBusinesses}
            handleUpdateClick={handleUpdateClick}
            handleAddClick={handleAddPromotion}
            searchBusinesses={searchBusinesses}
            handleChangeBusinessPage={handleChangeBusinessPage}
            handleChangeBusinessPageSize={handleChangeBusinessPageSize}
            businessesPaginationProps={businessesPaginationProps}
          />
        )}
        {selectedOption === 'users' && (
          <SelectUsers
            isAddMode={isAddMode}
            isDisabled={saveDisabled}
            selectedUserIds={selectedUserIds}
            handleSelectUser={handleSelectUser}
            handleUpdateClick={handleUpdateClick}
            handleAddPromotion={handleAddPromotion}
            handleSelectAllUsers={handleSelectAllUsers}
          />
        )}
        {selectedOption === 'loyalty_levels' && (
          <SelectLoyaltyLevels
            isAddMode={isAddMode}
            isDisabled={saveDisabled}
            selectedLoyaltyLevelIds={selectedLoyaltyLevelIds}
            handleSelectLoyaltyLevel={handleSelectLoyaltyLevel}
            handleSelectAllLoyaltyLevels={handleSelectAllLoyaltyLevels}
            handleUpdateClick={handleUpdateClick}
            handleAddPromotion={handleAddPromotion}
          />
        )}
        {selectedOption === 'rules' && (
          <EnterprisePromotionRules
            {...props}
            isExpand={expanded}
            handleUpdateClick={handleUpdateClick}
            handleAddPromotion={handleAddPromotion}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <RecordPanel
        ref={panelRef}
        title={loading ? <span className='odc-promo-title-skeleton'><Skeleton /></span> : title}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
        nav={failed || loading
          ? undefined
          : (
          <SectionNav
            label={t('PROMOTION_SECTIONS', 'Promotion sections')}
            compactLabel={t('SECTION', 'Section')}
            items={sectionItems}
            value={selectedOption}
            onValueChange={handleClickTab}
            wideMinWidth={400} // redesign review r1 (R2): the list from the docked panel (440px at 1280, 520 at 1440) up, so changing section is one click as the tabs of main
            measureTarget={measurePanel}
          />
            )}
        dirty={dirty}
        id={panelId}
        tabIndex={-1}
        {...discard}
      >
        {body}
      </RecordPanel>

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={t('PROMOTION_DELETE_TITLE', 'Delete "_name_"?').replace('_name_', () => title)}
        confirmLabel={t('PROMOTION_DELETE_CONFIRM', 'Delete promotion')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {t('PROMOTION_DELETE_BODY', "This can't be undone.")}
        {deleteErrors && (
          <p role='alert' className='odc-promo-delete-error'>
            {deleteErrors.map(line => translateApiMessage(t, line, line)).join(' ')}
          </p>
        )}
      </ConfirmDialog>

      <AlertDialog
        open={rateAlert.open}
        title={t('DISCOUNT_PERCENTAGE', 'Discount percentage')}
        content={rateAlert.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={closeRateAlert}
      />
      <AlertDialog
        open={saveAlert.open}
        title={t('PROMOTION_SAVE_FAILED_TITLE', "We couldn't save the promotion")}
        content={saveAlert.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setSaveAlert({ open: false, content: [] })}
      />
    </>
  )
}

/**
 * The advanced editor of a promotion (redesign PE-B3). Props, besides the ones the page passes today (`promotion`, `promotionId`,
 * `promotionsList`, `businessesList`, `sitesState` and the `handleSuccess…` of the list):
 *  - `onClose()`; `expanded` and `onExpandedChange(next)` («Open as page», hidden on the phone);
 *  - `onDirtyChange(dirty)`: the unsaved state, for the page's own guard (false when the panel leaves);
 *  - `panelRef`: a ref that gets `{ requestClose }` from the RecordPanel, for a host that closes it outside a SplitView.
 */
export const EnterprisePromotionDetails = (props) => {
  const promotionProps = {
    ...props,
    UIComponent: EnterprisePromotionDetailsUI
  }
  return <EnterprisePromotionDetailsController {...promotionProps} />
}
