import React, { createContext, forwardRef, useCallback, useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useLanguage } from '../../../../../index'
import { Button, IconButton } from '../../Shared/Product'
import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost, useNestedLeaveGuard } from '../../Shared/Product/LeaveGuard'
import { ChevronLeft, X } from '../../Shared/Icon'

// redesign stores 3.C: the levels of the Importers panel in one Sheet. Level 0 is the list; a row, «Edit» or «Add
// importer» opens level 1 (the import or the importer form) and those open level 2 (advanced options, one mapping of a multiple
// importer). It keeps what the legacy side bars did with `moveDistance`: from 1100px the two last levels are side by side (the
// Sheet doubles its width, importers.css) and changing the record of level 1 is one click on another row; below, only the last
// level is in view and «‹ <previous level>» goes back. Each level that is not in view stays mounted (its state and its job polling
// stay), hidden with `hidden`.
//
// A level is declared where its owner renders it, `<ImportersPane title onBack>…</ImportersPane>`, and drawn through a portal in
// its slot, so it keeps the props and the state of its owner. The depth is the nesting of the panes in the React tree.
//
// Unsaved work: every level is a leave-guard host (P/LeaveGuard). A form inside calls `useLeaveGuard({ dirty, save, discard })`.
// Going back from a level asks that level and the ones above it; closing the Sheet (X, Escape on the list, the scrim) or changing
// the record of level 1 asks them all (`useImportersLeave()` at the level of the caller).

const StackContext = createContext(null)
const LevelContext = createContext(0)

// redesign bugs E: each level is a host of its own, so the panel's host does not see the unsaved work inside them. A
// nested host tells the panel its reactive `dirty` here (`useReportImportersDirty`); the panel holds the page (useRouteLeaveGuard)
// while any of them is dirty. Its question still goes down the chain of nested guards, as every other way out.
const DirtyReportContext = createContext(null)

/** The panel's side: `{ dirty, report }`; put `report` in `ImportersDirtyProvider`. */
export const useImportersDirty = () => {
  const [levels, setLevels] = useState({})
  const report = useCallback((id, dirty) => setLevels(prev => {
    if (Boolean(prev[id]) === dirty) return prev
    const next = { ...prev }
    if (dirty) next[id] = true
    else delete next[id]
    return next
  }), [])
  return { dirty: Object.keys(levels).length > 0, report }
}

export const ImportersDirtyProvider = DirtyReportContext.Provider

/** A nested host inside the panel tells it whether it holds unsaved work (no-op outside the panel). */
export const useReportImportersDirty = (dirty) => {
  const report = useContext(DirtyReportContext)
  const id = useId()
  useEffect(() => { report?.(id, Boolean(dirty)) }, [report, id, dirty])
  useEffect(() => () => { report?.(id, false) }, [report, id])
}

/** Where the levels of this Sheet are drawn. `children` is level 0. The ref has `backTop()` (Escape: back one level). */
export const ImportersStack = forwardRef(function ImportersStack ({ rootTitle, children, onDepthChange }, ref) {
  const [, t] = useLanguage()
  const [levels, setLevels] = useState([]) // [{ level, title, back }] sorted by level, level >= 1
  const [slots, setSlots] = useState({}) // level → DOM node
  const latest = useRef({ onDepthChange })
  latest.current = { onDepthChange }

  const register = useCallback((entry) => {
    setLevels(prev => [...prev.filter(item => item.level !== entry.level), entry].sort((a, b) => a.level - b.level))
    return () => setLevels(prev => prev.filter(item => item.level !== entry.level || item.id !== entry.id))
  }, [])

  const update = useCallback((entry) => {
    setLevels(prev => prev.map(item => (item.level === entry.level && item.id === entry.id ? { ...item, ...entry } : item)))
  }, [])

  const depth = levels.length ? levels[levels.length - 1].level : 0

  const levelsRef = useRef(levels)
  levelsRef.current = levels
  useImperativeHandle(ref, () => ({
    backTop: () => {
      const top = levelsRef.current[levelsRef.current.length - 1]
      top?.back()
    }
  }), [])

  useLayoutEffect(() => {
    latest.current.onDepthChange?.(depth)
  }, [depth])

  const slotRef = useCallback(level => node => {
    setSlots(prev => (prev[level] === node ? prev : { ...prev, [level]: node }))
  }, [])
  const refs = useRef({})
  const refFor = level => {
    if (!refs.current[level]) refs.current[level] = slotRef(level)
    return refs.current[level]
  }

  const titleOf = level => (level === 0 ? rootTitle : levels.find(item => item.level === level)?.title)
  // review (3.C): where the focus goes when a level closes and its opener is gone or hidden. `alive` is false once the whole panel
  // closes: then the Sheet gives the focus back itself.
  const rootRef = useRef(null)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])
  const context = useMemo(() => ({ register, update, slots, depth, titleOf, rootRef, aliveRef }), [register, update, slots, depth, levels, rootTitle])

  // position from the top: 0 is the last level, 1 the one under it (in view from 1100px), 2+ never in view
  const pos = level => depth - level

  return (
    <StackContext.Provider value={context}>
      <div className='odc-imp-stack' data-depth={depth} ref={rootRef}>
        <section className='odc-imp-pane' data-pos={pos(0)} aria-label={rootTitle} hidden={pos(0) > 1 ? true : undefined}>
          {children}
        </section>
        {levels.map(({ level, id, title, back }) => (
          <section
            key={`${level}-${id}`}
            className='odc-imp-pane'
            data-pos={pos(level)}
            aria-label={title}
            hidden={pos(level) > 1 ? true : undefined}
          >
            <div className='odc-imp-pane-head'>
              {/* below 1100px: back to the previous level by its name; from 1100px the previous level is in view and this is an X */}
              <Button className='odc-imp-back' variant='ghost' icon={ChevronLeft} onClick={back}>
                {titleOf(level - 1)}
              </Button>
              <h3 className='odc-imp-pane-title' tabIndex={-1}>{title}</h3>
              <IconButton className='odc-imp-close' icon={X} label={t('CLOSE_PANEL_NAMED', 'Close _name_').replace('_name_', title)} onClick={back} />
            </div>
            <div className='odc-imp-pane-body' ref={refFor(level)} />
          </section>
        ))}
      </div>
    </StackContext.Provider>
  )
})

let paneIds = 0

/**
 * One level of the Importers panel, declared by the component that owns it.
 *
 * @param {object} props
 * @param {string} props.title the level's name (its heading and the «‹ back» of the level above it)
 * @param {() => void} props.onBack the owner closes it (it is called once the leave guard of this level let it go)
 */
export const ImportersPane = ({ title, onBack, children }) => {
  const [, t] = useLanguage()
  const stack = useContext(StackContext)
  const parent = useContext(LevelContext)
  const level = parent + 1
  const idRef = useRef(null)
  if (idRef.current == null) idRef.current = ++paneIds

  const leave = useLeaveGuardHost()
  // the level below asks this one (and, through it, the ones above) before it lets the user go
  useNestedLeaveGuard(leave.requestLeave)
  useReportImportersDirty(leave.dirty)

  const latest = useRef({ onBack })
  latest.current = { onBack }
  const back = useCallback(() => {
    leave.requestLeave(() => latest.current.onBack?.())
  }, [leave.requestLeave])

  useLayoutEffect(() => {
    if (!stack) return undefined
    return stack.register({ level, id: idRef.current, title, back })
  }, [stack?.register, level])

  useLayoutEffect(() => {
    stack?.update({ level, id: idRef.current, title, back })
  }, [title, back])

  const node = stack?.slots[level]

  // review (3.C), focus: opening a level takes the focus to its title (the opener may be hidden below 1100px, or a menu item that
  // left); closing it gives the focus back to the opener when it is still in view, else to the title of the level now on top (or to
  // the first control of the list).
  const openerRef = useRef(null)
  useLayoutEffect(() => {
    openerRef.current = typeof document !== 'undefined' ? document.activeElement : null
  }, [])
  useEffect(() => {
    if (!node) return undefined
    const pane = node.closest('.odc-imp-pane')
    const frame = requestAnimationFrame(() => {
      if (pane && !pane.contains(document.activeElement)) pane.querySelector('.odc-imp-pane-title')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [node])
  useEffect(() => () => {
    const opener = openerRef.current
    const root = stack?.rootRef.current
    requestAnimationFrame(() => {
      if (!stack?.aliveRef.current || !root?.isConnected) return
      const active = document.activeElement
      if (active && active !== document.body && active.isConnected && root.contains(active)) return
      if (opener?.isConnected && root.contains(opener) && opener.getClientRects().length > 0 && !opener.disabled) {
        opener.focus()
        return
      }
      const top = root.querySelector(".odc-imp-pane[data-pos='0']")
      const target = top?.querySelector('.odc-imp-pane-title') ||
        top?.querySelector('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      target?.focus()
    })
  }, [])

  if (!node) return null

  return createPortal(
    <LevelContext.Provider value={level}>
      <LeaveGuardContext.Provider value={leave.context}>
        {children}
        <LeaveDialog
          open={leave.dialog.open}
          saving={leave.dialog.saving}
          onKeep={leave.dialog.onKeep}
          onDiscard={leave.dialog.onDiscard}
          onSave={leave.dialog.onSave}
          returnFocus={leave.dialog.returnFocus}
          title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
          description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.').replace('_section_', title)}
          keepLabel={t('KEEP_EDITING', 'Keep editing')}
          saveLabel={t('SAVE_AND_CONTINUE', 'Save and continue')}
          discardLabel={t('DISCARD', 'Discard')}
          closeLabel={t('CLOSE', 'Close')}
        />
      </LeaveGuardContext.Provider>
    </LevelContext.Provider>,
    node
  )
}

/**
 * Focuses `target` (an element or a function that returns one) once the page behind a closing dialog lets it, for up to 60 frames,
 * as P/LeaveGuard does; it gives up when the user put the focus somewhere else meanwhile. For a dialog's `finalFocus` when its
 * opener is gone (a menu item) or disabled (Import while the job runs).
 */
export const focusWhenFree = (target) => {
  let frames = 0
  const attempt = () => {
    const node = typeof target === 'function' ? target() : target
    if (!node?.isConnected) {
      if (frames++ < 60) requestAnimationFrame(attempt)
      return
    }
    const active = document.activeElement
    if (active && active !== document.body && active !== node && !active.closest('[role="alertdialog"]')) return
    node.focus({ preventScroll: true })
    if (document.activeElement !== node && frames++ < 60) requestAnimationFrame(attempt)
  }
  requestAnimationFrame(attempt)
}

/** The level of the caller (0 on the list). */
export const useImportersLevel = () => useContext(LevelContext)
