import React, { useEffect, useId, useRef, useState } from 'react'

import { BusinessManagerBusinesses, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { CircleAlert } from '../../Shared/Icon'
import {
  AlertDialog,
  Button,
  Checkbox,
  EmptyState,
  SaveBar,
  SelectableList,
  Skeleton
} from '../../Shared/Product'
import './staff-stores.css'

// redesign BO-B5 (decision 6; BO-1, BO-2, BO-3, BO-9): the Stores section of a staff record (a business owner's businesses; a call
// center agent's `businesses_agent` when moves). One composition on K/BusinessManagerBusinesses, which keeps the
// selection, the saved ids and the names: the assigned stores on top, the catalog to add from below, one save bar. It does not
// use S/SelectBusinesses (other pages share that one). The section decides nothing the controller owns: it only shows its state
// and reports each action once.

const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 5

const plain = (template, count) => String(template).replace('_count_', () => String(count))
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// The API answers a list of messages, one text or nothing; each one through the project's translation of its key
const messagesOf = (error, t, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter((message) => typeof message === 'string' && message.trim())
  const texts = [...new Set(list.map((message) => translateApiMessage(t, message, fallback)))]
  return texts.length ? texts : [fallback]
}

const RowsSkeleton = ({ label, rows = SKELETON_ROWS }) => (
  <div className='sds-skeleton' role='status' aria-busy='true'>
    <span className='odc-sr-only'>{label}</span>
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className='sds-skeleton-row'>
        <Skeleton shape='box' size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
        <Skeleton size='40%' />
      </div>
    ))}
  </div>
)

/** The body of the section, the `UIComponent` of `K/BusinessManagerBusinesses`. */
const StoresBody = ({
  userId,
  storesKey,
  onDirtyChange,
  onSaved,
  selectedBusinessIds,
  savedBusinessIds,
  soleOwnedBusinessIds,
  businessNames,
  assignedBusinesses,
  assignedState,
  reloadAssigned,
  businessesState,
  businessesPaginationProps,
  searchBusinesses,
  handleChangeBusinessPage,
  handleChangeBusinessPageSize,
  reloadBusinesses,
  handleSelectBusiness,
  handleSelectPageBusinesses,
  handleSelectAllBusiness,
  handleSetSelectedBusinessIds,
  handleUpdateBusinesses,
  actionState
}) => {
  const [, t] = useLanguage()
  const ids = { assigned: useId(), add: useId() }

  const selected = selectedBusinessIds || []
  const saved = savedBusinessIds || []
  const added = selected.filter((id) => !saved.includes(id))
  const removed = saved.filter((id) => !selected.includes(id))
  const changes = added.length + removed.length
  const dirty = changes > 0

  const latest = useRef({})
  latest.current = { onDirtyChange, onSaved, searchBusinesses, handleUpdateBusinesses, reloadAssigned, assignedState, selected, businessNames, userId, storesKey }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Unsaved changes: the host learns when the selection differs from what is stored, and that it is clean again on leaving
  const lastDirty = useRef(false)
  useEffect(() => {
    if (dirty === lastDirty.current) return
    lastDirty.current = dirty
    latest.current.onDirtyChange?.(dirty)
  }, [dirty])
  useEffect(() => () => {
    if (lastDirty.current) latest.current.onDirtyChange?.(false)
  }, [])

  // ---- save ----------------------------------------------------------------------------------------------------------------
  // redesign (CA-5, decision 10): when the key the stores are READ from is not the one they are WRITTEN to (`businesses`; an
  // agent's `businesses_agent`), what was sent is not proof of what the server stored. After a good save the section reads the assigned
  // stores again and hands the host what the server answered. `reread.current` is that pending read: `from` is the state it started
  // from (a new state object means the controller answered), `reading` is false once it failed and waits for «Retry».
  const [saving, setSaving] = useState(false)
  const [saveErrors, setSaveErrors] = useState(null)
  const reread = useRef(null)
  const [rereadStatus, setRereadStatus] = useState('idle')
  // R2-1 (review r1): the number of stores the server kept when the second read is not the set that was sent; null when it is (or none yet)
  const [keptCount, setKeptCount] = useState(null)
  const save = async () => {
    if (saving || reread.current?.reading) return
    const { selected: sent, businessNames: names, userId: id, storesKey: key } = latest.current
    setKeptCount(null)
    setSaving(true)
    let outcome
    try {
      outcome = await latest.current.handleUpdateBusinesses()
    } catch (error) {
      outcome = { ok: false, error: null }
    }
    if (!mounted.current) return
    if (outcome?.ok) {
      setSaveErrors(null)
      if (key !== 'businesses') {
        reread.current = { from: latest.current.assignedState, reading: true, sent: [...sent] }
        setRereadStatus('reading')
        setSaving(false)
        Promise.resolve(latest.current.reloadAssigned?.()).catch(() => {})
        return
      }
      setSaving(false)
      latest.current.onSaved?.({ id, [key]: sent.map((storeId) => ({ id: storeId, name: names[storeId] ?? `#${storeId}` })) })
    } else {
      setSaving(false)
      setSaveErrors(messagesOf(outcome?.error, t, t('STAFF_STORES_SAVE_ERROR', 'Something went wrong. Try again.')))
    }
  }

  // The answer of the second read: the first state the controller gives that is not the one the read started from and is not loading
  useEffect(() => {
    const waiting = reread.current
    if (!waiting || assignedState === waiting.from || assignedState?.loading) return
    const { onSaved: report, userId: id, storesKey: key, businessNames: names } = latest.current
    if (assignedState?.loaded) {
      const readIds = new Set((assignedBusinesses || []).map((store) => store.id))
      const sentIds = new Set(waiting.sent)
      const same = readIds.size === sentIds.size && [...readIds].every((storeId) => sentIds.has(storeId))
      reread.current = null
      setRereadStatus('idle')
      setKeptCount(same ? null : readIds.size)
      report?.({
        id,
        [key]: (assignedBusinesses || []).map((store) => ({ id: store.id, name: store.name || names?.[store.id] || `#${store.id}` }))
      })
    } else if (assignedState?.error) {
      waiting.from = assignedState
      waiting.reading = false
      setRereadStatus('failed')
    }
  }, [assignedState, assignedBusinesses])

  const nameOf = (id) => businessNames?.[id] ?? `#${id}`

  // (decision 12c): a store keeps at least one owner, so a saved store this user is the only owner of stays ticked, here
  // and in the catalog, with the same line as the store's Owners. «Select none» leaves them.
  const kept = (soleOwnedBusinessIds || []).filter((id) => saved.includes(id))

  // Any change of the selection the person makes takes the notice of the last save away
  const touch = (action) => (...args) => {
    setKeptCount(null)
    return action?.(...args)
  }
  const selectBusiness = touch((id, next) => (next || !kept.includes(id)) && handleSelectBusiness?.(id, next))
  const selectPage = touch(handleSelectPageBusinesses)
  const selectAll = touch((all) => (all || !kept.length ? handleSelectAllBusiness?.(all) : handleSetSelectedBusinessIds?.(kept)))
  const setSelection = touch(handleSetSelectedBusinessIds)

  // ---- which state the assigned stores are in (BO-9) -------------------------------------------------------------------------
  // Before the controller's first read starts, `loaded` and `loading` are both false and there is no error: that is not a failure
  const asked = useRef(false)
  if (assignedState?.loading) asked.current = true
  const assignedLoading = Boolean(assignedState?.loading) || (!assignedState?.loaded && !assignedState?.error && !asked.current)
  const assignedFailed = !assignedLoading && !assignedState?.loaded

  const labels = {
    assigned: t('STAFF_STORES_ASSIGNED', 'Assigned stores'),
    add: t('STAFF_STORES_ADD', 'Add stores'),
    loading: t('LOADING', 'Loading')
  }

  if (assignedFailed) {
    return (
      <div className='sds-root'>
        {rereadStatus === 'failed' && (
          <p className='sds-hint' role='alert'>
            {t('STAFF_STORES_REREAD_ERROR', "The stores were saved, but we couldn't read them back. Retry to see what was assigned.")}
          </p>
        )}
        <EmptyState
          tone='error'
          icon={CircleAlert}
          title={t('STAFF_STORES_ASSIGNED_LOAD_ERROR', "We couldn't load the assigned stores. Nothing can change until they load.")}
          action={<Button onClick={() => reloadAssigned?.()}>{t('RETRY', 'Retry')}</Button>}
        />
      </div>
    )
  }

  // ---- the assigned block ----------------------------------------------------------------------------------------------------
  // The saved stores keep their place (a removed one stays, struck out) and the added ones follow
  const rows = [...saved.map((id) => ({ id, state: selected.includes(id) ? 'kept' : 'removed' })), ...added.map((id) => ({ id, state: 'added' }))]
  const assignedBlock = (
    <section className='sds-block' aria-labelledby={ids.assigned}>
      <div className='sds-block-head'>
        <h3 id={ids.assigned} className='sds-title'>{labels.assigned}</h3>
        {!assignedLoading && <span className='sds-count odc-figure'>{selected.length}</span>}
      </div>
      {assignedLoading
        ? <RowsSkeleton label={labels.loading} />
        : rows.length === 0
          ? <p className='sds-hint'>{t('STAFF_STORES_NONE_ASSIGNED', 'No stores assigned yet. Add them below.')}</p>
          : (
            <ul className='sds-list'>
              {rows.map(({ id, state }) => {
                const noteId = `${ids.assigned}-${id}`
                const lastOwner = state === 'kept' && kept.includes(id)
                return (
                  <li key={id} className='sds-row' data-state={state}>
                    <Checkbox
                      checked={state !== 'removed'}
                      disabled={lastOwner}
                      onCheckedChange={(next) => selectBusiness(id, next)}
                      aria-describedby={state === 'kept' && !lastOwner ? undefined : noteId}
                    >
                      <bdi className='sds-name'>{nameOf(id)}</bdi>
                    </Checkbox>
                    {lastOwner && <span id={noteId} className='sds-note'>{t('STORE_NEEDS_ONE_OWNER', 'A store needs at least one owner.')}</span>}
                    {state !== 'kept' && (
                      <span id={noteId} className='sds-note'>
                        {state === 'removed' ? t('STAFF_STORES_WILL_REMOVE', 'Will be removed') : t('STAFF_STORES_WILL_ADD', 'Will be added')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            )}
    </section>
  )

  // ---- the catalog block ---------------------------------------------------------------------------------------------------------
  const catalog = businessesState?.businesses || []
  const catalogLoading = Boolean(businessesState?.loading)
  const catalogFailed = !catalogLoading && Boolean(businessesState?.error)
  const total = businessesPaginationProps?.totalItems
  const pageSize = businessesPaginationProps?.pageSize

  const addBlock = (
    <section className='sds-block' aria-labelledby={ids.add}>
      <div className='sds-block-head'>
        <h3 id={ids.add} className='sds-title'>{labels.add}</h3>
      </div>
      {/* redesign the catalog is P/SelectableList, promoted from this block */}
      <SelectableList
        label={labels.add}
        items={catalog.map((store) => ({ id: store.id, name: store.name ?? nameOf(store.id) }))}
        selectedIds={selected}
        onToggle={selectBusiness}
        locked={assignedLoading}
        lockedIds={kept}
        loading={assignedLoading || catalogLoading}
        loadingLabel={labels.loading}
        skeletonRows={assignedLoading ? undefined : Math.min(pageSize || SKELETON_ROWS, PAGE_SIZES[0])}
        emptyTitle={t('STAFF_STORES_NO_MATCH', 'No stores match this search')}
        error={catalogFailed}
        errorTitle={t('STAFF_STORES_LOAD_ERROR', "We couldn't load the stores.")}
        retryLabel={t('RETRY', 'Retry')}
        onRetry={() => reloadBusinesses?.()}
        onSearch={(text) => latest.current.searchBusinesses?.(text)}
        searchLabel={t('STAFF_STORES_SEARCH', 'Search stores')}
        clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
        onSelectAll={() => selectPage()}
        selectAllLabel={t('STAFF_STORES_SELECT_PAGE', 'Select all on this page')}
        onSelectNone={() => selectAll(false)}
        selectNoneLabel={t('SELECT_NONE', 'Select none')}
        pagination={assignedLoading || total == null
          ? undefined
          : {
              page: businessesPaginationProps.currentPage,
              pageSize,
              total,
              pageSizeOptions: PAGE_SIZES,
              onPageChange: (page) => handleChangeBusinessPage(page),
              onPageSizeChange: (size) => handleChangeBusinessPageSize(size),
              label: t('PAGINATION', 'Pagination'),
              previousLabel: t('PREVIOUS_PAGE', 'Previous page'),
              nextLabel: t('NEXT_PAGE', 'Next page'),
              pageSizeLabel: t('ITEMS_PER_PAGE', 'Items per page'),
              pageLabel: t('PAGE', 'Page'),
              rangeLabel: (from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) }),
              pageStatusLabel: (current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))
            }}
      />
    </section>
  )

  return (
    <div className='sds-root' tabIndex={-1}>
      {keptCount !== null && (
        <p className='sds-hint' role='status'>
          {plain(t('STAFF_STORES_REREAD_MISMATCH', 'Saved, but the server kept _count_ stores for this user. What you see is what it has.'), keptCount)}
        </p>
      )}
      {assignedBlock}
      {addBlock}
      {/* the controller's `actionState.loading` is also true while it reads the assigned stores: no bar until they are in */}
      {(!assignedLoading || rereadStatus === 'reading') && (
        <SaveBar
          label={t('STAFF_STORES', 'Stores')}
          count={changes}
          countText={changes === 1 ? t('STAFF_STORES_CHANGES_ONE', '1 change') : plain(t('STAFF_STORES_CHANGES_OTHER', '_count_ changes'), changes)}
          saving={saving || rereadStatus === 'reading' || Boolean(actionState?.loading)}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={t('STAFF_STORES_SAVE', 'Save stores')}
          onDiscard={() => setSelection(saved)}
          onSave={save}
          formSelector='.sds-root'
        />
      )}
      <AlertDialog
        open={!!saveErrors}
        title={t('STAFF_STORES_SAVE_ERROR_TITLE', "The stores weren't saved")}
        content={saveErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setSaveErrors(null)}
      />
    </div>
  )
}

/**
 * The Stores section. `userId` is the record, `storesKey` the user's property that holds the stores (`kind.storesKey`),
 * `onDirtyChange(boolean)` tells whether the selection differs from what is stored, and `onSaved({ id, [storesKey]: [{ id, name }] })`
 * hands the host the stores that were stored so it can update the row without asking again. With `storesKey === 'businesses'` those are the
 * ids that were sent; with any other key (an agent's `businesses_agent`, which is read from one key and written to another) the section reads
 * the assigned stores again after a good save and hands over what the server answered; if that read fails nothing is reported until a
 * «Retry» reads them.
 */
export const StaffStoresSection = ({ userId, storesKey = 'businesses', onDirtyChange, onSaved }) => (
  <BusinessManagerBusinesses
    key={`${storesKey}-${userId ?? ''}`}
    userId={userId}
    typeBusinessPropToFetch={storesKey}
    storesKey={storesKey}
    onDirtyChange={onDirtyChange}
    onSaved={onSaved}
    UIComponent={StoresBody}
  />
)
