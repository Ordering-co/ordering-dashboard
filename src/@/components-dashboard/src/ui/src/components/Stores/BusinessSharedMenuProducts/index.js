import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  useLanguage,
  BusinessSharedMenuProducts as BusinessSharedMenuProductsController
} from '../../../../../index'
import { AsyncSwitch, SearchField, SectionSplit, useSectionSplit } from '../../Shared/Product'
import { ChevronRight } from '../../Shared/Icon'
import { BusinessSharedMenuProductDetails } from '../BusinessSharedMenuProductDetails'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import './shared-menu-products.css'

// redesign stores 5.6 (G3-04, decisions 4 and 5): the products of a shared menu are the list of a nested P/SectionSplit and
// the open product is its detail (no 500px SideBar over the list, no Modal under 1000px: the piece measures its own root and stacks by
// itself inside the narrow detail of the menu). The rows are the ones of the menu list (5.5a): an «Available» P/AsyncSwitch, the name as
// a button and a chevron. `?product=` is read once on arrival and written only when the user opens or closes one.

const URL_KEY = 'product'

const BusinessSharedMenuProductsUI = (props) => {
  const {
    menuState,
    business,
    handleUpdateBusinessSharedMenuProduct,
    patchProduct,
    setIsOpenSharedProduct,
    menuList,
    setMenuList
  } = props

  const [, t] = useLanguage()
  const search = useLocation().search
  // the context of the OUTER detail (the menu): this component is rendered inside it and outside the piece below
  const { registerCloseGuard } = useSectionSplit()
  const splitRef = useRef(null)
  const [searchValue, setSearchValue] = useState('')

  const products = menuState?.menu?.products || []
  // redesign bugs F row 29: the list is KNOWN once the menu carries product objects. The shared products are read after the
  // menu opens (C/BusinessMenuOptions `getSharedMenuProducts` → `setCurrentMenu`), and until then the menu has no `products` (or only ids).
  const listKnown = Array.isArray(menuState?.menu?.products) && products.every(product => product !== null && typeof product === 'object')

  // ── The URL on arrival: read once; the product is opened without rewriting the address, an unknown one is taken off ──
  // redesign bugs F row 29: it is resolved once the list is known (here if it is already, else in the effect below)
  const initial = useRef(null)
  if (initial.current === null) {
    const id = new URLSearchParams(search).get(URL_KEY)
    const found = id && listKnown ? products.find(product => String(product.id) === id) : null
    initial.current = { id, found: found?.id ?? null, settled: !id || listKnown }
  }
  const [openId, setOpenId] = useState(initial.current.found)

  useEffect(() => {
    const current = initial.current
    if (current.resolved) return
    if (!current.settled) {
      // the list came after mount: look the id up now; an id that is not in the known list is taken off
      if (!listKnown) return
      current.settled = true
      const found = products.find(product => String(product.id) === current.id)
      current.found = found?.id ?? null
      if (found) setOpenId(found.id)
    }
    current.resolved = true
    if (current.found != null) setIsOpenSharedProduct?.(true)
    else if (current.id) removeQueryToUrl([URL_KEY])
  }, [listKnown, products])

  // the product comes from the menu, so a change the controller merged (price, switches) shows without opening it again
  const openProduct = openId != null ? products.find(product => product.id === openId) : null
  const isOpen = !!openProduct

  // A dirty product (price or quantity typed, not saved) must also be asked about when the user leaves the OUTER detail (closes the
  // shared menu, picks another one). The outer piece only knows its own guards, so while a product is open this one hands the question
  // to the piece below, whose guards include the product's form.
  useEffect(() => {
    if (!isOpen) return undefined
    return registerCloseGuard((proceed, onCancel) => {
      const inner = splitRef.current
      if (!inner) return false
      inner.requestLeave(proceed, onCancel)
      return true
    })
  }, [isOpen, registerCloseGuard])

  const closeProduct = () => {
    setOpenId(null)
    setIsOpenSharedProduct?.(false)
    removeQueryToUrl([URL_KEY])
  }

  // opening another product goes through the guards of the one that is open
  const openProductOf = (product) => {
    if (product.id === openId) return
    const open = () => {
      setOpenId(product.id)
      setIsOpenSharedProduct?.(true)
      addQueryToUrl({ [URL_KEY]: product.id })
    }
    if (splitRef.current) splitRef.current.requestLeave(open)
    else open()
  }

  const needle = searchValue.toLowerCase()
  const shown = products.filter(product => (product.name || '').toLowerCase().includes(needle))

  const list = (
    <div className='odc-smp'>
      <SearchField
        className='odc-smp-search'
        value={searchValue}
        onChange={setSearchValue}
        label={t('SEARCH', 'Search')}
        placeholder={t('SEARCH', 'Search')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />

      {shown.length > 0 && (
        <ul className='odc-smp-list'>
          {shown.map(product => {
            const isCurrent = product.id === openId
            return (
              <li key={product.id} className='odc-smp-item'>
                <div
                  className='odc-smp-row'
                  data-section-split-key={product.id}
                  tabIndex={-1}
                  data-current={isCurrent ? '' : undefined}
                  onClick={() => openProductOf(product)}
                >
                  {/* the switch and what it says on a failure belong to the row, but a press on them is not a press on the row */}
                  <span className='odc-smp-switch' onClick={event => event.stopPropagation()}>
                    <AsyncSwitch
                      checked={!!product.enabled}
                      onToggle={next => handleUpdateBusinessSharedMenuProduct(product.id, { enabled: next })}
                      failureText={t('STORES_CHANGE_FAILED', "We couldn't save the change.")}
                      label={t('STORES_MENU_AVAILABLE', 'Available: _name_').replace('_name_', product.name ?? '')}
                    />
                  </span>
                  <button
                    type='button'
                    className='odc-smp-name'
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={(event) => {
                      event.stopPropagation()
                      openProductOf(product)
                    }}
                  >
                    <span className='odc-smp-label' dir='auto'>{product.name}</span>
                  </button>
                  <ChevronRight className='odc-icon odc-icon-flip odc-smp-chevron' aria-hidden='true' />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {products.length === 0 && (
        <p className='odc-smp-empty'>{t('STORES_SHARED_MENU_PRODUCTS_EMPTY', 'This menu has no products.')}</p>
      )}
      {products.length > 0 && shown.length === 0 && (
        <p className='odc-smp-empty'>{t('NO_RESULTS', 'No results')}</p>
      )}
    </div>
  )

  const detail = isOpen
    ? (
      <BusinessSharedMenuProductDetails
        key={openProduct.id}
        business={business}
        menu={menuState.menu}
        product={openProduct}
        menuList={menuList}
        setMenuList={setMenuList}
        onProductChange={patchProduct}
      />
      )
    : null

  return (
    <SectionSplit
      revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
      ref={splitRef}
      className='odc-smp-split'
      open={isOpen}
      detailKey={openProduct?.id}
      detailTitle={openProduct?.name ?? ''}
      closeLabel={t('CLOSE', 'Close')}
      backLabel={t('PRODUCTS', 'Products')}
      onClose={closeProduct}
      list={list}
      detail={detail}
    />
  )
}

export const BusinessSharedMenuProducts = (props) => {
  const businessSharedMenuProductsProps = {
    ...props,
    UIComponent: BusinessSharedMenuProductsUI
  }
  return <BusinessSharedMenuProductsController {...businessSharedMenuProductsProps} />
}
