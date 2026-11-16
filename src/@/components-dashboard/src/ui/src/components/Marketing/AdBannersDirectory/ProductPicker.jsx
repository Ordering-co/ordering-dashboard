import React, { useEffect, useId, useState } from 'react'

import {
  useApi,
  useLanguage,
  useUtils,
  BusinessProductsListing as BusinessProductsListingController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Skeleton } from '../../Shared/Product'
import { ChevronDown, ChevronRight, Image } from '../../Shared/Icon'
import './banner-image.css'

// redesign AB-B4 (decision 3 → 3A; M-AB15, M-AB22): the product picker of the image dialog. K/BusinessProductsListing (shared with the
// catalog, read-only here) is mounted exactly as SelectBusinessProducts mounts it; what changes is what is drawn: the tree of main (a
// `div onClick` accordion with circle icons for radios) becomes collapsible groups (native `<button aria-expanded>` headers) with native
// radio rows in ONE radiogroup, because the Product RadioGroup cannot span several collapsible groups (its options are one flat list).
// The group of the linked product starts open with its radio checked (M-AB22); the categories and products shown are main's: the
// enabled top-level categories by `rank` and, inside each one, its enabled products and its subcategories (as main's CategoryTreeNode did).
// Props: `business` ({ id, slug } or null), `storedUrl` (the stored link's `/store/<slug>?…`, used for the slug when the business has none:
// it is not in the loaded page), `categoryId`, `productId` (the linked or chosen product), `onChange({ categoryId, productId })`.

const SKELETON_ROWS = 6

const slugFromUrl = (url) => {
  const match = String(url ?? '').match(/\/store\/([^/?#]+)/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch (error) {
    return match[1]
  }
}

const enabledProducts = (category) => (category?.products ?? []).filter(product => product?.enabled)
const hasProducts = (category) => enabledProducts(category).length > 0 || (category?.subcategories ?? []).some(hasProducts)
const holdsProduct = (category, productId) => (
  enabledProducts(category).some(product => String(product.id) === String(productId)) ||
  (category?.subcategories ?? []).some(sub => holdsProduct(sub, productId))
)

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const errorText = (t, error, fallback) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, fallback)
}

const Thumb = ({ src }) => {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return (
    <span className='odc-banners-thumb' aria-hidden='true'>
      {src && !failed
        ? <img src={src} alt='' onError={() => setFailed(true)} />
        : <Image className='odc-icon' aria-hidden='true' />}
    </span>
  )
}

const CategoryGroup = ({ category, name, categoryId, productId, onPick }) => {
  const [{ optimizeImage }] = useUtils()
  const bodyId = useId()
  // Open at the start when the linked product lives here (or in a subcategory); after that the person decides
  const [open, setOpen] = useState(() => productId != null && productId !== '' && holdsProduct(category, productId))
  const products = enabledProducts(category)
  const subcategories = (category.subcategories ?? []).filter(hasProducts)

  return (
    <div className='odc-banners-group'>
      <button
        type='button'
        className='odc-banners-group-head'
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={() => setOpen(current => !current)}
      >
        {open
          ? <ChevronDown className='odc-icon' aria-hidden='true' />
          : <ChevronRight className='odc-icon odc-icon-flip' aria-hidden='true' />}
        <span className='odc-banners-group-name'>{category.name}</span>
      </button>
      {open && (
        <div id={bodyId} className='odc-banners-group-body'>
          {products.map(product => {
            const checked = String(product.id) === String(productId) &&
              (categoryId == null || categoryId === '' || String(categoryId) === String(product.category_id))
            return (
              <label key={product.id} className='odc-banners-product'>
                <input
                  type='radio'
                  name={name}
                  className='odc-banners-radio'
                  checked={checked}
                  onChange={() => onPick({ categoryId: product.category_id, productId: product.id })}
                />
                <Thumb src={typeof product.images === 'string' && product.images ? optimizeImage(product.images, 'h_50,c_limit') : null} />
                <span className='odc-banners-product-name'>{product.name}</span>
              </label>
            )
          })}
          {subcategories.map(sub => (
            <CategoryGroup
              key={sub.id}
              category={sub}
              name={name}
              categoryId={categoryId}
              productId={productId}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const ProductPickerUI = ({ businessState, selectedCategoryId, selectedProductId, onPick }) => {
  const [, t] = useLanguage()
  const name = useId()

  if (businessState?.loading) {
    return (
      <div className='odc-banners-pick-skeleton' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <span key={index} className='odc-banners-pick-skeleton-row'>
            <Skeleton shape='round' size='var(--od-x-icon-md)' block='var(--od-x-icon-md)' />
            <Skeleton size='40%' />
          </span>
        ))}
      </div>
    )
  }

  if (hasError(businessState?.error)) {
    return (
      <p className='odc-banners-pick-error' role='alert'>
        {errorText(t, businessState.error, t('AD_BANNERS_PRODUCTS_ERROR', "We couldn't load the products of this business."))}
      </p>
    )
  }

  const categories = (businessState?.business?.categories ?? [])
    .filter(category => category?.enabled && hasProducts(category))
    .sort((a, b) => a.rank - b.rank)

  if (categories.length === 0) {
    return <p className='odc-banners-pick-empty'>{t('AD_BANNERS_NO_PRODUCTS', 'This business has no products.')}</p>
  }

  return (
    <div role='radiogroup' aria-label={t('PRODUCT', 'Product')} className='odc-banners-picker'>
      {categories.map(category => (
        <CategoryGroup
          key={category.id}
          category={category}
          name={name}
          categoryId={selectedCategoryId}
          productId={selectedProductId}
          onPick={onPick}
        />
      ))}
    </div>
  )
}

export const ProductPicker = ({ business, storedUrl, categoryId, productId, onChange }) => {
  const [ordering] = useApi()
  const [isInitialRender, setIsInitialRender] = useState(false)
  const slug = business ? (business.slug || slugFromUrl(storedUrl)) : null
  if (!slug) return null

  // `categoryId` and `productId` are NOT given to the controller under those names: it opens the product modal of the catalog with them
  return (
    <div className='odc-root'>
      <BusinessProductsListingController
        key={slug}
        slug={slug}
        ordering={ordering}
        UIComponent={ProductPickerUI}
        isInitialRender={isInitialRender}
        isAllCategoryProducts
        isSearchByName
        isSearchByDescription
        handleUpdateInitialRender={setIsInitialRender}
        version='v1'
        selectedCategoryId={categoryId}
        selectedProductId={productId}
        onPick={onChange}
      />
    </div>
  )
}
