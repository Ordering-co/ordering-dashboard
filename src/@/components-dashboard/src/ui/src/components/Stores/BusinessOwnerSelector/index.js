import React, { useMemo, useRef, useState } from 'react'
import { useLanguage, UsersList as UsersListController } from '../../../../../index'
import { Check, TriangleAlert } from '../../Shared/Icon'
import { Avatar, Button, Dialog, InlineNotice, SearchField, Skeleton } from '../../Shared/Product'
import './business-owner-selector.css'

// redesign stores 5.2 (decision D1): the people picker of a store's owners or agents. A dialog with a search field and the
// people of the level (2 owners, 9 agents) as a listbox; the ones the store has already are marked and cannot be chosen, as in `main`.
// Choosing one puts their name on the dialog's button («Add Ana Ruiz»): that button is the confirmation, so the dialog replaces
// `main`'s select + «Add» + «Accept». The people come from the same controller and request as before (`UsersList` with
// `isBusinessOwners`: every user of the level, searched here). `onAdd(person)` answers `{ ok, error }`: on success the dialog closes,
// on failure it stays with the reason.
// The listbox: one option in the Tab order (the chosen one, else the first); ArrowDown / ArrowUp, Home and End move the focus; Enter,
// Space or a click choose; ArrowDown from the search field enters the list; typing on an option goes on in the search field.

const fullName = person => [person?.name, person?.lastname].filter(Boolean).join(' ').trim()
// «José» is found by «jose»
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
const OPTION = '[role="option"]'

const BusinessOwnerSelectorUI = (props) => {
  const {
    usersList,
    selectedOwnerIds = [],
    type = 'owners',
    storeName = '',
    onAdd,
    onClose
  } = props

  const [, t] = useLanguage()
  const isAgents = type === 'agents'
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState(null)
  const [focusedId, setFocusedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)

  const users = Array.isArray(usersList?.users) ? usersList.users : []
  const loading = !!usersList?.loading && users.length === 0
  const loadError = usersList?.error
  const needle = fold(query.trim())
  const shown = useMemo(() => (needle
    ? users.filter(user => [fullName(user), user?.email, String(user?.id ?? '')].some(text => fold(text).includes(needle)))
    : users), [users, needle])
  const isAssigned = user => selectedOwnerIds.includes(user?.id)
  const shownIds = shown.map(user => user?.id)
  const stopId = [focusedId, chosen?.id].find(id => id != null && shownIds.includes(id)) ?? shownIds[0]

  const title = (isAgents ? t('ADD_AGENT_TO_STORE', 'Add an agent to _store_') : t('ADD_OWNER_TO_STORE', 'Add an owner to _store_'))
    .replace('_store_', storeName)
  const listLabel = isAgents ? t('BUSINESS_AGENTS', 'Agents') : t('BUSINESS_OWNERS', 'Business owners')
  const already = isAgents ? t('ALREADY_AN_AGENT', 'Already an agent') : t('ALREADY_AN_OWNER', 'Already an owner')
  const addLabel = chosen
    ? t('ADD_NAME', 'Add _name_').replace('_name_', fullName(chosen))
    : (isAgents ? t('ADD_AGENT', 'Add agent') : t('ADD_OWNER', 'Add owner'))

  const close = () => {
    if (busy) return
    onClose?.()
  }

  const choose = (user) => {
    if (isAssigned(user)) return
    setFailure(null)
    setChosen(user)
  }

  const confirm = async () => {
    if (!chosen || busy) return
    setBusy(true)
    setFailure(null)
    const result = await onAdd?.(chosen)
    if (result?.ok) {
      onClose?.()
      return
    }
    setBusy(false)
    setFailure(result?.error || t('STORE_OWNERS_SAVE_FAILED', 'The owners of this store were not changed.'))
  }

  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const options = Array.from(listRef.current?.querySelectorAll(OPTION) ?? [])
    const index = options.indexOf(event.target.closest?.(OPTION))
    let target
    if (index >= 0) {
      if (event.key === 'ArrowDown') target = options[Math.min(index + 1, options.length - 1)]
      else if (event.key === 'ArrowUp') target = index === 0 ? searchRef.current : options[index - 1]
      else if (event.key === 'Home') target = options[0]
      else if (event.key === 'End') target = options[options.length - 1]
      else if (event.key.length === 1 && event.key !== ' ') {
        event.preventDefault()
        setQuery(current => current + event.key)
        searchRef.current?.focus()
        return
      }
    } else if (event.key === 'ArrowDown' && event.target === searchRef.current) {
      target = options[0]
    }
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  let status = null
  if (loadError) {
    status = (
      <InlineNotice role={undefined} tone='warning' icon={TriangleAlert}>
        {t('PEOPLE_LOAD_FAILED', 'The list of people could not be loaded.')}
      </InlineNotice>
    )
  } else if (loading) {
    status = null
  } else if (shown.length === 0) {
    status = <p className='odc-people-picker-empty'>{needle ? t('NO_RESULTS_FOUND', 'No results found') : t('NO_PEOPLE_TO_ADD', 'There is nobody to add.')}</p>
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) close() }}
      title={title}
      closeLabel={t('CLOSE', 'Close')}
      size='md'
      initialFocus={searchRef}
      dismissible={!busy}
      footer={(
        <>
          <Button onClick={close} disabled={busy}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' disabled={!chosen} busy={busy} onClick={confirm}>{addLabel}</Button>
        </>
      )}
    >
      <div className='odc-people-picker' onKeyDown={handleKeyDown}>
        <SearchField
          value={query}
          onChange={setQuery}
          inputRef={searchRef}
          label={`${t('SEARCH', 'Search')} ${listLabel}`}
          placeholder={t('SEARCH_NAME_EMAIL', 'Search by name or email')}
          clearLabel={t('CLEAR', 'Clear')}
        />
        {loading
          ? (
            <div className='odc-people-picker-list' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
              {[0, 1, 2, 3].map(index => (
                <div key={index} className='odc-people-picker-skeleton'>
                  <Skeleton shape='round' size='var(--od-x-control-height)' block='var(--od-space-6)' />
                  <Skeleton size='50%' />
                </div>
              ))}
            </div>
            )
          : (
            <div ref={listRef} className='odc-people-picker-list' role='listbox' aria-label={listLabel}>
              {shown.map(user => {
                const name = fullName(user)
                const assigned = isAssigned(user)
                const selected = chosen?.id === user?.id
                return (
                  <button
                    key={user?.id}
                    type='button'
                    role='option'
                    className='odc-people-option'
                    aria-selected={selected ? 'true' : 'false'}
                    aria-disabled={assigned ? 'true' : undefined}
                    tabIndex={user?.id === stopId ? 0 : -1}
                    onFocus={() => setFocusedId(user?.id)}
                    onClick={() => choose(user)}
                  >
                    <span className='odc-people-option-check' aria-hidden='true'>
                      {(selected || assigned) && <Check className='odc-icon' />}
                    </span>
                    <Avatar name={name} src={user?.photo || undefined} />
                    <span className='odc-people-option-who'>
                      <span className='odc-people-option-name' title={name}>{name}</span>
                      <span className='odc-people-option-meta'>
                        {[user?.email, user?.id != null ? `#${user.id}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {assigned && <span className='odc-people-option-tag'>{already}</span>}
                  </button>
                )
              })}
            </div>
            )}
        <div className='odc-people-picker-status' role='status'>
          {failure
            ? <InlineNotice role={undefined} tone='warning' icon={TriangleAlert}>{failure}</InlineNotice>
            : status}
        </div>
      </div>
    </Dialog>
  )
}

export const BusinessOwnerSelector = (props) => {
  const businessOwnersProps = {
    ...props,
    UIComponent: BusinessOwnerSelectorUI,
    isBusinessOwners: true,
    defaultUserTypesSelected: props.defaultUserTypesSelected || [2]
  }
  return <UsersListController {...businessOwnersProps} />
}
