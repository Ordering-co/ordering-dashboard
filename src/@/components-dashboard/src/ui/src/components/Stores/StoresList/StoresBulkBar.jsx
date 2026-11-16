import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { useFeaturedRestriction } from '../../../hooks/useFeaturedRestriction'
import { Button, ConfirmDialog, SelectionBar } from '../../Shared/Product'
import { ConfirmAdmin } from '../../Shared/UI/ConfirmAdmin'
import { availableBulkActions, bulkConfirmCopy, runBulkAction } from './storesListModel'
import './stores-table.css'

// redesign SL-F1 (A2): the selection bar of /stores/list. «N selected» with Enable, Disable, Feature, Unfeature, Delete and Clear.
//
// In `main` the bulk Enable and Featured switches acted at once and Delete asked only for the password. Now the four state changes
// ask first (a Product ConfirmDialog that says the verb, the count and the names, C8; the focus starts on Cancel) and Delete keeps
// the password / OTP check of ConfirmAdmin, with the same words. The selection lives in the list controller (`businessIds`) and
// survives filters, pages and the view switch, so the bar shows in the card view too while ids remain, as BusinessDelete did.

// redesign bugs F row 20: where the focus goes when the bar goes away, inside `root` (the list): the «Select all» of the
// table, of the phone cards (`.odc-sl-tools`, live check L-1: it was missing and the focus fell to <body> at 390) or of a RecordCardList,
// else the first row's checkbox
export const selectAllTarget = (root) => root?.querySelector(
  'th[data-selection] [role="checkbox"], .odc-sl-tools [role="checkbox"], .odc-order-cards-select [role="checkbox"], td[data-selection] [role="checkbox"]'
) || null

/**
 * @param {object}   props
 * @param {Array<number>} props.businessIds                The selected store ids (the controller's `businessIds`).
 * @param {{businesses?: Array<{id: number, name: string}>}} props.businessList  The page on screen; names for the confirmation come from here.
 * @param {Function} props.setBusinessIds                  Clear → `setBusinessIds([])`.
 * @param {Function} props.handleEnableAllBusiness         `(value, isFeatured)`: Enable / Disable / Feature / Unfeature (BULK_ACTIONS).
 * @param {Function} props.handleDeleteMultiBusinesses     Delete, after the password check.
 *
 * redesign stores 3.B, decision 12a: only the verbs that change something for the stores selected. Enable shows when one
 * of them is disabled, Disable when one is enabled; so on the Active tab it is Disable, on Inactive Enable, and both for a selection
 * that holds stores of the two tabs (the selection outlives the tab, review r1 #3). The bar remembers the state of every store it
 * has seen on screen; a selected store it never saw counts as either, so no verb is lost.
 */
export const StoresBulkBar = ({
  businessIds = [],
  businessList,
  setBusinessIds,
  handleEnableAllBusiness,
  handleDeleteMultiBusinesses,
  fallbackFocus
}) => {
  const [, t] = useLanguage()
  const isRestricted = useFeaturedRestriction()
  // The action asked about ('enable' | 'disable' | 'feature' | 'unfeature') stays while the dialog plays its exit, so its words do not blank
  const [asked, setAsked] = useState({ action: null, open: false })
  const [deleting, setDeleting] = useState(false)
  const [running, setRunning] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  // id -> enabled, for every store seen on screen (the selection can hold stores of other pages and tabs)
  const seen = useRef(new Map())
  ;(businessList?.businesses || []).forEach(business => {
    if (typeof business?.enabled === 'boolean') seen.current.set(business.id, business.enabled)
  })

  const count = businessIds.length

  // redesign bugs F row 20 (R-05): the bar goes away when the selection empties (a confirmed verb, a delete, «Clear
  // selection») and takes the focused control with it: the focus fell to <body>. It goes to `fallbackFocus()` (the list's «Select
  // all»), for a few frames while a closing dialog lets the page go; a focus the user put somewhere real is left alone.
  const hadSelection = useRef(count > 0)
  const fallbackRef = useRef(fallbackFocus)
  fallbackRef.current = fallbackFocus
  useEffect(() => {
    const had = hadSelection.current
    hadSelection.current = count > 0
    if (!had || count > 0) return undefined
    let frame = 0
    let frames = 0
    // review R-7: a focus inside a dialog is never taken: a closing one is waited for (it drops the focus to <body> or hands it back),
    // one that stays open keeps it
    const attempt = () => {
      const active = document.activeElement
      const inDialog = !!active?.closest?.('[role="dialog"], [role="alertdialog"]')
      if (active && active !== document.body && !inDialog) return
      const target = fallbackRef.current?.()
      if (!inDialog && target?.isConnected) target.focus()
      if (document.activeElement !== target && frames++ < 60) frame = requestAnimationFrame(attempt)
    }
    attempt()
    return () => cancelAnimationFrame(frame)
  }, [count])

  // decision 12a (G1-24): Enable over enabled stores changed nothing and took the rows off the list; Disable over disabled ones, the same
  const states = businessIds.map(id => seen.current.get(id))
  const someDisabled = states.some(state => state !== true)
  const someEnabled = states.some(state => state !== false)
  const actions = availableBulkActions({ isRestricted }).filter(id => !(
    (id === 'enable' && !someDisabled) ||
    (id === 'disable' && !someEnabled)
  ))

  // The selection can hold stores of other pages: their names are not known here, and the copy counts them as «+N more».
  const namesOnScreen = () => {
    const selected = new Set(businessIds)
    return (businessList?.businesses || []).filter(business => selected.has(business.id)).map(business => business.name)
  }
  const copyOf = (action) => bulkConfirmCopy(action, namesOnScreen(), t, count)

  const confirm = async () => {
    const action = asked.action
    setAsked({ action, open: false })
    setRunning(true)
    try {
      await runBulkAction(action, { handleEnableAllBusiness, handleDeleteMultiBusinesses })
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  const confirmDelete = (token) => {
    setDeleting(false)
    handleDeleteMultiBusinesses(token)
  }

  if (count === 0) return null

  const label = {
    enable: t('ENABLE', 'Enable'),
    disable: t('DISABLE', 'Disable'),
    feature: t('STORES_BULK_FEATURE', 'Feature'),
    unfeature: t('STORES_BULK_UNFEATURE', 'Unfeature'),
    delete: t('DELETE', 'Delete')
  }
  const copy = asked.action ? copyOf(asked.action) : null
  const deleteCopy = deleting ? copyOf('delete') : null

  return (
    <>
      <SelectionBar
        label={t('STORES_BULK_ACTIONS_LABEL', 'Actions for selected stores')}
        countLabel={t('STORES_SELECTED_COUNT', '_count_ selected').replace('_count_', String(count))}
        clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
        onClear={() => setBusinessIds([])}
        busy={running}
        actions={(
          <>
            {actions.map(id => (
              <Button
                key={id}
                size='sm'
                data-bulk-action={id}
                data-tone={id === 'delete' ? 'danger' : undefined}
                disabled={running}
                onClick={() => (id === 'delete' ? setDeleting(true) : setAsked({ action: id, open: true }))}
              >
                {label[id]}
              </Button>
            ))}
          </>
        )}
      />
      <ConfirmDialog
        open={asked.open}
        tone='primary'
        title={copy?.title ?? ''}
        confirmLabel={copy?.confirmLabel ?? ''}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={confirm}
        onCancel={() => setAsked({ action: asked.action, open: false })}
      >
        {copy?.description}
      </ConfirmDialog>
      {deleting && (
        <ConfirmAdmin
          open
          action='businesses_delete'
          title={deleteCopy.title}
          description={deleteCopy.description}
          confirmLabel={deleteCopy.confirmLabel}
          onClose={() => setDeleting(false)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
