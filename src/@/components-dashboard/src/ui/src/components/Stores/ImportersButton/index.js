import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { Button, Sheet } from '../../Shared/Product'
import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../Shared/Product/LeaveGuard'
import { Upload } from '../../Shared/Icon'
import { ImportersListing } from '../ImportersListing'
import { ImportersDirtyProvider, ImportersStack, useImportersDirty } from './ImportersPanes'
import { useRouteLeaveGuard } from '../../../hooks/useRouteLeaveGuard'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import './importers.css'

// redesign stores 3.A: opt-in controlled mode (P-1: the phone header's «⋯» opens the same panel). `open` (when not
// undefined) drives the panel, `onOpenChange(open)` is told when it wants to open/close (click, the panel's close, and
// ?header=importers on mount) and `hideTrigger` drops the trigger while the panel host stays. The URL contract is the same
// (?header=importers is written on open and removed on close). Without these props nothing changes.
//
// redesign stores 3.C: the panel is a P/Sheet (`end`) instead of the legacy SideBar with its expand icon. Its levels
// (list → import or importer form → advanced options or a mapping) are ImportersPanes: from 1100px the two last ones side by side,
// below only the last. Escape goes back one level; the X and the scrim close the panel. Both ask first when a form has unsaved work.
// `returnFocusRef` (optional): where the focus goes when the panel closes and its opener has left the page (the phone's «⋯»).
export const ImportersButton = (props) => {
  const { setOpenSidebar, onImportSuccess, open, onOpenChange, hideTrigger, returnFocusRef, business, businessLoading } = props
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [internalOpen, setInternalOpen] = useState(false)
  const [depth, setDepth] = useState(0)
  const isControlled = open !== undefined
  const openImporters = isControlled ? !!open : internalOpen
  const leave = useLeaveGuardHost()
  // redesign bugs E: the sidebar, links, back/forward, ⌘K and Mia ask too while the panel holds unsaved work, its own
  // forms or those of its levels (each level is a host, so they tell the panel through `levels.report`)
  const levels = useImportersDirty()
  useRouteLeaveGuard({ active: openImporters && (leave.dirty || levels.dirty), requestLeave: leave.requestLeave })
  const stackRef = useRef(null)
  const escapeRef = useRef(false)
  const triggerRef = useRef(null)

  // a panel opened from the URL (?header=importers) has no opener, so Base UI got <body> and focused the first tabbable
  // element of the document, the shell's «Skip to content». The Sheet's `returnFocus` is used only when the opener is the body or
  // has left the page: the Importers trigger (the page's, or this one), else the page's h1.
  const sheetReturnFocus = () => {
    const trigger = returnFocusRef ? returnFocusRef.current : triggerRef.current
    if (trigger?.isConnected) return trigger
    const heading = document.querySelector('h1')
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    return heading
  }

  const requestOpen = (next) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange && onOpenChange(next)
  }

  const handleOpenImporters = () => {
    setOpenSidebar && setOpenSidebar('importer')
    requestOpen(true)
    addQueryToUrl({ header: 'importers' })
  }

  const handleCloseImporters = () => {
    requestOpen(false)
    removeQueryToUrl(['header'])
    if (returnFocusRef?.current) {
      const target = returnFocusRef.current
      // the Sheet gives the focus back to its opener first; when that was a menu item that left the page, this one takes it
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (target.isConnected && (document.activeElement === document.body || !document.activeElement)) target.focus()
      }))
    }
  }

  // The Sheet only says «close». An Escape just typed (and not the X or the scrim) goes back one level while there is one.
  useEffect(() => {
    if (!openImporters) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      escapeRef.current = true
      setTimeout(() => { escapeRef.current = false }, 0)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [openImporters])

  const handleSheetOpenChange = (next) => {
    if (next) return
    if (escapeRef.current && depth > 0) {
      stackRef.current?.backTop()
      return
    }
    leave.requestLeave(handleCloseImporters)
  }

  useEffect(() => {
    const header = query.get('header')
    if (header === 'importers') {
      requestOpen(true)
    }
  }, [])

  // Controlled: the owner (the «⋯» menu) turned `open` on from outside, so the URL still has to carry it.
  useEffect(() => {
    // review (3.C): read the address bar, not useLocation: removeQueryToUrl uses replaceState, so the router's location is stale
    // after a close and a reopen would not write ?header=importers again
    const header = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('header') : query.get('header')
    if (isControlled && open && header !== 'importers') {
      addQueryToUrl({ header: 'importers' })
    }
  }, [isControlled, open])

  useEffect(() => {
    if (!openImporters) setDepth(0)
  }, [openImporters])

  return (
    <>
      {!hideTrigger && (
        <Button ref={triggerRef} icon={Upload} onClick={handleOpenImporters}>
          {t('IMPORTERS', 'Importers')}
        </Button>
      )}
      <Sheet
        open={openImporters}
        onOpenChange={handleSheetOpenChange}
        title={t('IMPORTERS', 'Importers')}
        closeLabel={t('CLOSE', 'Close')}
        className='odc-imp-sheet'
        returnFocus={sheetReturnFocus}
        data-detail={depth > 0 ? 'true' : undefined}
      >
        {openImporters && (
          <LeaveGuardContext.Provider value={leave.context}>
            <ImportersDirtyProvider value={levels.report}>
              <ImportersStack ref={stackRef} rootTitle={t('IMPORTERS', 'Importers')} onDepthChange={setDepth}>
                {/* (main #488): `business` is the open store on Products (none on Stores, where the panel asks for one) */}
                <ImportersListing
                  onImportSuccess={onImportSuccess}
                  business={business}
                  businessLoading={businessLoading}
                  onMenuImportClose={onImportSuccess}
                  onMenuImportGoToProducts={business ? handleCloseImporters : undefined}
                />
              </ImportersStack>
            </ImportersDirtyProvider>
            <LeaveDialog
              open={leave.dialog.open}
              saving={leave.dialog.saving}
              onKeep={leave.dialog.onKeep}
              onDiscard={leave.dialog.onDiscard}
              onSave={leave.dialog.onSave}
              returnFocus={leave.dialog.returnFocus}
              title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
              description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.').replace('_section_', t('IMPORTERS', 'Importers'))}
              keepLabel={t('KEEP_EDITING', 'Keep editing')}
              saveLabel={t('SAVE_AND_CONTINUE', 'Save and continue')}
              discardLabel={t('DISCARD', 'Discard')}
              closeLabel={t('CLOSE', 'Close')}
            />
          </LeaveGuardContext.Provider>
        )}
      </Sheet>
    </>
  )
}
