import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Plus, TriangleAlert } from '../../Shared/Icon'
import { Avatar, Button, ConfirmDialog, InlineNotice } from '../../Shared/Product'
import { BusinessOwnerSelector } from '../BusinessOwnerSelector'
import './business-owners.css'

// redesign stores 5.2 (; G2-06, G2-07, G2-41; decisions 12c, D1–D3): the owners (level 2) or the agents (level 9) of a store.
// - Each person is a row with their avatar, name and email, and a native «Remove» button named with the person. Removing asks first,
//   naming the person and the store. A store keeps at least one owner: the last owner's «Remove» is off and a line says why (12c).
//   Agents may go down to none, as before.
// - «Add owner / agent» opens the people picker (`BusinessOwnerSelector`): the dialog with the chosen person's name on its button is the
//   confirmation, so adding takes three clicks instead of four.
// - The list changes only once the API accepts the change (the controller answers `{ ok, error }`); a failure is said here.
// Same requests as `main`: `POST /business/:id { owners | agents: [ids] }`, and `GET /users` of the level for the picker.

const fullName = person => [person?.name, person?.lastname].filter(Boolean).join(' ').trim()

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

export const BusinessOwners = (props) => {
  const {
    business,
    handleDeleteBusinessOwner,
    handleAddBusinessOwner,
    type = 'owners'
  } = props
  const [, t] = useLanguage()
  const isAgents = type === 'agents'
  const people = Array.isArray(business?.[type]) ? business[type] : []
  const ids = people.map(person => person?.id)
  const isLastOwner = !isAgents && people.length <= 1
  const storeName = business?.name ?? ''
  const noteId = useId()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [removing, setRemoving] = useState({ open: false, busy: false, person: null })
  const [failure, setFailure] = useState(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const rootRef = useRef(null)
  const addRef = useRef(null)
  const [focusAfter, setFocusAfter] = useState(null) // the index of the row just removed

  // review r1-1: the removed row took its «Remove» (the dialog's opener) with it, so the focus fell to <body>. Once the dialog lets
  // the focus go, it moves to the «Remove» that took that row's place, else the one above, else «Add owner / agent». A focus the
  // user already put somewhere else is theirs.
  useEffect(() => {
    if (focusAfter == null) return undefined
    let frames = 0
    let frame = 0
    const settle = () => {
      const active = document.activeElement
      const inDialog = !!active?.closest?.('[role="dialog"], [role="alertdialog"]')
      if (inDialog && frames++ < 60) {
        frame = window.requestAnimationFrame(settle)
        return
      }
      setFocusAfter(null)
      if (active && active !== document.body && !inDialog) return
      const buttons = Array.from(rootRef.current?.querySelectorAll('.odc-people-remove') ?? [])
      const target = [buttons[focusAfter], buttons[focusAfter - 1]].find(button => button && !button.disabled) || addRef.current
      target?.focus()
    }
    frame = window.requestAnimationFrame(settle)
    return () => window.cancelAnimationFrame(frame)
  }, [focusAfter])

  const texts = isAgents
    ? {
        list: t('BUSINESS_AGENTS', 'Agents'),
        add: t('ADD_AGENT', 'Add agent'),
        empty: t('STORE_NO_AGENTS', 'This store has no agents yet.'),
        removeTitle: t('REMOVE_AGENT_TITLE', 'Remove _name_ as an agent of _store_?'),
        removeBody: t('REMOVE_AGENT_BODY', 'They stop being an agent of this store. You can add them again later.'),
        failed: t('STORE_AGENTS_SAVE_FAILED', 'The agents of this store were not changed.')
      }
    : {
        list: t('BUSINESS_OWNERS', 'Business owners'),
        add: t('ADD_OWNER', 'Add owner'),
        empty: t('STORE_NO_OWNERS', 'This store has no owners yet.'),
        removeTitle: t('REMOVE_OWNER_TITLE', 'Remove _name_ as an owner of _store_?'),
        removeBody: t('REMOVE_OWNER_BODY', 'They can no longer manage this store. You can add them again later.'),
        failed: t('STORE_OWNERS_SAVE_FAILED', 'The owners of this store were not changed.')
      }

  const describe = (template, person) => template.replace('_name_', fullName(person)).replace('_store_', storeName)
  const explain = error => translateApiMessage(t, firstMessage(error), texts.failed)

  const askRemove = (person) => {
    setFailure(null)
    setRemoving({ open: true, busy: false, person })
  }

  const closeRemove = () => {
    if (removing.busy) return
    setRemoving(previous => ({ ...previous, open: false }))
  }

  const confirmRemove = async () => {
    const person = removing.person
    setRemoving(previous => ({ ...previous, busy: true }))
    const result = await handleDeleteBusinessOwner(ids.filter(id => id !== person?.id), { type })
    if (!mounted.current) return
    setRemoving({ open: false, busy: false, person: null })
    if (!result?.ok) {
      setFailure(explain(result?.error))
      return
    }
    setFocusAfter(Math.max(0, ids.indexOf(person?.id)))
  }

  // the picker keeps itself open and shows the failure when the save fails; it closes on success
  const addPerson = async (person) => {
    setFailure(null)
    const result = await handleAddBusinessOwner([...ids, person.id], person, { type })
    if (!result?.ok) return { ok: false, error: explain(result?.error) }
    return { ok: true }
  }

  return (
    <div ref={rootRef} className='odc-root odc-people'>
      <div className='odc-people-head'>
        <p className='odc-people-count'>
          {(people.length === 1
            ? (isAgents ? t('STORE_AGENTS_COUNT_ONE', '_count_ agent') : t('STORE_OWNERS_COUNT_ONE', '_count_ owner'))
            : (isAgents ? t('STORE_AGENTS_COUNT_OTHER', '_count_ agents') : t('STORE_OWNERS_COUNT_OTHER', '_count_ owners'))
          ).replace('_count_', String(people.length))}
        </p>
        <Button ref={addRef} variant='primary' icon={Plus} onClick={() => { setFailure(null); setPickerOpen(true) }}>
          {texts.add}
        </Button>
      </div>

      {failure && (
        <InlineNotice tone='warning' icon={TriangleAlert} className='odc-people-notice'>{failure}</InlineNotice>
      )}

      {people.length === 0
        ? <p className='odc-people-empty'>{texts.empty}</p>
        : (
          <ul className='odc-people-list' aria-label={texts.list}>
            {people.map(person => {
              const name = fullName(person)
              return (
                <li key={person?.id} className='odc-people-row'>
                  <Avatar name={name} src={person?.photo || undefined} />
                  <span className='odc-people-who'>
                    <span className='odc-people-name' title={name}>{name}</span>
                    {person?.email && <span className='odc-people-email' title={person.email}>{person.email}</span>}
                  </span>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='odc-people-remove'
                    aria-label={`${t('REMOVE', 'Remove')} ${name}`}
                    aria-describedby={isLastOwner ? noteId : undefined}
                    disabled={isLastOwner || removing.busy}
                    onClick={() => askRemove(person)}
                  >
                    {t('REMOVE', 'Remove')}
                  </Button>
                </li>
              )
            })}
          </ul>
          )}

      {isLastOwner && people.length === 1 && (
        <p id={noteId} className='odc-people-note'>{t('STORE_NEEDS_ONE_OWNER', 'A store needs at least one owner.')}</p>
      )}

      {pickerOpen && (
        <BusinessOwnerSelector
          type={type}
          storeName={storeName}
          selectedOwnerIds={ids}
          defaultUserTypesSelected={isAgents ? [9] : [2]}
          onAdd={addPerson}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <ConfirmDialog
        open={removing.open}
        tone='danger'
        busy={removing.busy}
        title={removing.person ? describe(texts.removeTitle, removing.person) : ''}
        confirmLabel={isAgents ? t('REMOVE_AGENT_CONFIRM', 'Remove agent') : t('REMOVE_OWNER_CONFIRM', 'Remove owner')} // redesign tanda AB (S-5): verb + object
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={closeRemove}
        onConfirm={confirmRemove}
      >
        {texts.removeBody}
      </ConfirmDialog>
    </div>
  )
}
