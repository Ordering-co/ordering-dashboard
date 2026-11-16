import React, { useEffect, useRef, useState } from 'react'

import { DriverGroupSetting as DriverGroupSettingController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { AlertDialog, SaveBar, SelectableList } from '../../Shared/Product'
import './managed-groups.css'

// redesign (owner, option A): the Managed groups section of a drivers manager, as the Stores section of a staff record:
// the assigned groups on top, every group below, one save bar. Nothing is written until Save; K/DriverGroupSetting reads and writes.

const plain = (template, count) => String(template).replace('_count_', () => String(count))

/** The body of the section, the `UIComponent` of `K/DriverGroupSetting`. */
const ManagedGroupsBody = ({
  label,
  onDirtyChange,
  includedGroupIds,
  driversGroupsState,
  actionState,
  handleSaveAdministrators,
  reloadGroups
}) => {
  const [, t] = useLanguage()
  const [draft, setDraft] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [saveErrors, setSaveErrors] = useState(null)

  const groups = driversGroupsState?.groups || []
  const saved = includedGroupIds || []
  const selected = draft ?? saved
  const added = selected.filter((id) => !saved.includes(id))
  const removed = saved.filter((id) => !selected.includes(id))
  const changes = added.length + removed.length
  const dirty = changes > 0
  const saving = Boolean(actionState?.loading)
  const failedToLoad = !driversGroupsState?.loading && Boolean(driversGroupsState?.error)
  const loading = !failedToLoad && !driversGroupsState?.loaded

  const latest = useRef({})
  latest.current = { onDirtyChange }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Unsaved changes: the panel learns when the selection differs from what is stored, and that it is clean again on leaving
  const lastDirty = useRef(false)
  useEffect(() => {
    if (dirty === lastDirty.current) return
    lastDirty.current = dirty
    latest.current.onDirtyChange?.(dirty)
  }, [dirty])
  useEffect(() => () => {
    if (lastDirty.current) latest.current.onDirtyChange?.(false)
  }, [])

  const toggle = (id, next) => setDraft(next ? [...selected, id] : selected.filter((item) => item !== id))

  const save = async () => {
    const { failed } = await handleSaveAdministrators(selected)
    if (!mounted.current) return
    if (!failed.length) {
      setDraft(null)
      return
    }
    // What was stored leaves the count of changes; what failed stays as a change to try again
    const fallback = t('STAFF_STORES_SAVE_ERROR', 'Something went wrong. Try again.')
    setSaveErrors(failed.map(({ name, errors }) => {
      const list = (Array.isArray(errors) ? errors : [errors]).filter((message) => typeof message === 'string' && message.trim())
      const text = list.length ? list.map((message) => translateApiMessage(t, message, fallback)).join(' ') : fallback
      return `${name}: ${text}`
    }))
  }

  const nameOf = (id) => groups.find((group) => group.id === id)?.name ?? `#${id}`
  const assignedItems = [...saved, ...added].map((id) => ({
    id,
    name: nameOf(id),
    note: added.includes(id)
      ? t('STAFF_STORES_WILL_ADD', 'Will be added')
      : removed.includes(id) ? t('STAFF_STORES_WILL_REMOVE', 'Will be removed') : undefined
  }))
  const search = searchText.trim().toLowerCase()
  const catalog = (search ? groups.filter((group) => group.name?.toLowerCase().includes(search)) : groups)
    .map((group) => ({ id: group.id, name: group.name }))

  const titles = {
    assigned: t('MANAGED_GROUPS_ASSIGNED', 'Assigned'),
    all: t('MANAGED_GROUPS_ALL', 'All groups'),
    loading: t('LOADING', 'Loading')
  }

  return (
    <div className='mgs-root' tabIndex={-1}>
      {!failedToLoad && (
        <section className='mgs-block'>
          <h3 className='mgs-title'>
            {titles.assigned}
            {!loading && <span className='mgs-count'> (<span className='odc-figure'>{selected.length}</span>)</span>}
          </h3>
          {!loading && assignedItems.length === 0
            ? <p className='mgs-hint'>{t('MANAGED_GROUPS_NONE_ASSIGNED', 'No groups assigned yet. Select them below.')}</p>
            : (
              <SelectableList
                label={titles.assigned}
                items={assignedItems}
                selectedIds={selected}
                onToggle={toggle}
                locked={saving}
                loading={loading}
                loadingLabel={titles.loading}
                skeletonRows={2}
                emptyTitle={titles.assigned}
              />
              )}
        </section>
      )}
      <section className='mgs-block'>
        <h3 className='mgs-title'>{titles.all}</h3>
        <SelectableList
          label={titles.all}
          items={catalog}
          selectedIds={selected}
          onToggle={toggle}
          locked={saving}
          loading={loading}
          loadingLabel={titles.loading}
          emptyTitle={search ? t('MANAGED_GROUPS_NO_MATCH', 'No groups match this search') : t('MANAGED_GROUPS_EMPTY', 'No delivery groups yet')}
          error={failedToLoad}
          errorTitle={t('MANAGED_GROUPS_LOAD_ERROR', "We couldn't load the groups.")}
          retryLabel={t('RETRY', 'Retry')}
          onRetry={() => reloadGroups?.()}
          onSearch={setSearchText}
          searchLabel={t('MANAGED_GROUPS_SEARCH', 'Search groups')}
          clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
          onSelectAll={() => setDraft(groups.map((group) => group.id))}
          selectAllLabel={t('SELECT_ALL', 'Select all')}
          onSelectNone={() => setDraft([])}
          selectNoneLabel={t('SELECT_NONE', 'Select none')}
        />
      </section>
      <SaveBar
        label={label ?? t('DRIVERS_MANAGERS_MANAGED_GROUPS', 'Managed groups')}
        count={changes}
        countText={changes === 1 ? t('STAFF_STORES_CHANGES_ONE', '1 change') : plain(t('STAFF_STORES_CHANGES_OTHER', '_count_ changes'), changes)}
        saving={saving}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE_CHANGES', 'Save changes')}
        onDiscard={() => setDraft(null)}
        onSave={save}
        formSelector='.mgs-root'
      />
      <AlertDialog
        open={!!saveErrors}
        title={t('MANAGED_GROUPS_SAVE_ERROR_TITLE', "Some groups weren't saved")}
        content={saveErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setSaveErrors(null)}
      />
    </div>
  )
}

/**
 * The Managed groups section. `userId` is the manager, `label` names the save bar, and `onDirtyChange(boolean)` tells whether the
 * selection differs from what is stored, so the panel can ask before leaving.
 */
export const ManagedGroupsSection = ({ userId, label, onDirtyChange }) => (
  <DriverGroupSettingController
    key={userId}
    userId={userId}
    isDriverManager
    label={label}
    onDirtyChange={onDirtyChange}
    UIComponent={ManagedGroupsBody}
  />
)
