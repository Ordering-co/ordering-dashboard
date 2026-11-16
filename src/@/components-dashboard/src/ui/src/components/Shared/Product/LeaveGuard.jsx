import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDialog } from './Dialog'
import { useSplitView } from './SplitView'

// redesign stores 2.A (decision 4): the leave-guard contract. One place asks «Keep editing · Save · Discard» before the
// user leaves a form with unsaved work, whatever the way out is (a section change, a row click, a route change, the close of a split
// panel). It has no text of its own: the consumer words LeaveDialog.
//
//  - The page calls `useLeaveGuardHost()` once, provides `context` in `LeaveGuardContext`, routes every way out through
//    `requestLeave(proceed, onCancel)` and draws `<LeaveDialog {...dialog} />`. With nothing dirty `proceed` runs at once.
//  - Each form calls `useLeaveGuard({ dirty, count, save, discard })`: it registers itself in the nearest host (no host: no-op) and
//    in the close guard of the surrounding SplitView, so Esc, the scrim and the close button ask too.
//  - redesign (N-04): a form may also pass `label` (the name of its section or tab, already translated). The host hands
//    the labels of the forms that are dirty when it asks to the dialog as `dialog.labels`, so the consumer can say WHERE the unsaved
//    changes are (the existing «… in _section_ …» sentence) instead of naming the section it happens to be on. Opt-in: without a
//    `label` nothing changes and `labels` is empty.
//  - Save may answer `false` or `{ ok: false }` (or throw) to say it failed: the user stays and the form shows its own error.
//  - `useRequestLeave()` is `requestLeave` for code that may run outside a host: without one it just proceeds.
//  - A nested piece with a guard of its own (P/SectionSplit, 2.B) answers first with `useNestedLeaveGuard(requestLeave)`: every
//    way out of the host asks it, and only when it lets go (calls its `proceed`) does the host ask about its own forms.

export const LeaveGuardContext = createContext(null)

const NO_LABELS = []

const failed = result => result === false || (result != null && typeof result === 'object' && result.ok === false)

// redesign bugs F row 21 (R-7 of 2.B): a tabIndex -1 element that is neither a native control nor has an interactive role
// is a container that only holds the focus for its keyboard (P/SectionSplit's detail after the first Escape in a field)
const CONTROL_SELECTOR = 'input, select, textarea, button, a[href], [contenteditable="true"], [role="button"], [role="link"], ' +
  '[role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], ' +
  '[role="menuitemradio"], [role="treeitem"], [role="gridcell"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="combobox"]'
const isFocusContainer = node => node instanceof Element && node.getAttribute('tabindex') === '-1' && !node.matches(CONTROL_SELECTOR)

/**
 * Host of the guard: keeps the registered forms, the pending way out and the dialog state.
 *
 * @returns {{
 *   context: { register: Function, requestLeave: Function },
 *   requestLeave: (proceed: () => void, onCancel?: () => void) => boolean,
 *   isDirty: () => boolean,
 *   dialog: { open: boolean, count: number, labels: string[], saving: boolean, onKeep: Function, onDiscard: Function, onSave: Function }
 * }}
 */
export function useLeaveGuardHost () {
  const entries = useRef(new Set())
  const pending = useRef(null)
  const openRef = useRef(false)
  const savingRef = useRef(false)
  const mounted = useRef(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [labels, setLabels] = useState(NO_LABELS)
  // redesign `dirty`, the reactive twin of `isDirty()`: re-renders the page when unsaved work appears or goes, so it can
  // be the `active` of useRouteLeaveGuard. Each form tells the host (`context.notifyDirty`) when its own dirty changes.
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // redesign (N-03): the last control the user had the focus in (not one of a dialog). A way out through the scrim or an
  // empty zone of the page blurs the field to <body> before the question opens, and «Keep editing» had nowhere to go back to.
  const lastFocusRef = useRef(null)
  // redesign bugs F row 21: the last one that was a control, not a focus container
  const lastControlRef = useRef(null)
  useEffect(() => {
    const onFocusIn = event => {
      const target = event.target
      if (!(target instanceof Element) || target === document.body || target.closest('[role="alertdialog"]')) return
      lastFocusRef.current = target
      if (!isFocusContainer(target)) lastControlRef.current = target
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  const notifyDirty = useCallback(() => {
    if (!mounted.current) return
    setDirty([...entries.current].some(ref => ref.current?.isDirty()))
  }, [])

  const register = useCallback(entryRef => {
    entries.current.add(entryRef)
    return () => {
      entries.current.delete(entryRef)
      notifyDirty()
    }
  }, [notifyDirty])

  // Nested guards (a SectionSplit inside a section): `(proceed) => void`, calling `proceed` when they let go, in order.
  const nested = useRef(new Set())
  const registerNested = useCallback(leaveRef => {
    nested.current.add(leaveRef)
    return () => { nested.current.delete(leaveRef) }
  }, [])

  // `only` (an entry ref) narrows the question to one form: the close of a SplitView panel asks about that panel alone.
  const dirtyEntries = useCallback(
    (only) => [...entries.current]
      .filter(ref => !only || ref === only)
      .map(ref => ref.current)
      .filter(entry => entry && entry.isDirty()),
    []
  )

  // review F3-R2/R4: the element that had the focus when the question opened gets it back on «Keep editing» (the dialog's own
  // return goes to the first tabbable control when the opener is a panel with tabIndex -1, or to the top of the page when it was
  // the ⌘K input, already gone).
  const openerRef = useRef(null)

  const isDirty = useCallback(() => dirtyEntries().length > 0, [dirtyEntries])

  const askOwn = useCallback((proceed, onCancel, only) => {
    // review F3-R6: a second way out while the question is open is a «stay» for it (its address goes back)
    if (openRef.current) {
      onCancel?.()
      return true
    }
    const dirty = dirtyEntries(only)
    if (dirty.length === 0) {
      proceed?.()
      return false
    }
    pending.current = { proceed, onCancel, only }
    // redesign (N-03): with the focus on <body> (the scrim, an empty zone) the opener is the last control it was in
    const active = typeof document !== 'undefined' ? document.activeElement : null
    const last = lastFocusRef.current
    openerRef.current = (!active || active === document.body) && last?.isConnected ? last : active
    // redesign bugs F row 21 (R-7 of 2.B): the focus is on a container that took it from one of its own controls (the
    // first Escape in a field): «Keep editing» goes back to that control, not to the container (the next Tab went to its first one)
    const control = lastControlRef.current
    if (isFocusContainer(openerRef.current) && control?.isConnected && control !== openerRef.current && openerRef.current.contains(control)) {
      openerRef.current = control
    }
    openRef.current = true
    setCount(dirty.reduce((sum, entry) => sum + (entry.count ? entry.count() : 1), 0))
    setLabels([...new Set(dirty.map(entry => entry.label?.()).filter(label => label != null && label !== ''))])
    setOpen(true)
    return true
  }, [dirtyEntries])

  // The nested guards answer first, one after the other, with `(proceed, onCancel)`: one that keeps the user calls `onCancel`
  // (or nothing) and ends the way out. `options.only` narrows the question to one form and skips the nested guards (they are the
  // ones closing). Returns false only when the way out happened at once.
  const requestLeave = useCallback((proceed, onCancel, options = {}) => {
    if (openRef.current) {
      onCancel?.()
      return true
    }
    const chain = options.only ? [] : [...nested.current].map(ref => ref.current).filter(Boolean)
    let asked = false
    const step = index => {
      if (index === chain.length) {
        asked = askOwn(proceed, onCancel, options.only) || asked
        return
      }
      let went = false
      chain[index](() => { went = true; step(index + 1) }, onCancel)
      if (!went) asked = true
    }
    step(0)
    return asked
  }, [askOwn])

  const close = useCallback(() => {
    const current = pending.current
    pending.current = null
    openRef.current = false
    savingRef.current = false
    if (mounted.current) {
      setSaving(false)
      setOpen(false)
    }
    return current
  }, [])

  const onKeep = useCallback(() => {
    if (savingRef.current) return
    close()?.onCancel?.()
  }, [close])

  const onDiscard = useCallback(() => {
    if (savingRef.current) return
    dirtyEntries(pending.current?.only).forEach(entry => entry.discard())
    close()?.proceed?.()
  }, [close, dirtyEntries])

  const onSave = useCallback(async () => {
    if (savingRef.current || !openRef.current) return
    savingRef.current = true
    setSaving(true)
    let ok = true
    for (const entry of dirtyEntries(pending.current?.only)) {
      try {
        if (failed(await entry.save())) ok = false
      } catch (error) {
        ok = false
      }
      if (!ok) break
    }
    // The host went away while saving: there is nothing left to update and nowhere to go on from.
    if (!mounted.current) return
    const current = close()
    if (ok) current?.proceed?.()
    else current?.onCancel?.()
  }, [close, dirtyEntries])

  const context = useMemo(() => ({ register, registerNested, requestLeave, notifyDirty }), [register, registerNested, requestLeave, notifyDirty])

  const returnFocus = useCallback(() => {
    const opener = openerRef.current
    return opener?.isConnected && opener !== document.body ? opener : null
  }, [])

  return { context, requestLeave, isDirty, dirty, dialog: { open, count, labels, saving, onKeep, onDiscard, onSave, returnFocus } }
}

/**
 * Registers a form with the nearest host (none: no-op) and with the close guard of the surrounding SplitView (or the
 * `registerCloseGuard` you pass), so closing the panel asks before dropping unsaved work. The latest props are read through a ref:
 * they can change on every render without registering again.
 *
 * @param {object} props
 * @param {boolean} props.dirty whether there is unsaved work
 * @param {number} [props.count] unsaved changes this form adds to the dialog (default 1)
 * @param {string} [props.label] name of the section or tab this form is, already translated; the host lists the labels of the dirty
 *   forms in `dialog.labels` (N-04). Optional
 * @param {() => any} props.save resolves `false` or `{ ok: false }` (or throws) when it failed
 * @param {() => void} props.discard
 * @param {(guard: Function) => Function} [props.registerCloseGuard] default: `useSplitView().registerCloseGuard`
 */
export function useLeaveGuard ({ dirty, count, label, save, discard, registerCloseGuard } = {}) {
  const host = useContext(LeaveGuardContext)
  const split = useSplitView()
  const registerGuard = registerCloseGuard || split.registerCloseGuard

  const latest = useRef({})
  latest.current = { dirty, count, label, save, discard }
  const entryRef = useRef(null)
  if (entryRef.current == null) {
    entryRef.current = {
      isDirty: () => {
        const value = latest.current.dirty
        return Boolean(typeof value === 'function' ? value() : value)
      },
      count: () => latest.current.count ?? 1,
      label: () => latest.current.label,
      save: () => latest.current.save?.(),
      discard: () => latest.current.discard?.()
    }
  }

  useEffect(() => (host ? host.register(entryRef) : undefined), [host])

  // redesign the host's reactive `dirty` follows this form (on mount, and each time its own dirty changes)
  const isDirtyNow = entryRef.current.isDirty()
  useEffect(() => { host?.notifyDirty?.() }, [host, isDirtyNow])

  // review F3-R6: closing the panel asks about this form only (not every dirty form of the host)
  useEffect(() => registerGuard(proceed => {
    if (!entryRef.current.isDirty() || !host) return false
    host.requestLeave(proceed, undefined, { only: entryRef })
    return true
  }), [registerGuard, host])
}

/**
 * A nested piece with its own way to ask (P/SectionSplit's `requestLeave(proceed)`) answers first on every way out of the nearest
 * host: the host goes on only when it calls `proceed`; when the user stays it should call `onCancel` (the second argument), so
 * the way out can put its address back. No host: no-op. The latest function is read through a ref.
 *
 * @param {(proceed: () => void, onCancel?: () => void) => any} requestLeave
 */
export function useNestedLeaveGuard (requestLeave) {
  const host = useContext(LeaveGuardContext)
  const leaveRef = useRef(requestLeave)
  leaveRef.current = requestLeave
  useEffect(() => (host?.registerNested ? host.registerNested(leaveRef) : undefined), [host])
}

/** `(proceed, onCancel) => boolean` that asks the nearest host, or just proceeds when there is none. */
export function useRequestLeave () {
  const host = useContext(LeaveGuardContext)
  return useCallback((proceed, onCancel) => {
    if (host) return host.requestLeave(proceed, onCancel)
    proceed?.()
    return false
  }, [host])
}

// Focuses `target` as soon as it can take the focus (the page behind a closing dialog is inert for a few frames), for up to 60 frames.
// It gives up when the user has put the focus somewhere else meanwhile (not the body, not the closing dialog).
const restoreFocus = target => {
  let frames = 0
  const attempt = () => {
    if (!target.isConnected) return
    const active = document.activeElement
    if (active && active !== document.body && active !== target && !active.closest('[role="alertdialog"]')) return
    target.focus({ preventScroll: true })
    if (document.activeElement !== target && frames++ < 60) requestAnimationFrame(attempt)
  }
  requestAnimationFrame(attempt)
}

/**
 * The three-way question on ConfirmDialog (danger tone): Keep editing (cancel, takes the initial focus), Save (the middle action,
 * it carries the spinner while `saving`) and Discard (confirm). `title`, `keepLabel`, `saveLabel`, `discardLabel` and `closeLabel`
 * are required; the wrapper has no text of its own. `description` words the consequence (the consumer builds it from `count`).
 */
export const LeaveDialog = ({
  open,
  saving = false,
  onKeep,
  onDiscard,
  onSave,
  title,
  description,
  keepLabel,
  saveLabel,
  discardLabel,
  closeLabel,
  returnFocus,
  fallbackFocus,
  className
}) => {
  for (const [name, value] of Object.entries({ title, keepLabel, saveLabel, discardLabel, closeLabel })) {
    if (value == null) throw new Error(`LeaveDialog needs a ${name}`)
  }
  // review F3-R2/R4: back to where the focus was when it asked (`returnFocus()`, the host's), else `fallbackFocus` (a ref, e.g. the
  // panel), else the dialog's own rule. Base UI sends the focus to the first tabbable control INSIDE the element it gets (a panel
  // with tabIndex -1 gave it to the store's Enable switch), so the dialog moves nothing and the exact element is focused here, once
  // the layer has let the page go (it stays inert while the dialog plays its exit).
  const focusProps = returnFocus || fallbackFocus
    ? {
        finalFocus: () => {
          const target = returnFocus?.() || (fallbackFocus?.current?.isConnected ? fallbackFocus.current : null)
          if (!target) return true
          restoreFocus(target)
          return false
        }
      }
    : {}
  return (
    <ConfirmDialog
      {...focusProps}
      open={open}
      tone='danger'
      title={title}
      cancelLabel={keepLabel}
      onCancel={onKeep}
      extraLabel={saveLabel}
      onExtra={onSave}
      confirmLabel={discardLabel}
      onConfirm={onDiscard}
      closeLabel={closeLabel}
      busy={saving}
      busyAction='extra'
      className={className}
    >
      {description}
    </ConfirmDialog>
  )
}
