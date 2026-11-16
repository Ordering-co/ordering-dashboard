import React, { useState, useEffect, useId, useImperativeHandle, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { useLanguage, ProductDetatils as ProductDetatilsController } from '~components'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Button, EmptyState, SectionNav, useEditorPanel, useProductDir } from '../../Shared/Product'
import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../Shared/Product/LeaveGuard'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { TriangleAlert } from '../../Shared/Icon'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { getPanelSize } from '../../../../../utils/editorPanel'
import { useRouteLeaveGuard } from '../../../hooks/useRouteLeaveGuard'
import { ProductFormValidationContext } from './productFormValidation'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'

import { ProductEditorHeader } from './ProductEditorHeader'
import { ProductOverview } from './ProductOverview'
import { ProductSectionBody } from './ProductSectionBody'
import {
  DEFAULT_PRODUCT_DETAILS_TAB,
  PRODUCT_DETAILS_SECTION,
  PRODUCT_DETAILS_TABS,
  PRODUCT_OVERVIEW_ID,
  PRODUCT_SECTION_QUERY_KEYS,
  entryFromUrl,
  entryToQuery,
  parseEntryId,
  useProductSections
} from './productSections'
import { BarContainer } from './styles'

// redesign SP-F1 (D1)
// The shell of the product editor (`/stores/products?category=&product=&section=&tab=`): one panel fixed at the end of the
// page, with the header, the list of sections (SectionNav) and, below or beside it, the Overview or the open section. It is
// the shell of the store editor (Stores/BusinessDetails) for a product. Before, the summary and the section were two panels
// (the section a second column at 1000px or a modal under it, the width written on the node by id); now it is one panel
// whose width follows the state (`data-size`, see product-editor.css), and a section is one click from any other.
//
// The panel is never a container, a containing block or a transform: the legacy fixed SideBars that the sections open
// (Labels, ingredient and extra details) are fixed and must paint over the page, not inside the panel.
//
// ONE handler decides `section` + `tab` (audit 4). The state is one entry (`productSections.js`): `product_details:<tab>`
// for the five tabs of Product details, the section itself for the rest. ProductMainDetails gets the tab (`tab`, controlled)
// and hides its own bar (`hideTabs`); the shell writes `?section=&tab=` and reads them back once, when it mounts.

export const ProductDetailsUI = (props) => {
  const {
    open,
    productState,
    formState,
    handleChangeFormState,
    handleUpdateClick,
    handleChangeProductActiveState,
    handleDuplicateProduct,
    handleDeleteProduct,
    duplicateState,
    productCart,
    showProductOption,
    getProduct,
    cleanFormState
  } = props

  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const isPhone = useIsPhone()
  const dir = useProductDir()
  const titleId = useId()
  const panelRef = useRef(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isExtendExtraOpen, setIsExtendExtraOpen] = useState(false)
  const [isExpand, setIsExpand] = useState(false)

  const product = productState?.product
  // Skeletons only while there is nothing to show; a Reload (the Preview's) over a loaded product keeps the editor and only marks it busy.
  const loading = !product && (!!productState?.loading || !productState?.error)
  const failed = !product && !productState?.loading && !!productState?.error
  const refreshing = !!product && !!productState?.loading
  const sections = useProductSections({ product })

  const sectionOpen = selectedEntry != null
  const { section: openSection, tab: openTab } = parseEntryId(selectedEntry)
  const panelSize = getPanelSize({ width, isExpand, sectionOpen, isExtendExtraOpen })

  // redesign (J2, P-14 / D-56 f): the product editor hosts the leave guard, as the store editor does
  // (Stores/BusinessDetails). Every way out (the X, Escape, another section or tab, the Overview, a route change, the list opening
  // another product) goes through `requestLeave`: with unsaved edits it asks «Keep editing · Save and continue · Discard» instead of
  // closing or moving on in silence; with none it goes at once. What can be unsaved is the shared form of the controller
  // (`formState.changes`, registered below) and whatever a section registers with `useLeaveGuard`.
  // Enable and Snooze are not ways out and never ask: each sends only its own key (`keepPendingChanges`) and leaves the other edits.
  const leave = useLeaveGuardHost()
  const { requestLeave } = leave
  // ⌘K and Mia, the sidebar, links, back/forward and closing the tab ask here first while the open editor holds unsaved work
  useRouteLeaveGuard({ active: open && leave.dirty, requestLeave })

  // The list's way out: it asks before it opens another product (`leaveGuardRef`, as the stores list does for the store editor).
  useImperativeHandle(props.leaveGuardRef, () => ({ requestLeave }), [requestLeave])

  const changedKeys = Object.keys(formState?.changes || {})
  const hasPendingChanges = () => !formState?.loading && changedKeys.length > 0
  // The product itself was never written: a discard drops what the shared form holds.
  const sharedFormEntry = useRef(null)
  // J2 review H1: the open section's form puts its validation here; «Save and continue» runs it first (productFormValidation.js)
  const formValidation = useRef(null)
  sharedFormEntry.current = {
    isDirty: hasPendingChanges,
    count: () => changedKeys.length,
    save: async () => {
      if (formValidation.current && !(await formValidation.current())) return { ok: false }
      return handleUpdateClick()
    },
    discard: () => cleanFormState?.({ changes: {} })
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

  // A section, from the list, the ⋯ menu or the deep link. Going from one entry to another is what closing the first and
  // opening the second was: the query keys of the first one go away, then the new ones are written. Opening a section
  // from the deep link (`isInitialRender`) writes nothing: the address already says it.
  // redesign with unsaved edits it asks first. Before, the edits stayed in the shared form without a word while the
  // section that saves them (Information) went away. The address is written only once the way is clear, so keeping the user needs
  // nothing put back.
  const handleSelectedItem = (entry, isInitialRender) => {
    if (!isInitialRender && entry === selectedEntry) {
      setIsExtendExtraOpen(false)
      return
    }
    const open = () => {
      if (!isInitialRender) {
        if (selectedEntry != null) removeQueryToUrl(PRODUCT_SECTION_QUERY_KEYS)
        addQueryToUrl(entryToQuery(entry))
      }
      setIsExtendExtraOpen(false)
      setSelectedEntry(entry)
    }
    if (isInitialRender) open()
    else requestLeave(open)
  }

  // Back to the Overview (also what a section asks for when it is done, e.g. Categories after moving the product). With unsaved
  // edits it asks first.
  const handleShowOverview = () => {
    const show = () => {
      setIsExtendExtraOpen(false)
      setSelectedEntry(null)
      removeQueryToUrl(PRODUCT_SECTION_QUERY_KEYS)
    }
    if (selectedEntry == null) show()
    else requestLeave(show)
  }

  const handleChooseSection = (id) => {
    if (id === PRODUCT_OVERVIEW_ID) handleShowOverview()
    else handleSelectedItem(id)
  }

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open])

  // Another product goes back to the Overview (ProductDetails:103-106). The first product to arrive is not another one: a
  // deep link to a section is not lost because the product came after the panel.
  const shownProductId = useRef(props.product?.id)
  useEffect(() => {
    const previous = shownProductId.current
    if (previous === props.product?.id) return
    shownProductId.current = props.product?.id
    if (previous == null) return
    setSelectedEntry(null)
    setIsExtendExtraOpen(false)
  }, [props.product?.id])

  // Focus on opening and Escape by layers: see Shared/Product/useEditorPanel (promoted in SP-F0, E0).
  // redesign bugs T (Q-T5): `full` covers the catalogue (a phone, Expand, a section at 500-999px), so the panel is a modal one,
  // as in the store editor; the Overview beside the list (`base`) and `wide` are not.
  useEditorPanel({ open, panelRef, onClose: handleClose, resetKey: props.product?.id, modal: panelSize === 'full' })

  // The deep link, once, on mount (as main). `?section=product_details` with no valid `tab` is its first tab, and the address
  // is completed with it, as ProductMainDetails did when it mounted.
  useEffect(() => {
    const section = query.get('section')
    if (!section) return
    const tab = query.get('tab')
    handleSelectedItem(entryFromUrl(section, tab), true)
    if (section === PRODUCT_DETAILS_SECTION && !PRODUCT_DETAILS_TABS.includes(tab)) {
      addQueryToUrl({ tab: DEFAULT_PRODUCT_DETAILS_TAB })
    }
  }, [])

  const showNav = !loading && !failed && !!product && !(sectionOpen && isExtendExtraOpen)
  const navItems = sections.map(({ id, label, group }) => ({ id, label, group }))
  const detailsTabs = sections.filter(({ id }) => id.startsWith(`${PRODUCT_DETAILS_SECTION}:`))
  const showDetailsTabs = isPhone && openSection === PRODUCT_DETAILS_SECTION && !!product
  const failureMessage = failed
    ? translateApiMessage(
      t,
      (Array.isArray(productState.error) ? productState.error : [productState.error])
        .map(item => (typeof item === 'string' ? item : item?.message)).find(Boolean),
      t('PRODUCT_EDITOR_LOAD_FAILED', 'We couldn\'t load this product.')
    )
    : null

  // what holds the unsaved edits: the open section or tab, or the Overview
  const leavingLabel = sections.find(section => section.id === (selectedEntry ?? PRODUCT_OVERVIEW_ID))?.label ?? product?.name ?? ''

  return (
    <LeaveGuardContext.Provider value={leave.context}>
    <ProductFormValidationContext.Provider value={formValidation}>
    <BarContainer
      id='product_details'
      ref={panelRef}
      tabIndex={-1}
      dir={dir}
      aria-labelledby={titleId}
      aria-busy={loading || refreshing || undefined}
      data-open={isPanelOpen ? '' : undefined}
      data-size={panelSize}
      data-section={sectionOpen ? '' : undefined}
    >
      <ProductEditorHeader
        titleId={titleId}
        loading={loading}
        product={product}
        handleChangeProductActiveState={handleChangeProductActiveState}
        handleDuplicateProduct={handleDuplicateProduct}
        handleDeleteProduct={handleDeleteProduct}
        duplicateState={duplicateState}
        onSelectSection={handleSelectedItem}
        formState={formState}
        handleChangeFormState={handleChangeFormState}
        handleUpdateClick={handleUpdateClick}
        productCart={productCart}
        showProductOption={showProductOption}
        getProduct={getProduct}
        showExpand // redesign SP-(R-3): as in main (ProductSummary:173-178), Expand is always offered, with a section open too
        isExpand={isExpand}
        onToggleExpand={() => setIsExpand(prev => !prev)}
        isExtendExtraOpen={sectionOpen && isExtendExtraOpen}
        onShowAllSections={() => setIsExtendExtraOpen(false)}
        onClose={handleClose}
      />
      {failed
        ? (
          <div className='odc-pe-notfound'>
            <EmptyState
              icon={TriangleAlert}
              tone='error'
              title={failureMessage}
              action={getProduct && <Button variant='primary' onClick={() => getProduct()}>{t('RETRY', 'Retry')}</Button>}
            />
          </div>
          )
        : (
          <div
            className='odc-pe-main'
            data-view={sectionOpen ? 'section' : 'overview'}
            data-nav={showNav ? undefined : 'hidden'}
          >
            {showNav && (
              <div className='odc-pe-nav'>
                {/* The whole list on a phone too while the Overview is shown; beside an open section it is the compact selector there. */}
                <SectionNav
                  className='odc-pe-sections'
                  label={t('PRODUCT_EDITOR_SECTIONS', 'Product sections')}
                  compactLabel={t('SECTION', 'Section')}
                  items={navItems}
                  value={selectedEntry ?? PRODUCT_OVERVIEW_ID}
                  onValueChange={handleChooseSection}
                  wideMinWidth={sectionOpen ? undefined : 0}
                />
              </div>
            )}
            <div className='odc-pe-content'>
              {showDetailsTabs && (
                <nav className='odc-pe-tabs' aria-label={t('PRODUCT_DETAILS', 'Product details')}>
                  {detailsTabs.map(tab => (
                    <Button
                      key={tab.id}
                      variant={tab.id === selectedEntry ? 'secondary' : 'ghost'}
                      aria-current={tab.id === selectedEntry ? 'page' : undefined}
                      onClick={() => handleChooseSection(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </nav>
              )}
              {sectionOpen
                ? (product
                    ? (
                      <ProductSectionBody
                        {...props}
                        section={openSection}
                        tab={openTab}
                        isExtendExtraOpen={isExtendExtraOpen}
                        setIsExtendExtraOpen={setIsExtendExtraOpen}
                        handleCloseExtraOpen={handleShowOverview}
                      />
                      )
                    : <ProductOverview loading />)
                : <ProductOverview loading={loading} product={product} />}
            </div>
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
    </BarContainer>
    </ProductFormValidationContext.Provider>
    </LeaveGuardContext.Provider>
  )
}

export const ProductDetails = (props) => {
  const productDetailsProps = {
    ...props,
    UIComponent: ProductDetailsUI
  }
  return <ProductDetatilsController {...productDetailsProps} />
}
