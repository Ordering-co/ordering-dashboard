import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Skeleton } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { ChevronDown, Plus } from '../../Shared/Icon'
import { CatalogCategoryRow } from './CatalogCategoryRow'
import './catalog-categories.css'

// redesign SP-FB: the category tree of /stores/products.
//
// It takes the props `BusinessProductsCategories` took from the page (BusinessProductsListing) and keeps their meaning: the tree
// of `businessState.business.categories` by `rank`, the click that selects (`onClickCategory` = the listing's `handleChangeCategory`),
// the «Add new category» link (`handleOpenCategoryDetails()`), drag to reorder through the controller of each row. There is no
// `productLayout` mode: the Categories tab of the product keeps using S/BusinessProductsCategories.
//
// What is new: «All products» is the first row and is what clicking the margin used to do (`onClickCategory(null, null)`), so the
// list needs no listener on `window` (SP-13); the rows are native buttons; the Enable switch says when a save fails (M-12).
//
// The rest of the listing's props are accepted and not forwarded: a row needs the business, the selection and the handlers below,
// and a row that received every prop of the listing would redraw with each of them.

// six rows while the business loads, in the shape of the rows they replace
const SKELETON_WIDTHS = ['62%', '48%', '70%', '54%', '66%', '44%']

// every category of the tree, subcategories too (what the folded button counts)
const countCategories = (list) => (Array.isArray(list) ? list.reduce((n, category) => n + 1 + countCategories(category?.subcategories), 0) : 0)
const hasSubcategories = (category) => Array.isArray(category?.subcategories) && category.subcategories.length > 0

const useLatestCallbacks = (callbacks) => {
  const latest = useRef(callbacks)
  latest.current = callbacks
  // Stable functions that call the latest ones: a row is memoised and must not keep the listing's closure of an old render
  // (handleChangeCategory reads the selected category and the open ones).
  return useMemo(() => Object.fromEntries(Object.keys(callbacks).map(name => [
    name,
    (...args) => latest.current[name]?.(...args)
  ])), [])
}

/**
 * @param {object}   props
 * @param {object}   props.businessState                    `{ loading, business: { categories } }` of the listing controller.
 * @param {object}   [props.categorySelected]               The chosen category; none means «All products».
 * @param {Function} props.onClickCategory                  `(event, category)`; `(null, null)` for «All products».
 * @param {Function} props.handleOpenCategoryDetails        «Add new category», called with no argument.
 * @param {Function} props.handleUpdateBusinessState        The controller of a row saves the new record through it.
 * @param {Function} props.setCategorySelected
 * @param {Function} props.setCurrentCategory
 * @param {object}   [props.openCategories]                 Accepted for parity; the folds of the rows are local, as in main.
 */
export const CatalogCategories = ({
  businessState,
  categorySelected,
  onClickCategory,
  handleOpenCategoryDetails,
  handleUpdateBusinessState,
  setCategorySelected,
  setCurrentCategory
}) => {
  const [, t] = useLanguage()
  const [dataSelected, setDataSelected] = useState('')
  const allRef = useRef(null)
  const toggleRef = useRef(null)
  const listId = useId()
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(false)
  const refocus = useRef(false)
  const stable = useLatestCallbacks({
    onClickCategory,
    handleOpenCategoryDetails,
    handleUpdateBusinessState,
    setCategorySelected,
    setCurrentCategory
  })

  const loading = Boolean(businessState?.loading)
  const business = businessState?.business
  const categories = business?.categories
  const sorted = useMemo(
    () => (Array.isArray(categories) ? [...categories].sort((a, b) => a.rank - b.rank) : []),
    [categories]
  )

  const allSelected = categorySelected?.id == null

  // redesign tanda AG ((b), Decisión AG-1, pending the owner): on a phone the tree folds behind a button that names the
  // chosen category, so the first product is in view. Choosing a leaf category or «All products» folds it again and gives the focus
  // back to the button, which then names the choice; the switch, the ⋯, the chevrons, a drag and a parent category leave it open.
  const folded = isPhone && !open
  const total = countCategories(categories)
  const countLabel = total === 1
    ? t('CATALOG_CATEGORIES_COUNT_ONE', '1 category')
    : t('CATALOG_CATEGORIES_COUNT_OTHER', '_count_ categories').replace('_count_', String(total))
  const chooseLatest = useRef(null)
  chooseLatest.current = (event, category) => {
    stable.onClickCategory(event, category)
    if (isPhone && !hasSubcategories(category)) {
      refocus.current = true
      setOpen(false)
    }
  }
  // stable, like the handlers above: the rows are memoised
  const choose = useMemo(() => (...args) => chooseLatest.current(...args), [])

  useEffect(() => {
    if (open || !refocus.current) return
    refocus.current = false
    toggleRef.current?.focus()
  }, [open])

  // SP-11: the chosen row is in view; «All products» is the one that scrolls back to the top
  useEffect(() => {
    if (allSelected) allRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [allSelected])

  return (
    <section className='odc-root odc-cc' aria-label={t('CATEGORIES', 'Categories')}>
      <div className='odc-cc-head'>
        <h2 className='odc-cc-title'>{t('CATEGORIES', 'Categories')}</h2>
        <Button variant='ghost' size='sm' icon={Plus} onClick={() => stable.handleOpenCategoryDetails()}>
          {t('ADD_NEW_CATEGORY', 'Add new category')}
        </Button>
      </div>
      {isPhone && (
        <button
          ref={toggleRef}
          type='button'
          className='odc-cc-toggle'
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(value => !value)}
        >
          <span className='odc-cc-toggle-text'>
            <span className='odc-cc-toggle-name' dir='auto'>{allSelected ? t('ALL_PRODUCTS', 'All products') : categorySelected?.name}</span>
            {!loading && <span className='odc-cc-toggle-count'>{countLabel}</span>}
          </span>
          <ChevronDown className='odc-icon odc-cc-toggle-chevron' aria-hidden='true' />
        </button>
      )}
      {loading && <span className='odc-sr-only' role='status'>{t('LOADING', 'Loading')}</span>}
      <ul id={listId} className='odc-cc-list' aria-busy={loading || undefined} hidden={folded || undefined}>
        <li className='odc-cc-item'>
          <div className='odc-cc-row' data-current={allSelected ? '' : undefined} data-all=''>
            <span className='odc-cc-grip' aria-hidden='true' />
            <span className='odc-cc-spacer' aria-hidden='true' />
            <button
              ref={allRef}
              type='button'
              className='odc-cc-name'
              aria-current={allSelected ? 'true' : undefined}
              onClick={() => choose(null, null)}
            >
              <span className='odc-cc-label' dir='auto'>{t('ALL_PRODUCTS', 'All products')}</span>
            </button>
          </div>
        </li>
        {loading && SKELETON_WIDTHS.map((width, index) => (
          <li key={index} className='odc-cc-item' data-skeleton=''>
            <div className='odc-cc-row'>
              <Skeleton size={width} />
              <Skeleton size='var(--od-x-switch-width)' block='var(--od-x-switch-height)' shape='round' />
            </div>
          </li>
        ))}
        {!loading && sorted.map((category, index) => (
          <CatalogCategoryRow
            key={category.id}
            category={category}
            depth={0}
            business={business}
            categorySelected={categorySelected}
            dataSelected={dataSelected}
            setDataSelected={setDataSelected}
            setCategorySelected={stable.setCategorySelected}
            handleUpdateBusinessState={stable.handleUpdateBusinessState}
            onClickCategory={choose}
            setCurrentCategory={stable.setCurrentCategory}
            isLastCategory={index === sorted.length - 1}
          />
        ))}
      </ul>
    </section>
  )
}
