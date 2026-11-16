import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, IconButton, PageHeader, SearchField, Skeleton } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { ChevronDown, ChevronRight, ExternalLink, Menu as MenuIcon, Plus, RotateCw, Upload } from '../../Shared/Icon'
import { learnOptionsValues } from '../../../utils'
import { ImportersButton } from '../ImportersButton'
import './catalog.css'

// redesign SP-FA: the head of /stores/products. It draws what the page gives it and holds no catalog state:
//
// - the title is a <button> with the name of the store (or «Select a business») and a chevron; it opens and closes the store selector,
//   with the mouse and with the keyboard. The selector itself (S/BusinessSelectHeader) is the page's, given as `selector`, mounted under
//   the head. Its own `mouseup` outside closes it, so a click on this button while it is open would close it and reopen it: the button
//   remembers on `pointerdown` that it was open, and then the click only leaves it closed.
// - the actions: Add category, Use weekly template (school without categories), Importers, Refresh and Store website, and the primary
//   «Add product» (only with a category chosen). , P-1: on the phone the five go to the «More actions» menu of PageHeader
//   (Learn and «Add product» stay in view), as S/StoresList/StoresHeader does. redesign tanda AB (C-5): so does the
//   desktop, which had five loose buttons beside the primary; every action is still there, with the same effect.
// - the breadcrumb «<store> › <category | All products>»; the store opens the store editor, as the old span did.
//
// @param {object}   props
// @param {string}   [props.storeName]            Name of the store on screen. Empty: the title says «Select a business».
// @param {boolean}  [props.loadingStore]         The store is loading and has no name yet: a skeleton in the title.
// @param {boolean}  props.hasStore               There is a store in the URL: the actions and the breadcrumb are there.
// @param {boolean}  props.selectorOpen           The selector is on screen.
// @param {Function} props.onToggleSelector       `(open: boolean) => void`.
// @param {React.ReactNode} [props.selector]      The BusinessSelectHeader, already conditional on `selectorOpen`.
// @param {Function} [props.onOpenMenu]           Only with the sidebar collapsed: shows «Open menu» before the title.
// @param {boolean}  props.canAddProduct          A category is chosen: the primary «Add product» is there.
// @param {boolean}  [props.addProductDisabled]   The store has no categories.
// @param {Function} props.onAddProduct
// @param {Function} props.onAddCategory          `handleOpenCategoryDetails()`, no arguments.
// @param {boolean}  [props.showWeeklyTemplate]   School store without categories.
// @param {boolean}  [props.templateLoading]
// @param {Function} [props.onUseTemplate]
// @param {Function} [props.setOpenSidebar]       Told `'importer'` when the Importers button opens the panel, as the old trigger did.
// @param {Function} [props.onImportSuccess]      Given to ImportersButton (`getBusiness`).
// @param {Object}   [props.business]             The open store: the target of the menu importers (main #488).
// @param {boolean}  [props.businessLoading]      `businessState.loading`, for that store.
// @param {Function} props.onRefresh              `getBusiness`.
// @param {boolean}  [props.refreshing]           `businessState.loading`: Refresh is `busy`.
// @param {boolean}  [props.siteDisabled]         Store website: no URL, or the store is loading.
// @param {Function} props.onOpenSite
// @param {Function} props.onOpenStore            The store in the breadcrumb: opens the store editor.
// @param {string}   [props.categoryName]         The chosen category; without it the breadcrumb says «All products».
// @param {boolean}  [props.isPhone]              No longer changes the head (tanda AB, C-5: the menu is at every width); the page still passes it.

// The 7 help articles of the page (level-zero sessions only, LearnDropDown decides that)
const LEARN_KEYS = [
  'categories_products_general_view',
  'new_category',
  'product_details_general_view',
  'ingredients_properties',
  'product_options',
  'product_images',
  'product_video'
]

const SEARCH_DEBOUNCE_MS = 750 // the wait of the SearchBar of today

/**
 * The search of the list. The wait of the old SearchBar (750 ms after the last key) before `onSearch`; the clear button does not wait.
 * A search that changes from outside (the «Clear filters» of the list, switching store) shows in the field unless the person is typing.
 */
export const CatalogSearch = ({ value, onSearch, inCategory }) => {
  const [, t] = useLanguage()
  const [text, setText] = useState(value ?? '')
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement === inputRef.current) return
    setText(value ?? '')
  }, [value])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleChange = (next) => {
    setText(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearch(next), SEARCH_DEBOUNCE_MS)
  }

  const handleClear = () => {
    clearTimeout(timerRef.current)
    onSearch('')
  }

  const label = inCategory
    ? t('CATALOG_SEARCH_IN_CATEGORY', 'Search in this category')
    : t('CATALOG_SEARCH_ALL', 'Search all products')

  return (
    <SearchField
      value={text}
      onChange={handleChange}
      onClear={handleClear}
      inputRef={inputRef}
      label={label}
      placeholder={label}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
    />
  )
}

export const CatalogHeader = ({
  business,
  businessLoading,
  storeName,
  loadingStore,
  hasStore,
  selectorOpen,
  onToggleSelector,
  selector,
  onOpenMenu,
  canAddProduct,
  addProductDisabled,
  onAddProduct,
  onAddCategory,
  showWeeklyTemplate,
  templateLoading,
  onUseTemplate,
  setOpenSidebar,
  onImportSuccess,
  onRefresh,
  refreshing,
  siteDisabled,
  onOpenSite,
  onOpenStore,
  categoryName
}) => {
  const [, t] = useLanguage()
  // `true` between the pointer going down on the title with the selector open and the click that follows
  const openOnPointerDown = useRef(null)

  const name = storeName || t('SELECT_BUSINESS', 'Select a business')

  // bugs E R-6: Importers was the legacy ImportersButton trigger, boxed and resized to look like its neighbours. Now it is an
  // item of the «More actions» menu (tanda AB, C-5) and ImportersButton is mounted once, without its trigger, controlled by
  // `importersOpen`, outside the actions so the panel and an import in progress survive a reload of the store (`onImportSuccess` is
  // `getBusiness`). The same capability in the same place: `setOpenSidebar('importer')` still tells the page, `?header=importers` still
  // opens the panel on mount, and when the panel closes the focus goes back to the «⋯» that opened it.
  const [importersOpen, setImportersOpen] = useState(false)
  //
  // , P-1: Importers is a menu item that is gone when the panel closes, so the focus goes back to the «⋯» of PageHeader, as
  // S/StoresList/StoresHeader does on the phone. redesign tanda AB (C-5): the same at every width.
  // The «⋯» is found by its name: the Learn menu in the same row also announces `aria-haspopup="menu"` and comes first.
  const headRef = useRef(null)
  const moreLabel = t('MORE_ACTIONS', 'More actions')
  const returnFocusRef = useMemo(() => ({
    get current () {
      const triggers = headRef.current?.querySelectorAll('.odc-pagehead-actions [aria-haspopup="menu"]') || []
      return Array.from(triggers).find(trigger => trigger.getAttribute('aria-label') === moreLabel) || null
    }
  }), [moreLabel])
  const handleOpenImporters = () => {
    setOpenSidebar && setOpenSidebar('importer')
    setImportersOpen(true)
  }

  const handleTitleClick = () => {
    const wasOpen = openOnPointerDown.current
    openOnPointerDown.current = null
    // the `mouseup` of the selector already closed it on this very click: the click does not open it again
    if (wasOpen) {
      onToggleSelector(false)
      return
    }
    onToggleSelector(!selectorOpen)
  }

  const title = loadingStore
    ? <span className='odc-cat-title-skeleton' aria-busy='true'><Skeleton /><span className='odc-sr-only'>{t('LOADING', 'Loading')}</span></span>
    : (
      <button
        type='button'
        className='odc-cat-title'
        title={name}
        aria-haspopup='dialog'
        aria-expanded={Boolean(selectorOpen)}
        onPointerDown={() => { openOnPointerDown.current = Boolean(selectorOpen) }}
        onKeyDown={() => { openOnPointerDown.current = null }}
        onClick={handleTitleClick}
      >
        <span className='odc-cat-title-text' dir='auto'>{name}</span>
        <ChevronDown className='odc-icon odc-cat-chevron' />
      </button>
      )

  const learn = <LearnDropDown learnOptions={learnOptionsValues(LEARN_KEYS, t)} />

  // , P-1: on the phone they were three rows of buttons before the breadcrumb. The five go, in this order, to the
  // «More actions» menu of PageHeader; Learn and the primary «Add product» stay in view. The Importers panel is the host below at every
  // width, so the menu item only opens it.
  // redesign tanda AB (C-5): the desktop did the same thing with five loose buttons and the primary; it now uses the same
  // menu, with the same items, order and effects (no criterion in the code for leaving any outside, as /stores/list has none either).
  const menuActions = hasStore
    ? [
        { key: 'add_category', label: t('ADD_CATEGORY', 'Add category'), icon: Plus, onSelect: () => onAddCategory() },
        ...(showWeeklyTemplate
          ? [{
              key: 'use_template',
              label: t('SCHOOL_USE_TEMPLATE', 'Use weekly template'),
              disabled: Boolean(templateLoading),
              onSelect: () => onUseTemplate()
            }]
          : []),
        { key: 'importers', label: t('IMPORTERS', 'Importers'), icon: Upload, onSelect: handleOpenImporters },
        // tanda Y review (finding 4): as the desktop button is `busy`, the item waits for the reload in progress
        { key: 'refresh', label: t('REFRESH', 'Refresh'), icon: RotateCw, disabled: Boolean(refreshing), onSelect: () => onRefresh() },
        { key: 'store_website', label: t('STORE_WEBSITE', 'Store website'), icon: ExternalLink, disabled: Boolean(siteDisabled), onSelect: () => onOpenSite() }
      ]
    : undefined
  const primaryAction = hasStore && canAddProduct
    ? <Button variant='primary' icon={Plus} disabled={addProductDisabled} onClick={() => onAddProduct()}>{t('ADD_PRODUCT', 'Add product')}</Button>
    : undefined

  return (
    <div className='odc-root odc-cat-head' ref={headRef}>
      <PageHeader
        leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
        title={title}
        learn={learn}
        actions={menuActions}
        moreLabel={moreLabel}
        primaryAction={primaryAction}
      />
      {hasStore && (
        <ImportersButton
          key={business?.slug ?? business?.id}
          business={business}
          businessLoading={businessLoading}
          hideTrigger
          open={importersOpen}
          onOpenChange={setImportersOpen}
          onImportSuccess={onImportSuccess}
          returnFocusRef={returnFocusRef}
        />
      )}
      <div className='odc-cat-selector'>{selector}</div>
      {hasStore && storeName && (
        <nav className='odc-cat-crumbs' aria-label={t('BREADCRUMB', 'Breadcrumb')}>
          <ol>
            <li>
              <button type='button' className='odc-cat-crumb-link' onClick={() => onOpenStore()}>{storeName}</button>
              <ChevronRight className='odc-icon odc-icon-flip' aria-hidden='true' />
            </li>
            <li aria-current='page'>{categoryName || t('ALL_PRODUCTS', 'All products')}</li>
          </ol>
        </nav>
      )}
    </div>
  )
}
