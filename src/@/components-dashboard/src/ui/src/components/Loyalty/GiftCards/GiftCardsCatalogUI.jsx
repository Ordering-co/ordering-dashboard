import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useHistory } from 'react-router-dom'

import { useLanguage, useUtils } from '../../../../../index'
import { minWidth } from '../../../../../utils/breakpoints'
import { buildSettingsPath } from '../../../../../utils/settingsRedirects'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Plus, TriangleAlert, X } from '../../Shared/Icon'
import { Button, ConfirmDialog, EmptyState, IconButton, InlineNotice, Sheet, Skeleton, Status, cx } from '../../Shared/Product'
import { GiftCardEditor } from '../GiftCardDetail'
import './gift-cards-catalog.css'

// redesign GC-C (; D5, D6, D7, D8 | GC-05, GC-07, GC-10, GC-11, GC-18): the catalog of gift cards for sale, in one Product Sheet.
//
// Two widths (D5, audit F1): from 1100px (as `main`) the list and the card of a product show at once, two panes, and the sheet widens
// only while a card is open; choosing another product or «Add new gift card» is one click, as in `main`. Below 1100px there is one
// column: the card replaces the list and «Back» returns (where `main` opened a 70% modal over the list).
//
// The sheet owns what is shared by both views: the title, the way back and the discard guard (decision 17). The card
// (GiftCardEditor) tells it through `onDirtyChange` whether it holds changes that are not saved; closing, going back, choosing
// another product or following the settings link ask first. The URL carries `?product=<id>` with addQueryToUrl/removeQueryToUrl, which
// leave `status`, `page` and `pageSize` of the list alone (GC-05).

const WIDE_QUERY = minWidth(1100) // the width at which `main` placed the card beside the list
const NEW_PRODUCT = Object.freeze({})
const SETTINGS_PATH = buildSettingsPath({ group: 'payments', category: 'addon_gift_cards' })

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
const subscribeWide = (listener) => {
  if (!canMatch()) return () => {}
  const media = window.matchMedia(WIDE_QUERY)
  if (!media) return () => {}
  if (media.addEventListener) {
    media.addEventListener('change', listener)
    return () => media.removeEventListener?.('change', listener)
  }
  media.addListener?.(listener)
  return () => media.removeListener?.(listener)
}
const wideSnapshot = () => canMatch() && window.matchMedia(WIDE_QUERY)?.matches === true
const useWide = () => useSyncExternalStore(subscribeWide, wideSnapshot, () => false)

// The first text of an API error: a string, `{ message }`, or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

// redesign GC-D (R4): for a few frames after a focus that something else may take away, put it back on `node` if it was lost: on <body>,
// or on the close button or the frame of the sheet (where the sheet sends the focus of a dialog that closes on an element that is
// gone). A focus the person moved on purpose (another control) is left alone.
const SETTLE_FRAMES = 20
const keepFocusOn = (node) => {
  let frames = 0
  const step = () => {
    frames++
    const active = document.activeElement
    const lost = !active || active === document.body || active.classList?.contains('odc-overlay-close') || active.classList?.contains('odc-sheet')
    if (node.isConnected && lost) node.focus({ preventScroll: true })
    if (frames < SETTLE_FRAMES) nextFrame(step)
  }
  nextFrame(step)
}

const clearProductParam = () => {
  if (new URLSearchParams(window.location.search).has('product')) removeQueryToUrl(['product'])
}

export const GiftCardsCatalogUI = (props) => {
  const {
    open = false,
    onClose,
    platformProductsListState,
    reload,
    handleSuccessAddProduct,
    handleSuccessUpdateProduct,
    handleSuccessDeleteProduct
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage, parsePrice }] = useUtils()
  const history = useHistory()
  const wide = useWide()

  const [selection, setSelection] = useState(null) // null (the list), { id, n } (a product) or { isNew, n }
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(null) // { go }: what to do if the changes are dropped
  const bodyRef = useRef(null)
  const detailTitleRef = useRef(null)
  const pendingFocus = useRef(null) // { kind: 'title' | 'row' | 'add', id? }
  const lastAddedId = useRef(null)
  const seq = useRef(0)
  const initialHandled = useRef(false)
  const retryRef = useRef(null) // { sawLoading } while a «Retry» waits for its answer

  const loading = platformProductsListState?.loading === true
  const error = platformProductsListState?.error
  const products = platformProductsListState?.products || []

  const selected = selection?.id != null ? products.find(product => product.id === selection.id) : undefined
  const current = selection && (selection.isNew || selected) ? selection : null
  const detailProduct = selection?.isNew ? NEW_PRODUCT : selected
  const twoUp = wide && !!current
  const selectionKey = current ? `${current.id ?? 'new'}-${current.n}` : 'list'

  const listTitle = t('GIFT_CARDS_FOR_SALE', 'Gift cards for sale')
  const detailTitle = current?.isNew ? t('NEW_GIFT_CARD', 'New gift card') : (detailProduct?.name ?? '')
  // Two panes: the sheet keeps naming the catalog and the card has its own heading. One column: the title is the view that shows.
  const sheetTitle = current && !twoUp ? detailTitle : listTitle

  // The heading of what shows: the card's own in two panes, the title of the sheet in one column
  const titleNode = () => (twoUp
    ? detailTitleRef.current
    : bodyRef.current?.closest('.odc-sheet')?.querySelector('.odc-overlay-title'))
  const focusNode = (node) => {
    if (!node) return
    // only a heading needs the attribute to take the focus; a row or a button must stay in the tab order
    if (/^H[1-6]$/.test(node.tagName) && !node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
    node.focus({ preventScroll: true })
  }

  const select = (next) => {
    retryRef.current = null // the person went on to something else: the answer of a «Retry» no longer moves the focus
    setSelection({ ...next, n: ++seq.current })
  }

  const resetView = () => {
    setSelection(null)
    setDirty(false)
    clearProductParam()
  }

  // Everything that would lose the changes of the open card passes through here (decision 17)
  const requestLeave = (go) => {
    if (dirty) setDiscard({ go })
    else go()
  }

  const finish = () => {
    resetView()
    onClose?.()
  }

  const backToList = (focus) => {
    pendingFocus.current = focus
    resetView()
  }

  const backFocus = () => (current?.id != null ? { kind: 'row', id: current.id } : { kind: 'add' })

  const openProduct = (product) => {
    if (current?.id === product.id) {
      focusNode(titleNode()) // the card that is already open: only the focus moves
      return
    }
    requestLeave(() => {
      addQueryToUrl({ product: product.id })
      pendingFocus.current = { kind: 'title' }
      select({ id: product.id })
    })
  }

  const openNew = () => {
    requestLeave(() => {
      clearProductParam()
      pendingFocus.current = { kind: 'title' }
      select({ isNew: true })
    })
  }

  // The controller calls this after adding or deleting: back to the list, the focus on the new row (or on «Add new» after a delete).
  // redesign GC-D (R4): a delete ends with the card, and the dialog that asked for it, gone; the focus the dialog hands back lands
  // after this one (on the first «Close» of the sheet), so after a delete the focus is kept on «Add new» for a few frames (`settle`).
  const onEditorDone = () => {
    const id = lastAddedId.current
    lastAddedId.current = null
    backToList(id != null ? { kind: 'row', id } : { kind: 'add', settle: true })
  }

  const onAdded = (result) => {
    lastAddedId.current = result?.id ?? null
    handleSuccessAddProduct?.(result)
  }

  const onSettingsClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (dirty) {
      event.preventDefault()
      requestLeave(() => {
        finish()
        history.push(SETTINGS_PATH)
      })
      return
    }
    finish() // the link navigates by itself
  }

  // The parent closed the sheet: the view starts again next time
  useEffect(() => {
    if (open) return
    setSelection(null)
    setDirty(false)
    setDiscard(null)
    clearProductParam()
    initialHandled.current = false
  }, [open])

  // `?product=<id>` in the URL: once the list is there, that card opens, as in `main`
  useEffect(() => {
    if (!open || loading || initialHandled.current) return
    initialHandled.current = true
    const id = new URLSearchParams(window.location.search).get('product')
    if (!id) return
    const product = products.find(item => String(item.id) === id)
    if (!product) return
    pendingFocus.current = { kind: 'title' }
    select({ id: product.id })
  }, [open, loading])

  // After a change of view the focus goes to the heading of what shows (or back to the row it came from)
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const body = bodyRef.current
    if (!body) return
    let node = null
    if (target.kind === 'title') {
      node = titleNode()
    } else if (target.kind === 'row') {
      node = Array.from(body.querySelectorAll('[data-gcc-row]')).find(row => row.getAttribute('data-gcc-row') === String(target.id))
    }
    if (!node && target.kind !== 'title') node = body.querySelector('[data-gcc-add]')
    focusNode(node)
    if (target.settle) keepFocusOn(node)
  }, [selectionKey])

  // redesign GC-D (R3): «Retry» removes the error, and itself, while the list loads, and the focus fell to <body>, outside the modal
  // sheet. When the answer comes it goes to the first row, to the new «Retry» if it fails again, or to the title of the sheet if
  // the list is empty.
  const retry = () => {
    retryRef.current = { sawLoading: false }
    reload?.()
  }
  useEffect(() => {
    const waiting = retryRef.current
    if (!waiting) return
    if (loading) {
      waiting.sawLoading = true
      return
    }
    if (!waiting.sawLoading) return
    retryRef.current = null
    const body = bodyRef.current
    if (!body) return
    let node
    if (error) node = body.querySelector('[data-gcc-retry]')
    else if (products.length > 0) node = body.querySelector('[data-gcc-row]')
    else node = titleNode()
    focusNode(node)
  }, [loading, error, products.length])

  const handleOpenChange = (next) => {
    if (!next) requestLeave(finish)
  }

  const renderRows = () => {
    if (loading) {
      return (
        <ul className='odc-gcc-list' aria-busy='true' aria-label={listTitle}>
          <li><span className='odc-sr-only'>{t('LOADING', 'Loading')}</span></li>
          {[...Array(5).keys()].map(index => (
            <li key={index} aria-hidden='true'>
              <div className='odc-gcc-ghost'>
                <Skeleton shape='box' size='var(--od-x-control-height-lg)' block='var(--od-x-control-height-lg)' />
                <span className='odc-gcc-ghost-main'>
                  <Skeleton size='55%' />
                  <Skeleton size='30%' />
                </span>
                <Skeleton size='var(--od-x-sk-total)' />
              </div>
            </li>
          ))}
        </ul>
      )
    }
    if (error) {
      return (
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={translateApiMessage(t, firstMessage(error), t('GIFT_CARDS_CATALOG_LOAD_ERROR', "We couldn't load the gift cards for sale."))}
          action={<Button data-gcc-retry='' onClick={retry}>{t('RETRY', 'Retry')}</Button>}
        />
      )
    }
    if (products.length === 0) {
      return <EmptyState title={t('GIFT_CARDS_CATALOG_EMPTY', 'No gift cards for sale yet')} />
    }
    return (
      <ul className='odc-gcc-list' aria-label={listTitle}>
        {products.map(product => {
          const active = current?.id === product.id
          const enabled = product.enabled === true
          return (
            <li key={product.id}>
              <button
                type='button'
                className='odc-gcc-row'
                data-gcc-row={product.id}
                aria-current={active ? 'true' : undefined}
                onClick={() => openProduct(product)}
              >
                <span className='odc-gcc-thumb'>
                  {product.image
                    ? <img src={optimizeImage(product.image)} alt='' loading='lazy' />
                    : <ImageIcon className='odc-icon' aria-hidden='true' />}
                </span>
                <span className='odc-gcc-row-main'>
                  <bdi dir='auto' className='odc-gcc-name'>{product.name}</bdi>
                  <Status
                    family={enabled ? 'done' : 'cancel'}
                    label={enabled ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')}
                  />
                </span>
                <span className='odc-gcc-row-price odc-figure'>{parsePrice(product.price)}</span>
                <ChevronRight className='odc-icon odc-icon-flip odc-gcc-chevron' aria-hidden='true' />
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const listPane = (
    <section className='odc-gcc-pane odc-gcc-pane-list' aria-label={listTitle}>
      {/* redesign GC-D (R7): the link is inside the text, on its own line after the notice, not in the `action` slot (that slot is
          `flex: none` and left the text 31-62px wide in fr, it, de, pt, nl and bg at 390). Product's link button, as «Order #n»
          of the list: its 44px reach on a phone comes with it. */}
      <InlineNotice tone='info' className='odc-gcc-notice'>
        <strong>{t('GIFT_CARDS_STRIPE_REQUIRED', 'Stripe activation is required.')}</strong>{' '}
        {t('GIFT_CARDS_WALLET_ONLY', 'Compatible only with Wallet.')}
        <span className='odc-gcc-notice-link'>
          <Link className='odc-btn odc-gcc-link' data-variant='link' to={SETTINGS_PATH} onClick={onSettingsClick}>
            {t('GIFT_CARD_SETTINGS', 'Gift card settings')}
          </Link>
        </span>
      </InlineNotice>
      {renderRows()}
      <div className='odc-gcc-foot'>
        <Button variant={twoUp ? 'secondary' : 'primary'} icon={Plus} data-gcc-add='' onClick={openNew}>
          {t('ADD_NEW_GIFT_CARD', 'Add new gift card')}
        </Button>
      </div>
    </section>
  )

  const leaveDetail = () => requestLeave(() => backToList(backFocus()))

  const detailPane = current && detailProduct
    ? (
      <section className='odc-gcc-pane odc-gcc-pane-detail' aria-label={detailTitle}>
        <div className='odc-gcc-detail-head'>
          {twoUp
            ? (
              <>
                <h3 ref={detailTitleRef} tabIndex={-1} className='odc-gcc-detail-title'>{detailTitle}</h3>
                {/* redesign GC-D (R6): this X closes the card and the one of the sheet closes everything: they must not sound alike */}
                <IconButton icon={X} label={t('GIFT_CARD_CLOSE_CARD', 'Close gift card')} onClick={leaveDetail} />
              </>
              )
            : <IconButton icon={ChevronLeft} flipInRtl label={t('BACK', 'Back')} onClick={leaveDetail} />}
        </div>
        <GiftCardEditor
          key={selectionKey}
          product={detailProduct}
          handleSuccessAddProduct={onAdded}
          handleSuccessUpdateProduct={handleSuccessUpdateProduct}
          handleSuccessDeleteProduct={handleSuccessDeleteProduct}
          onDirtyChange={setDirty}
          onClose={onEditorDone}
        />
      </section>
      )
    : null

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={handleOpenChange}
        title={sheetTitle}
        closeLabel={t('CLOSE', 'Close')}
        side='end'
        className={cx('odc-gcc-sheet', twoUp && 'odc-gcc-sheet--wide')}
      >
        <div ref={bodyRef} className='odc-root odc-gcc' data-two-up={twoUp ? '' : undefined}>
          {(!detailPane || twoUp) && listPane}
          {detailPane}
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!discard}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          const go = discard?.go
          setDiscard(null)
          setDirty(false)
          go?.()
        }}
        onCancel={() => setDiscard(null)}
      >
        {t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}
