import React, { useState, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'

import { useSession, useLanguage, useConfig, useApi, useEvent, BusinessDetails as BusinessDetailsController } from '~components'

import { AlertDialog, Button, EmptyState, IconButton, InlineNotice, SectionNav, useEditorPanel, useProductDir } from '../../Shared/Product'
import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../Shared/Product/LeaveGuard'
import { Store, X } from '../../Shared/Icon'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { BUSINESS_PALETTE_SECTIONS, URL_ONLY_SECTION_KEYS, canOpenStoreSection, getSectionAccess, isCustomFieldsShortcutOffered, isStoreSectionKey } from '../../../../../utils/businessDetailSections'
import { EDITOR_PANEL_EXPAND_FROM, getPanelSize } from '../../../../../utils/editorPanel'
import { useRouteLeaveGuard } from '../../../hooks/useRouteLeaveGuard'
import { canRegisterStores } from '../../../../../utils/storeAdd'

import { StoreEditorHeader } from './StoreEditorHeader'
import { StoreOverview } from './StoreOverview'
import { StoreSectionBody } from './StoreSectionBody'
import { STORE_OVERVIEW_ID, STORE_SECTION_QUERY_KEYS, buildStoreSectionGroups, useStoreSections } from './storeSections'
import { BarContainer } from './styles'

// redesign SL-F2 (B2)
// The shell of the store editor (`/stores/list?id=&section=`): one panel fixed at the end of the page, with the header, the
// list of sections (SectionNav) and, below or beside it, the Overview or the open section. Before, the summary and the
// section were two panels (the section a second column at 1000px or a modal under it); now it is one panel whose width
// follows the state (see store-editor.css), and a section is one click from any other.
//
// The panel is never a container, a containing block or a transform: the legacy SideBars that the sections open are fixed
// and must paint over the page, not inside the panel.

// redesign SP-F0 (E0): the width rule moved to utils/editorPanel and the focus/Escape contract to Shared/Product/useEditorPanel.
// getPanelSize stays exported from here for the tests that import it.
export { getPanelSize }

export const BusinessDetailsUI = (props) => {
  const {
    open,
    businessState,
    handleChangeActiveBusiness,
    handleDuplicateBusiness,
    handleDeleteBusiness,
    formState,
    setFormState,
    handleUpdateBusinessClick,
    actionStatus,
    streamConnectionState
  } = props

  const location = useLocation()
  const history = useHistory()
  const query = new URLSearchParams(location.search)
  const [, t] = useLanguage()
  const [events] = useEvent()
  const [ordering] = useApi()
  const [{ configs }] = useConfig()
  const { width } = useWindowSize()
  const [{ user }] = useSession()
  const dir = useProductDir()
  const titleId = useId()
  const panelRef = useRef(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isExtendExtraOpen, setIsExtendExtraOpen] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // redesign stores 4.A (decision 11): the section (or tab) an address asked for that this person may not open
  const [deniedSection, setDeniedSection] = useState(null)

  const business = businessState?.business
  const loading = !!businessState?.loading
  const spoonityConfig = business?.configs?.find(config => config.key === 'spoonity_integration_api_key')
  const isAdmin = user?.level === 0
  // bugs E: Duplicate creates a store, so it follows the one rule of «Add new store»
  const isAllowRegisteredBusiness = canRegisterStores(user, configs)
  const sections = useStoreSections({ business, spoonityConfig, isAdmin })
  const sectionAccess = getSectionAccess({ user, project: ordering?.project })
  const storeUrl = useStoreWebsiteUrl(business?.slug)

  const sectionOpen = selectedItem != null
  const panelSize = getPanelSize({ width, isExpand, sectionOpen, isExtendExtraOpen })
  const { dockTop } = props
  const docked = panelSize === 'base' && Number.isFinite(dockTop)
  // The offset is a custom property written on the node (not a JSX style: the brand ruleset of this file pins it without one).
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    if (docked) panel.style.setProperty('--odc-se-dock-top', `${dockTop}px`)
    else panel.style.removeProperty('--odc-se-dock-top')
  }, [docked, dockTop])

  // redesign stores 2.A (decision 4): every way out of the editor (another section, the Overview, «Categories &
  // products», the close button, Escape, another store from the list or ⌘K) goes through `requestLeave`. With unsaved changes it
  // asks «Save and continue · Discard · Keep editing» instead of saving or dropping them in silence; with none it goes at once.
  // What can be unsaved: the shared form of the controller (registered below) and, from wave 5, each section's own form
  // (`useLeaveGuard` inside the section). The list asks through `leaveGuardRef` before it opens another store.
  const leave = useLeaveGuardHost()
  const { requestLeave } = leave
  // ⌘K and Mia may remount the page (the same store, the list) or leave it; bugs E: the sidebar, links, back/forward
  // and closing the tab too. They ask here first while the open editor holds unsaved work (`leave.dirty`: its sections' forms and
  // the shared form, which tells the host below).
  useRouteLeaveGuard({ active: open && leave.dirty, requestLeave })

  // The list's way out: keeping editing also puts this editor's section back in the address that ⌘K changed.
  const keepSectionRef = useRef(null)
  useImperativeHandle(props.leaveGuardRef, () => ({
    requestLeave: (proceed, onCancel) => requestLeave(proceed, () => {
      keepSectionRef.current?.()
      onCancel?.()
    })
  }), [requestLeave])

  const changedKeys = Object.keys(formState?.changes || {})
  const hasPendingChanges = () => !formState?.loading && changedKeys.length > 0
  // A discard drops what the shared form holds; the store itself was never written.
  const discardSharedForm = () => setFormState(prev => ({ ...prev, changes: {} }))
  // The shell hosts the guard, so its own form registers on the host (a section uses `useLeaveGuard`, which reads the context).
  const sharedFormEntry = useRef(null)
  sharedFormEntry.current = {
    isDirty: hasPendingChanges,
    count: () => changedKeys.length,
    save: () => handleUpdateBusinessClick(),
    discard: discardSharedForm
  }
  useEffect(() => leave.context.register(sharedFormEntry), [leave.context])
  // the host's reactive `dirty` follows the shared form too (it registers by hand, not through `useLeaveGuard`)
  const sharedFormDirty = hasPendingChanges()
  useEffect(() => { leave.context.notifyDirty() }, [leave.context, sharedFormDirty])

  const actionSidebar = (value) => {
    setIsPanelOpen(value)

    if (!value) {
      props.onClose()
    }
  }

  const handleClose = () => requestLeave(() => actionSidebar(false))

  const handleOpenSite = () => {
    if (!storeUrl || loading) return
    window.open(storeUrl, '_blank', 'noopener,noreferrer')
  }

  // G5-48: it used to go without a word, dropping what the form held
  const handleOpenCategories = () => {
    requestLeave(() => events.emit('go_to_page', { page: 'store', params: { store: business?.slug } }))
  }

  // A section, from the list, the ⋯ menu or the deep link. Going from one section to another is what closing the first and
  // opening the second was: with unsaved changes it asks first (it used to save them without a word), and the query keys of
  // the first one go away. Keeping editing puts the address back on the open section (⌘K may have changed it).
  const handleSelectedItem = (key, isInitialRender, tab) => {
    // redesign stores 1.A (G1-26): `?section=overview` (an entry of the list, so a link someone can copy) is the
    // Overview, not a section without a body.
    if (key === STORE_OVERVIEW_ID) {
      handleShowOverview()
      return
    }
    // a key the editor does not have (`support` and `personalization`, deleted as dead code, or any other) used to
    // open an empty body. An old link with one lands on the Overview, and the address stops naming it.
    if (!isStoreSectionKey(key)) {
      removeQueryToUrl(STORE_SECTION_QUERY_KEYS)
      handleShowOverview()
      return
    }
    // redesign stores 4.A (decision 11): the body follows the menu's level and role rules. A section or tab this
    // person may not open (a copied link, an old bookmark) shows the Overview with a notice instead of its body.
    if (!canOpenStoreSection({ section: key, tab }, sectionAccess)) {
      handleDeniedSection(key, tab)
      return
    }
    setDeniedSection(null)
    if (!isInitialRender && key === selectedItem) {
      setIsExtendExtraOpen(false)
      return
    }
    const open = () => {
      if (!isInitialRender && selectedItem != null) removeQueryToUrl(STORE_SECTION_QUERY_KEYS)
      setIsExtendExtraOpen(false)
      setSelectedItem(key)
      if (!isInitialRender) {
        addQueryToUrl(tab ? { section: key, tab } : { section: key })
        // the section reads its tab from the router, which replaceState does not reach (as StoresTable's Schedule)
        if (tab && history?.replace) history.replace(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      }
    }
    // redesign stores 4.B: from the Overview too, since the slug typed there waits for its «Save» in the shared form
    if (isInitialRender) open()
    else requestLeave(open, keepSectionInAddress)
  }

  const handleDeniedSection = (key, tab) => {
    const sectionLabel = sections.find(section => section.id === key)?.label ?? key
    const tabEntry = tab ? BUSINESS_PALETTE_SECTIONS.find(entry => entry.section === key && entry.tab === tab) : null
    const label = tabEntry ? `${sectionLabel} › ${t(tabEntry.labelKey, tabEntry.label)}` : sectionLabel
    const showNotice = () => {
      setIsExtendExtraOpen(false)
      setDeniedSection(label)
      removeQueryToUrl(STORE_SECTION_QUERY_KEYS)
    }
    if (selectedItem == null) showNotice()
    else {
      requestLeave(() => {
        setSelectedItem(null)
        showNotice()
      }, keepSectionInAddress)
    }
  }

  // «Keep editing» (or a way out that did not happen): the section does not change, and the leave dialog gives the focus back
  const keepSectionInAddress = () => {
    navFocusPending.current = false
    if (selectedItem != null) addQueryToUrl({ section: selectedItem })
    else removeQueryToUrl(STORE_SECTION_QUERY_KEYS)
  }
  keepSectionRef.current = keepSectionInAddress

  // Back to the Overview. With unsaved changes it asks first; what is left (nothing after either answer) is not sent again.
  const handleShowOverview = () => {
    if (selectedItem == null) {
      setIsExtendExtraOpen(false)
      return
    }
    requestLeave(() => {
      setIsExtendExtraOpen(false)
      setSelectedItem(null)
      removeQueryToUrl(STORE_SECTION_QUERY_KEYS)
    }, keepSectionInAddress)
  }

  // redesign stores 4.B: the list of sections sits below the summary on the Overview and beside (or above) a section,
  // so going from one to the other moves it; a choice made in it (or in a figure of the summary) puts the focus back on the entry
  // of the section now open, instead of leaving it on the page.
  const navFocusPending = useRef(false)
  const navRef = useRef(null)
  // `tab` (optional) opens the section on that tab, as `?section=&tab=` does (Order with Google sends Store details › Location)
  const handleChooseSection = (id, tab) => {
    navFocusPending.current = true
    if (id === STORE_OVERVIEW_ID) handleShowOverview()
    else handleSelectedItem(id, false, tab)
  }
  useLayoutEffect(() => {
    if (!navFocusPending.current) return
    navFocusPending.current = false
    const pick = () => {
      const nav = navRef.current
      return nav?.querySelector('[aria-current="page"]') || nav?.querySelector('button')
    }
    const target = pick()
    if (!target) return undefined
    target.focus()
    // redesign bugs F row 20 (live check L-2): at 390 the list first draws its rows and a moment later turns into its
    // compact trigger, which takes the focused row away (the focus fell to <body>). For a few frames a focus dropped to <body> goes to
    // the entry the list draws now (one the user put somewhere real stays there).
    let frames = 0
    let frame = 0
    const hold = () => {
      const active = document.activeElement
      if (!active || active === document.body) pick()?.focus()
      if (++frames < 10) frame = window.requestAnimationFrame(hold)
    }
    frame = window.requestAnimationFrame(hold)
    return () => window.cancelAnimationFrame(frame)
  }, [selectedItem, isExtendExtraOpen]) // redesign bugs F row 20: «All sections» brings the list back too

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open])

  useEffect(() => {
    setSelectedItem(null)
    setIsExtendExtraOpen(false)
    setDeniedSection(null)
  }, [props.businessId])

  // redesign stores 4.B (decision 4): the slug is no longer sent as it is typed; the Overview saves it with its own
  // «Save», and until then it is in the shared form, so leaving asks (above).

  // redesign SL-(R-04) and Escape: see Shared/Product/useEditorPanel (promoted in SP-F0, E0).
  // redesign bugs Q: whenever the panel is `full` (a phone, a section between 500 and 999px, Expand or a section that asks
  // for the whole width) it covers the list, so what is behind it is inert and it is a modal dialog; the Overview beside the list
  // (`base`) and a `wide` section stay non-modal panels.
  useEditorPanel({ open, panelRef, onClose: handleClose, resetKey: props.businessId, modal: panelSize === 'full' })

  // (T10): the list docks the panel beside it in `base` (BusinessesListing EDITOR_DOCK_FROM); it hears the width state
  // here, and null once the editor closes or unmounts
  const { onPanelSizeChange } = props
  useEffect(() => {
    onPanelSizeChange?.(open ? panelSize : null)
  }, [onPanelSizeChange, open, panelSize])
  useEffect(() => () => onPanelSizeChange?.(null), [onPanelSizeChange])

  useEffect(() => {
    if (!actionStatus?.error) return
    setAlertState({
      open: true,
      content: actionStatus?.error
    })
  }, [actionStatus?.error])

  useEffect(() => {
    if (!businessState?.error) return
    setAlertState({
      open: true,
      content: businessState?.error
    })
  }, [businessState?.error])

  useEffect(() => {
    if (loading || !business) return
    const detailKey = query.get('section')
    if (detailKey) {
      handleSelectedItem(detailKey, true, query.get('tab'))
    }
  }, [businessState?.loading])

  // redesign SL-F1 (A3): the deep link is also followed while the editor is already open for this store (the ⋯ menu of the list opens
  // a store with `?section=schedule`, and the store may be the one on screen). The router location is what changes: `location.key` is
  // new on each `history.replace`, even when the address is the same as the router last saw (addQueryToUrl does not reach the router,
  // so after a click inside the editor the router's copy of `?section=` can be stale). Only a section that is not the open one is
  // applied, only once this store has loaded, and it goes through the same path as a click (saves what the form holds, drops the
  // query keys of the section it leaves). The first load is the effect above.
  const followedLocation = useRef(location.key)
  useEffect(() => {
    if (followedLocation.current === location.key) return // the mount: the effect above applies the link
    followedLocation.current = location.key
    if (loading || !business || String(business.id) !== String(props.businessId)) return
    const params = new URLSearchParams(location.search)
    // redesign stores 2.A: an address for another store is the list's to follow (it asks this editor first)
    if (params.get('id') != null && String(params.get('id')) !== String(props.businessId)) return
    const detailKey = params.get('section')
    if (!detailKey || detailKey === selectedItem) return
    handleSelectedItem(detailKey, false, params.get('tab'))
  }, [location.key, location.search])

  const notFound = !loading && !business
  const showNav = !loading && !!business && !(sectionOpen && isExtendExtraOpen)
  // redesign stores 4.A (decision 2): five groups with a title. The open section is always listed, so it is
  // marked even when the menu hides it by config (Custom fields from the ⋯ menu on a project with no `show_metafields`, G1-26),
  // except a section reachable by URL only (Places, ).
  const groupLabels = Object.fromEntries(buildStoreSectionGroups(t).map(group => [group.id, group.label]))
  const navItems = sections
    .filter(section => section.enabled || (section.id === selectedItem && !URL_ONLY_SECTION_KEYS.includes(section.id)))
    .map(({ id, label, group }) => ({ id, label, group: groupLabels[group] }))

  const sectionNav = showNav && (
    <div className='odc-se-nav' ref={navRef}>
      <SectionNav
        className='odc-se-sections'
        label={t('STORE_SECTIONS', 'Store sections')}
        compactLabel={t('SECTION', 'Section')}
        items={navItems}
        value={selectedItem ?? STORE_OVERVIEW_ID}
        onValueChange={handleChooseSection}
      />
    </div>
  )

  // what holds the unsaved changes: the open section, or the Overview (its slug)
  const leavingLabel = sections.find(section => section.id === (selectedItem ?? STORE_OVERVIEW_ID))?.label ?? business?.name ?? ''

  return (
    <LeaveGuardContext.Provider value={leave.context}>
    <BarContainer
      id='business_details_bar'
      ref={panelRef}
      tabIndex={-1}
      dir={dir}
      aria-labelledby={titleId}
      aria-busy={loading || undefined}
      data-open={isPanelOpen ? '' : undefined}
      data-size={panelSize}
      data-section={sectionOpen ? '' : undefined}
      // redesign tanda AB (): docked beside the list the panel starts under the page header; the list says where
      // (`dockTop`). Only the Overview (`base`) docks. It is a custom property, not the width, which keeps coming from `data-size`.
      data-docked={docked ? '' : undefined}
    >
      <StoreEditorHeader
        titleId={titleId}
        loading={loading}
        business={business}
        handleChangeActiveBusiness={handleChangeActiveBusiness}
        onOpenCategories={handleOpenCategories}
        storeUrl={storeUrl}
        onOpenSite={handleOpenSite}
        isAllowRegisteredBusiness={isAllowRegisteredBusiness}
        handleDuplicateBusiness={handleDuplicateBusiness}
        handleDeleteBusiness={handleDeleteBusiness}
        onSelectSection={handleSelectedItem}
        showCustomFields={isCustomFieldsShortcutOffered(sectionAccess, configs)}
        formState={formState}
        setFormState={setFormState}
        handleUpdateBusinessClick={handleUpdateBusinessClick}
        streamConnectionState={streamConnectionState}
        showExpand={width > EDITOR_PANEL_EXPAND_FROM && !sectionOpen}
        isExpand={isExpand}
        onToggleExpand={() => setIsExpand(prev => !prev)}
        isExtendExtraOpen={sectionOpen && isExtendExtraOpen}
        onShowAllSections={() => {
          // redesign bugs F row 20 (R-6b): the button goes away with the click; the focus goes to the open section's entry
          navFocusPending.current = true
          setIsExtendExtraOpen(false)
        }}
        onClose={handleClose}
      />
      {notFound
        ? (
          <div className='odc-se-notfound'>
            <EmptyState
              icon={Store}
              title={t('NOT_FOUND_BUSINESS', 'Sorry, we couldn\'t find the requested business.')}
              action={<Button variant='primary' onClick={() => props?.onClose?.()}>{t('STORE_REDIRECT', 'Go to Stores')}</Button>}
            />
          </div>
          )
        : (
          <div
            className='odc-se-main'
            data-view={sectionOpen ? 'section' : 'overview'}
            data-nav={showNav ? undefined : 'hidden'}
          >
            {/* Above the summary and the list, so it is seen without scrolling */}
            {deniedSection && !sectionOpen && (
              // role=alert: it shows up once the store has loaded, and a polite status inserted with its text is often not read
              <InlineNotice
                tone='info'
                role='alert'
                className='odc-se-denied'
                action={<IconButton icon={X} size='sm' label={t('CLOSE', 'Close')} onClick={() => setDeniedSection(null)} />}
              >
                {t('STORE_SECTION_NO_ACCESS', 'Your account can\'t open _section_ for this store, so this is its overview.').replace('_section_', deniedSection)}
              </InlineNotice>
            )}
            {/* redesign stores 4.B (decision 3, G1-29): on the Overview the summary comes first and the list of
                sections below it; with a section open the list is beside (or above) it, as before. */}
            {sectionOpen && sectionNav}
            <div className='odc-se-content'>
              {sectionOpen
                ? (
                  <StoreSectionBody
                    {...props}
                    section={selectedItem}
                    isAdmin={isAdmin}
                    sectionAccess={sectionAccess}
                    spoonityConfig={spoonityConfig}
                    isExtendExtraOpen={isExtendExtraOpen}
                    setIsExtendExtraOpen={setIsExtendExtraOpen}
                    onOpenSection={handleChooseSection}
                    canOpenSection={(id, tab) => sections.some(section => section.id === id && section.enabled) && canOpenStoreSection({ section: id, tab }, sectionAccess)}
                  />
                  )
                : (
                  <StoreOverview
                    key={props.businessId}
                    loading={loading}
                    business={business}
                    isAdmin={isAdmin}
                    isWhiteLabelModule={!!configs?.white_label_module?.value}
                    is12Hours={String(configs?.format_time?.value) === '12'}
                    storeUrl={storeUrl}
                    onOpenSite={handleOpenSite}
                    formState={formState}
                    setFormState={setFormState}
                    handleUpdateBusinessClick={handleUpdateBusinessClick}
                    sections={sections}
                    canOpenSection={id => sections.some(section => section.id === id && section.enabled)}
                    onOpenSection={handleChooseSection}
                  />
                  )}
            </div>
            {!sectionOpen && sectionNav}
          </div>
          )}
      <LeaveDialog
        open={leave.dialog.open}
        saving={leave.dialog.saving}
        onKeep={leave.dialog.onKeep}
        onDiscard={leave.dialog.onDiscard}
        onSave={leave.dialog.onSave}
        returnFocus={leave.dialog.returnFocus}
        fallbackFocus={panelRef}
        title={t('LEAVE_UNSAVED_TITLE', 'Save your changes?')}
        description={t('LEAVE_UNSAVED_DESCRIPTION', 'You have unsaved changes in _section_. Save them before you leave, or discard them.').replace('_section_', leavingLabel)}
        keepLabel={t('KEEP_EDITING', 'Keep editing')}
        saveLabel={t('SAVE_AND_CONTINUE', 'Save and continue')}
        discardLabel={t('DISCARD', 'Discard')}
        closeLabel={t('CLOSE', 'Close')}
      />
      <AlertDialog
        open={alertState.open}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={() => setAlertState({ open: false, content: [] })}
      />
    </BarContainer>
    </LeaveGuardContext.Provider>
  )
}

export const BusinessDetails = (props) => {
  const businessDetailsProps = {
    ...props,
    asDashboard: true,
    UIComponent: BusinessDetailsUI
  }

  return <BusinessDetailsController {...businessDetailsProps} />
}
