import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import {
  BusinessDetails as BusinessController,
  ToastType,
  useApi,
  useAssistantRecordChanges,
  useLanguage,
  useSession,
  useToast
} from '../../../../../index'
import { AsyncSwitch } from '../../Shared/Product'
import { useStoreDeactivateConfirm } from '../../../hooks/useStoreDeactivateConfirm'

// redesign SL-F1 (A2): the Enable and Featured switches of a store row or card (M-12).
//
// It is the BusinessDetails controller with a `business`, exactly as SingleBusiness mounted it (notGetSites, notGetTaxes,
// notGetStreamConnection, SingleBusiness:257 in main: no request until the person acts; the controller no longer asks for Clover,
// main 4b7ff4f9), so `handleSucessUpdateBusiness` and `handleSucessRemoveBusiness` keep
// firing from the controller's own effect. What changes is the switch: it is CONTROLLED by the stored value of the record, it shows
// the value being saved while it is busy, and when the save fails it goes back to the stored value and says so in the row. In
// `main` the switch stayed in the flipped position with the old data and nothing said so (inventory 1.8).
//
// `handleChangeActiveBusiness(enabled, isFeatured)` returns `{ ok, error }` (A3 changed the controller). A controller that returns
// nothing is read as a success (the controller's state is what the switch shows afterwards either way).
//
// Under `StoreRowControllers` (the list, the phone and the card view) the switches of every row save through ONE saver for the page
// (redesign stores 3.B, , G1-23; see below). A StoreRowSwitch outside it mounts its own controller, as before.

const FIELDS = Object.freeze({ enabled: false, featured: true })

// redesign 2.G: the switch itself (controlled, busy, back to the stored value and a notice when the save fails) is
// P/AsyncSwitch now; this binds it to the field of the record and to the controller's save.
const StoreRowSwitchUI = ({
  field = 'enabled',
  label,
  tone,
  children,
  business,
  businessState,
  handleChangeActiveBusiness,
  confirmOff
}) => {
  const [, t] = useLanguage()
  // redesign (owner decision 31 A): switching Enabled off asks first; on, and Featured, stay immediate. Under
  // StoreRowControllers the question is the page's one dialog (`confirmOff`), drawn outside the rows: a click in a dialog drawn
  // inside a row would reach the row through React and open the store. A switch on its own draws its own.
  const own = useStoreDeactivateConfirm()
  const record = businessState?.business ?? business
  const asksOff = field === 'enabled'
  const ask = confirmOff ?? own.confirmChange
  return (
    <>
      <AsyncSwitch
        checked={Boolean(record?.[field])}
        onToggle={(next) => handleChangeActiveBusiness(next, FIELDS[field])}
        confirmChange={asksOff ? (next) => ask(next, record?.name, record?.id) : undefined}
        data-store-switch={field}
        data-store-id={record?.id}
        aria-label={label}
        label={label}
        tone={tone}
        failureText={t('STORES_CHANGE_FAILED', "We couldn't save the change.")}
      >
        {children}
      </AsyncSwitch>
      {asksOff && !confirmOff && own.dialog}
    </>
  )
}

// ---- one saver for the page (redesign stores 3.B, , G1-23) ---------------------------------------------------------------
//
// Until 3.B, StoreRowControllers mounted a whole BusinessDetails controller per store on screen (10–50 in the list, one per card in
// the card view). They asked for nothing, but each rendered 7–8 times per load and, on mounting, handed its store back to the list
// (`handleSucessUpdateBusiness`), so a load of N rows set the list N more times (analysis.md §3: 70 controller renders with 10 rows,
// 272 with 34, 214 with 34 cards). A row switch only ever used one thing of that controller, `handleChangeActiveBusiness`; this does
// the same for every row of the page from one place:
// - the same request: `businesses(id).save({ enabled })` or `({ featured })`, with the session token;
// - the same toasts: «Loading» on press, «Business updated» on success; none of its own on failure, where «Loading» is hidden (the switch says why);
// - the same answer: `{ ok: true }`, `{ ok: false, error: result }` on an API error, `{ ok: false, error: [message] }` on a throw;
// - the same hand-back: on success, `handleSucessUpdateBusiness` with the store and what the API returned (the list updates the row,
//   or takes it off the tab it no longer belongs to);
// - the same assistant: one subscription for the page; a change to a store on screen is handed back to the list the same way.
// - redesign the one «Deactivate <store>?» dialog of the page (owner decision 31 A).
// What the switch shows is the record of the row; after a save it is the saved record until the list hands a new row object.

const RowSaverContext = createContext(null)

// (Z F5, coordinator: option A): a confirmed deactivation takes the store off the Active tab with its row (table, cards,
// phone), and the focus fell to <body>. `placeOf` notes, when the question is answered, the order of the Enabled switches on screen;
// `returnFocusAfterOff`, once the save is over, waits a few frames for the row to go and gives the focus to the Enabled switch of the
// store that now has that place (the next one still there, else the one before), or to the page's h1 when none is left. While the
// switch is still there (a failed save) it keeps the focus; a focus the user put somewhere else is left alone. The switch that takes
// the focus still asks before switching its store off (decision 31).
const ENABLED_SWITCHES = '[data-store-switch="enabled"]'
const enabledSwitch = (id) => document.querySelector(`${ENABLED_SWITCHES}[data-store-id="${id}"]`)
const placeOf = (id) => ({ id: String(id), order: Array.from(document.querySelectorAll(ENABLED_SWITCHES)).map(item => item.dataset.storeId) })

const focusTargetAfterOff = ({ id, order }) => {
  const index = order.indexOf(id)
  const after = order.slice(index + 1)
  const before = order.slice(0, Math.max(index, 0)).reverse()
  const next = [...after, ...before].map(enabledSwitch).find(Boolean)
  if (next) return next
  const heading = document.querySelector('h1')
  if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  return heading
}

// Review R1: the dialog hands the focus back once it has closed (~450 ms): to the switch, or, when the row has already left, to
// what Base UI falls back to (an earlier opener still on screen, e.g. a switch whose question was cancelled). `watchDialogClose`
// notes where it went (`handedTo`); after the save, a focus still there or on <body> is moved, one the user moved is left alone.
const FRAMES = 120
const dialogOpen = () => !!document.querySelector('[role="alertdialog"]')
const isDropped = (active) => !active || active === document.body

const watchDialogClose = (place) => {
  let frames = 0
  const attempt = () => {
    if (!dialogOpen()) {
      place.handedTo = document.activeElement
      return
    }
    if (frames++ < FRAMES) requestAnimationFrame(attempt)
  }
  requestAnimationFrame(attempt)
}

const returnFocusAfterOff = (place) => {
  let frames = 0
  const attempt = () => {
    const active = document.activeElement
    const own = enabledSwitch(place.id)
    if (!dialogOpen() && 'handedTo' in place) {
      if (!isDropped(active) && active !== place.handedTo && active !== own) return
      if (!own) {
        focusTargetAfterOff(place)?.focus()
        return
      }
    }
    if (frames++ < FRAMES) requestAnimationFrame(attempt)
    else if (own && isDropped(active)) own.focus()
  }
  requestAnimationFrame(attempt)
}

/**
 * The saver of the Enabled and Featured switches of the stores on screen. Every `StoreRowSwitch` below it saves through it.
 *
 * @param {object}   props
 * @param {Array<{id: number}>} props.businesses           The stores on screen (for the assistant's changes).
 * @param {Function} [props.handleSucessUpdateBusiness]    From the list controller; called once per saved change, with the store.
 */
export const StoreRowControllers = ({ businesses = [], handleSucessUpdateBusiness, children }) => {
  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast, hideToast }] = useToast()
  const [, t] = useLanguage()
  // saved records, by store id: `{ source, record }`; `source` is the row object the save was made on, so a new row (a reload)
  // wins over an old save, as the controller's state gave way to a new `business` prop
  const [saved, setSaved] = useState(() => new Map())
  const latest = useRef(null)
  latest.current = { businesses, handleSucessUpdateBusiness, ordering, session, showToast, hideToast, t }

  const handBack = useCallback((source, record) => {
    setSaved(current => new Map(current).set(record.id, { source, record }))
    latest.current.handleSucessUpdateBusiness?.(record)
  }, [])

  useAssistantRecordChanges(({ entity, id, after }) => {
    if (entity !== 'Business' || !after || !id) return
    const row = latest.current.businesses.find(business => business.id === id)
    if (!row) return
    handBack(row, { ...row, ...after })
  })

  // `business` is the row object; `record` what the switch shows of it (the row, or what was saved on it)
  const change = useCallback(async (business, value, isFeatured = false, record = business) => {
    const { ordering, session, showToast, hideToast, t } = latest.current
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changes = isFeatured ? { featured: value } : { enabled: value }
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(business.id).save(changes)
      if (error) {
        hideToast?.() // redesign bugs F row 19: the switch says why; «Loading» would stay up after a failed save
        return { ok: false, error: result }
      }
      handBack(business, { ...record, ...result })
      showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      return { ok: true }
    } catch (err) {
      hideToast?.() // redesign bugs F row 19: same as the API error above
      return { ok: false, error: [err.message] }
    }
  }, [handBack])

  // redesign (owner decision 31 A): the one «Deactivate <store>?» of the page, outside the rows
  const deactivate = useStoreDeactivateConfirm()
  const confirmOffRef = useRef(deactivate.confirmChange)
  confirmOffRef.current = deactivate.confirmChange
  // where the focus goes once the store has left the list (see returnFocusAfterOff)
  const placeRef = useRef(null)
  const confirmOff = useCallback(async (next, name, id) => {
    const answer = await confirmOffRef.current(next, name)
    placeRef.current = answer && !next && id != null ? placeOf(id) : null
    if (placeRef.current) watchDialogClose(placeRef.current)
    return answer
  }, [])
  const changeAndReturnFocus = useCallback(async (business, value, isFeatured = false, record = business) => {
    const place = !isFeatured && !value && placeRef.current?.id === String(business.id) ? placeRef.current : null
    if (place) placeRef.current = null
    const result = await change(business, value, isFeatured, record)
    if (place) returnFocusAfterOff(place)
    return result
  }, [change])

  const value = useMemo(() => ({ saved, change: changeAndReturnFocus, confirmOff }), [saved, changeAndReturnFocus, confirmOff])
  return (
    <RowSaverContext.Provider value={value}>
      {children}
      {deactivate.dialog}
    </RowSaverContext.Provider>
  )
}

const SharedStoreRowSwitch = ({ saver, business, field, label, tone, children }) => {
  const entry = saver.saved.get(business.id)
  const record = entry && entry.source === business ? entry.record : business
  return (
    <StoreRowSwitchUI
      field={field}
      label={label}
      tone={tone}
      business={business}
      businessState={{ business: record }}
      handleChangeActiveBusiness={(value, isFeatured) => saver.change(business, value, isFeatured, record)}
      confirmOff={saver.confirmOff}
    >
      {children}
    </StoreRowSwitchUI>
  )
}

/**
 * @param {object}   props
 * @param {object}   props.business                        The store of the row (the list's record).
 * @param {'enabled'|'featured'} [props.field='enabled']   Which flag the switch saves: `handleChangeActiveBusiness(value)` or `(value, true)`.
 * @param {string}   props.label                           Accessible name ("Enable Sample Burgers").
 * @param {'neutral'} [props.tone]                         P/Switch tone: Featured is the second switch of a row (redesign stores 3.B).
 * @param {React.ReactNode} [props.children]               Visible text beside the track (cards); the whole row then toggles.
 * @param {Function} [props.handleSucessUpdateBusiness]    From the list controller; the BusinessDetails controller calls it with the saved store. Only used
 *                                                         when the switch mounts its own controller; under StoreRowControllers they go there.
 * @param {Function} [props.handleSucessRemoveBusiness]
 * @param {Function} [props.handleSucessAddBusiness]
 */
export const StoreRowSwitch = ({ business, field = 'enabled', label, tone, children, ...handlers }) => {
  const saver = useContext(RowSaverContext)
  if (saver) return <SharedStoreRowSwitch saver={saver} business={business} field={field} label={label} tone={tone}>{children}</SharedStoreRowSwitch>
  return (
    <BusinessController
      {...handlers}
      business={business}
      businessId={business.id}
      notGetSites
      notGetTaxes
      notGetStreamConnection
      field={field}
      label={label}
      tone={tone}
      UIComponent={StoreRowSwitchUI}
    >
      {children}
    </BusinessController>
  )
}
