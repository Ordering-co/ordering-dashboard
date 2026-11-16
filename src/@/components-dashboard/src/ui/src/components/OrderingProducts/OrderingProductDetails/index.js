import React, { useContext, useEffect, useRef, useState } from 'react'

import { SiteDetails as SiteDetailsController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Ellipsis, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import { AlertDialog, ConfirmDialog, IconButton, LeaveGuardContext, Menu, RecordPanel, useSplitView } from '../../Shared/Product'
import { OrderingProductGeneralDetails } from '../OrderingProductGeneralDetails'
import { SiteTheme } from '../SiteTheme'

// redesign (lot C, decisions 1, 3, 9, 10 | OP-03, OP-09, OP-10, OP-11, OP-15, OP-17): the panel of a site on Product, in place of
// the styled-components header, the `aria-pressed` tab buttons, the ⋯ `<select>` and the generic confirm of main. It mounts
// K/SiteDetails with `OrderingProductDetailsUI`: the controller brings `siteState`, `formState`, `isAddMode` and the handlers
// (`handleDeleteSite({ inlineError })` answers `{ error, result }`, and it calls `props.onClose` once a site is created or deleted).
//
// Props the page (lot B) gives, besides what main gave it (`site`, `sitesList`, `handleSuccessUpdateSites`, `enableAutoFillFromWebsite`):
//  - `initialTab` ('general' | 'theme'; anything else is General) and `onTabChange(tab)`: the page keeps `?tab=`;
//  - `expanded` and `onToggleExpanded()`: «Open as page» / «Back to split view»;
//  - `onRequestClose()`: the ✕ / «Back» (the page sends it through the leave guard); `onClose()`: close without asking, which the
//    controller calls after a success.
// The page mounts the panel with a `key` (the id of the site or 'new'), so each site starts clean (OP-01).

const resolveTab = (tab) => (tab === 'theme' ? 'theme' : 'general')

// redesign (review r1, Q-10): each line of the API goes through the dictionary (`translateApiMessage`), as General, Theme and the list do
const errorLines = (result, fallback, t) => {
  const list = (Array.isArray(result) ? result : [result]).flat().filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list.map(message => translateApiMessage(t, message, fallback)))] : [fallback]
}

const OrderingProductDetailsUI = (props) => {
  const {
    site,
    siteState,
    isAddMode,
    handleDeleteSite,
    initialTab,
    onTabChange,
    expanded = false,
    onToggleExpanded,
    onRequestClose
  } = props

  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  // redesign (review r1, Q-03): the panel has ONE close guard. General and Theme register only in the host (their
  // `registerCloseGuard` is a no-op), because the SplitView stops at the first guard that answers and each form asks only about itself.
  // Esc, the scrim and the ✕ go through the host with no `only`, so the question covers both tabs and «Save and continue» saves both.
  const host = useContext(LeaveGuardContext)
  const registerCloseGuard = split.registerCloseGuard
  useEffect(() => registerCloseGuard(proceed => {
    if (!host) return false
    host.requestLeave(proceed)
    return true
  }), [registerCloseGuard, host])
  // redesign (OP-15): the controller learns `isAddMode` in an effect, one render late; the missing site is known at once,
  // so the first render of an add never draws the tabs and never mounts Theme
  const adding = Boolean(isAddMode) || !site
  const current = siteState?.site ?? {}
  const name = current.name || t('PRODUCT', 'Product')

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ---- tabs: General and Theme. Theme is mounted the first time it is visited and stays mounted (RecordPanel keeps the panels,
  // so a draft in General survives a visit to Theme, OP-17). Adding has no tabs and never Theme (OP-15). ----
  const [tab, setTab] = useState(() => resolveTab(initialTab))
  const [themeVisited, setThemeVisited] = useState(false)
  const selected = adding ? 'general' : tab
  const showTheme = !adding && (themeVisited || selected === 'theme')
  useEffect(() => {
    if (selected === 'theme') setThemeVisited(true)
  }, [selected])
  // the page can change the tab on its own (the browser's Back, a link with `?tab=`)
  useEffect(() => {
    setTab(resolveTab(initialTab))
  }, [initialTab])
  const changeTab = (value) => {
    const next = resolveTab(value)
    setTab(next)
    onTabChange?.(next)
  }

  // ---- Delete (C8): the name, «This can't be undone.», and a failure said in an alert ----
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const deleteSite = async () => {
    if (deleting) return
    setDeleting(true)
    let result
    try {
      result = await handleDeleteSite?.({ inlineError: true })
    } catch (error) {
      result = { error: true, result: [error?.message] }
    }
    if (!mounted.current) return // on success the controller closed the panel
    setDeleting(false)
    setConfirmOpen(false)
    if (result?.error) {
      setDeleteErrors(errorLines(result.result, t('ORDERING_PRODUCTS_DELETE_ERROR', 'The product could not be deleted.'), t))
    }
  }

  const headerActions = !adding && (
    <>
      {!phone && onToggleExpanded && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => split.guardPlaceChange(() => onToggleExpanded())}
        />
      )}
      <Menu
        label={t('MORE_ACTIONS', 'More actions')}
        icon={Ellipsis}
        items={[{ key: 'delete', label: t('DELETE', 'Delete'), icon: Trash2, tone: 'danger', onSelect: () => setConfirmOpen(true) }]}
        triggerProps={{ disabled: deleting }}
      />
    </>
  )

  const general = <OrderingProductGeneralDetails {...props} isAddMode={adding} onInvalid={() => changeTab('general')} />
  // the add form has no tabs (OP-15); explicit props, no spread (ruleset l6-d1 pins every JSX spread)
  const tabs = adding
    ? undefined
    : {
        label: t('PRODUCT_EDITOR_SECTIONS', 'Product sections'),
        value: selected,
        onValueChange: changeTab,
        items: [
          { value: 'general', label: t('GENERAL', 'General'), content: general },
          { value: 'theme', label: t('THEME', 'Theme'), content: showTheme ? <SiteTheme siteId={current.id ?? site?.id} /> : null }
        ]
      }

  return (
    <>
      <RecordPanel
        className='odc-op-panel'
        title={adding ? t('ADD_PRODUCT', 'Add product') : <span dir='auto'>{name}</span>}
        subtitle={!adding && current.code ? <span className='odc-figure' dir='ltr'>{current.code}</span> : null}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onRequestClose}
        headerActions={headerActions || undefined}
        tabs={tabs}
      >
        {adding ? general : null}
      </RecordPanel>

      <ConfirmDialog
        open={confirmOpen}
        title={t('DELETE_PRODUCT_TITLE', 'Delete _name_?').replace('_name_', () => name)}
        confirmLabel={t('DELETE_PRODUCT', 'Delete product')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={deleting}
        onConfirm={deleteSite}
        onCancel={() => setConfirmOpen(false)}
      >
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>

      <AlertDialog
        open={Boolean(deleteErrors)}
        title={t('ORDERING_PRODUCTS', 'Ordering products')}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={() => setDeleteErrors(null)}
      />
    </>
  )
}

export const OrderingProductDetails = (props) => {
  const productDetailsProps = {
    ...props,
    UIComponent: OrderingProductDetailsUI
  }
  return <SiteDetailsController {...productDetailsProps} />
}
