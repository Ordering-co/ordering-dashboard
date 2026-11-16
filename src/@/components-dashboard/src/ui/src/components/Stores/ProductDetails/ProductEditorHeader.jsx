import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils } from '~components'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { ProductDesktopPreview } from '../ProductDesktopPreview'
import { SnoozeComponent } from '../SnoozeComponent'
import { Modal } from '../../Shared'
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  InlineNotice,
  Menu,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  Switch
} from '../../Shared/Product'
import { ArrowLeft, Copy, Ellipsis, Eye, Image, Maximize2, Minimize2, SlidersHorizontal, Trash2, TriangleAlert, X } from '../../Shared/Icon'
import './product-editor.css'

// redesign SP-F1 (D1)
// The header of the product editor: the product (thumbnail, name, Enabled / Disabled and its switch), Snooze, Expand, the ⋯
// menu and the way out. It is what ProductSummary drew above its overview, and it stays in view when a section is open. It
// owns the Snooze dialog, the Preview modal and the Duplicate and Delete confirmations; everything else is a callback of the shell.
//
// @param {object}   props
// @param {boolean}  props.loading                 `productState.loading` (or nothing loaded yet): skeletons instead of the product.
// @param {object}   [props.product]               `productState.product`. Without it (not found) only the way out is drawn.
// @param {Function} props.handleChangeProductActiveState  `() => Promise<{ ok, error } | void>`: asks the controller for the opposite
//                                                 of the stored value. The switch shows the value it asks for while it saves and goes
//                                                 back to the stored one when the save did not land, saying so (M-12).
// @param {Function} props.handleDuplicateProduct  `() => Promise<{ ok, error } | void>`. Confirmed with «Duplicate <product>?»
//                                                 (redesign D-9); a failure is said in the header.
// @param {Function} props.handleDeleteProduct     Confirmed with «Delete <product>?»; the controller closes the panel when it lands.
// @param {Function} props.onSelectSection         `(id) => void`: «Custom fields» opens that section.
// @param {object}   props.formState, props.handleChangeFormState, props.handleUpdateClick  What SnoozeComponent writes and saves.
// @param {object}   props.productCart, props.showProductOption, props.getProduct  What the Preview modal's ProductDesktopPreview takes.
// @param {boolean}  props.showExpand              Expand / Collapse is offered when true (the shell always offers it, as main did).
// @param {boolean}  props.isExpand
// @param {Function} props.onToggleExpand
// @param {boolean}  props.isExtendExtraOpen       A section asked for the whole width: «All sections» is drawn.
// @param {Function} props.onShowAllSections
// @param {Function} props.onClose

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

export const ProductEditorHeader = ({
  titleId,
  loading,
  product,
  handleChangeProductActiveState,
  handleDuplicateProduct,
  handleDeleteProduct,
  onSelectSection,
  formState,
  handleChangeFormState,
  handleUpdateClick,
  productCart,
  showProductOption,
  getProduct,
  duplicateState,
  showExpand,
  isExpand,
  onToggleExpand,
  isExtendExtraOpen,
  onShowAllSections,
  onClose
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [pendingEnabled, setPendingEnabled] = useState(null)
  const [failure, setFailure] = useState(null) // { kind: 'enabled' | 'duplicate', error }
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false)
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, busy: false })
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewView, setPreviewView] = useState('desktop')
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // Another product: what was said about the last one is not about this one.
  useEffect(() => { setFailure(null) }, [product?.id])

  const closeButton = (
    <IconButton icon={X} label={t('CLOSE', 'Close')} onClick={onClose} />
  )

  // Not found: nothing to act on, only the way out
  if (!loading && !product) {
    return (
      <header className='odc-pe-head'>
        <div className='odc-pe-head-row'>
          <h2 id={titleId} className='odc-pe-title'>{t('PRODUCT', 'Product')}</h2>
          <span className='odc-pe-spacer' />
          <div className='odc-pe-actions'>{closeButton}</div>
        </div>
      </header>
    )
  }

  const name = product?.name
  const enabled = pendingEnabled ?? !!product?.enabled
  const image = product?.images ? optimizeImage(product.images, 'h_100,c_limit') : null

  // The switch shows what was asked while it saves. Whatever the save returns, it goes back to the stored value: that one
  // is already the new one when the save landed (the controller writes it) and the old one when it did not.
  const handleToggle = async (next) => {
    setFailure(null)
    setPendingEnabled(next)
    let result
    try {
      result = await handleChangeProductActiveState()
    } catch (error) {
      result = { ok: false, error }
    }
    if (!mounted.current) return
    setPendingEnabled(null)
    if (result && result.ok === false) setFailure({ kind: 'enabled', error: result.error })
  }

  // redesign D-9 (owner, 2026-10-19): Duplicate asks first. The copy is created when the API answers; until then the
  // confirmation stays open and busy. Whatever it answers, it closes: a failure is said in the header, as before.
  const handleConfirmDuplicate = async () => {
    if (duplicateDialog.busy) return
    setFailure(null)
    setDuplicateDialog({ open: true, busy: true })
    let result
    try {
      result = await handleDuplicateProduct()
    } catch (error) {
      result = { ok: false, error }
    }
    if (!mounted.current) return
    setDuplicateDialog({ open: false, busy: false })
    if (result && result.ok === false) setFailure({ kind: 'duplicate', error: result.error })
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await handleDeleteProduct()
    } finally {
      if (mounted.current) {
        setIsDeleting(false)
        setIsDeleteOpen(false)
      }
    }
  }

  const closePreview = () => {
    setIsPreviewOpen(false)
    setPreviewView('desktop')
  }

  const menuItems = [
    {
      key: 'preview',
      label: t('PREVIEW', 'Preview'),
      icon: Eye,
      disabled: loading,
      onSelect: () => setIsPreviewOpen(true)
    },
    {
      key: 'duplicate',
      label: t('DUPLICATE', 'Duplicate'),
      icon: Copy,
      disabled: loading || !!duplicateState?.loading,
      onSelect: () => setDuplicateDialog({ open: true, busy: false })
    },
    {
      key: 'custom_fields',
      label: t('CUSTOM_FIELDS', 'Custom fields'),
      icon: SlidersHorizontal,
      disabled: loading,
      onSelect: () => onSelectSection('custom_fields')
    },
    {
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      separatorBefore: true,
      disabled: loading,
      onSelect: () => setIsDeleteOpen(true)
    }
  ]

  const failureText = failure && translateApiMessage(
    t,
    firstMessage(failure.error),
    failure.kind === 'duplicate'
      ? t('PRODUCT_EDITOR_DUPLICATE_FAILED', 'We couldn\'t duplicate the product.')
      : t('STORES_CHANGE_FAILED', 'We couldn\'t save the change.')
  )

  return (
    <header className='odc-pe-head'>
      <div className='odc-pe-head-row'>
        {/* thumbnail, name, state and switch are one block, so the actions (which are fixed) drop to their own line when the
            name would not have room, instead of leaving it a few pixels to break letter by letter */}
        <div className='odc-pe-head-lead'>
          {loading
            ? (
              <>
                <Skeleton size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' shape='box' />
                <h2 id={titleId} className='odc-pe-title'>
                  <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
                  <Skeleton size='var(--od-x-cell-person)' />
                </h2>
              </>
              )
            : (
              <>
                <span className='odc-pe-thumb'>
                  {image
                    ? <img src={image} alt='' onError={event => { event.currentTarget.hidden = true }} />
                    : <Image className='odc-icon' aria-hidden='true' />}
                </span>
                <h2 id={titleId} className='odc-pe-title' dir='auto'>{name}</h2>
                <StatusBadge
                  family={enabled ? 'done' : 'cancel'}
                  label={enabled ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')}
                />
                <Switch
                  label={t('PRODUCT_EDITOR_ENABLE', 'Enable _name_').replace('_name_', name || '')}
                  checked={enabled}
                  busy={pendingEnabled !== null}
                  onCheckedChange={handleToggle}
                />
              </>
              )}
        </div>
        <div className='odc-pe-actions'>
          {showExpand && (
            <IconButton
              icon={isExpand ? Minimize2 : Maximize2}
              label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
              onClick={onToggleExpand}
            />
          )}
          <Menu icon={Ellipsis} label={t('MORE_ACTIONS', 'More actions')} items={menuItems} />
          {closeButton}
        </div>
      </div>
      <div className='odc-pe-head-tools'>
        {isExtendExtraOpen && (
          <Button icon={ArrowLeft} onClick={onShowAllSections}>{t('ALL_SECTIONS', 'All sections')}</Button>
        )}
        <Button disabled={loading} onClick={() => setIsSnoozeOpen(true)}>{t('SNOOZE', 'Snooze')}</Button>
        {failureText && (
          <InlineNotice tone='danger' icon={TriangleAlert} role='alert' className='odc-pe-notice'>
            {failureText}
          </InlineNotice>
        )}
      </div>
      <Dialog
        open={isSnoozeOpen}
        onOpenChange={setIsSnoozeOpen}
        size='lg'
        title={t('SNOOZE', 'Snooze')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <SnoozeComponent
          dataState={product}
          handleUpdate={handleUpdateClick}
          handleChangeFormState={handleChangeFormState}
          formState={formState}
          onClose={() => setIsSnoozeOpen(false)}
        />
      </Dialog>
      <ConfirmDialog
        open={duplicateDialog.open}
        tone='primary'
        busy={duplicateDialog.busy}
        title={t('PRODUCT_EDITOR_DUPLICATE_TITLE', 'Duplicate _name_?').replace('_name_', name || '')}
        confirmLabel={t('PRODUCT_EDITOR_DUPLICATE_CONFIRM', 'Duplicate product')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDuplicateDialog({ open: false, busy: false })}
        onConfirm={handleConfirmDuplicate}
      >
        {t('PRODUCT_EDITOR_DUPLICATE_DESCRIPTION', 'This creates a copy of this product in the same category. This product does not change.')}
      </ConfirmDialog>
      <ConfirmDialog
        open={isDeleteOpen}
        busy={isDeleting}
        title={t('PRODUCT_EDITOR_DELETE_TITLE', 'Delete _name_?').replace('_name_', name || '')}
        confirmLabel={t('DELETE_PRODUCT', 'Delete product')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      >
        {/* the title already asks «Delete <name>?»; the body says what it does (DELETE of the product from its category), as Duplicate does */}
        {t('DELETE_PRODUCT_CONSEQUENCE', "This can't be undone. The product disappears from every menu of this store.")}
      </ConfirmDialog>
      {/* Preview: the Modal of main (ProductSummary:318-358, 900px) with the storefront simulation untouched inside. */}
      {isPreviewOpen && (
        <Modal
          width='calc(var(--od-x-store-panel-wide) * 0.9)'
          open={isPreviewOpen}
          onClose={closePreview}
        >
          <div className='odc-pe-preview-head'>
            <h2 className='odc-pe-preview-title'>{t('PREVIEW', 'Preview')}</h2>
            <div className='odc-pe-preview-tools'>
              <Button variant='primary' onClick={() => getProduct()}>{t('RELOAD', 'Reload')}</Button>
              <SegmentedControl
                label={t('PREVIEW', 'Preview')}
                value={previewView}
                onValueChange={setPreviewView}
                options={[
                  { value: 'desktop', label: t('PRODUCT_EDITOR_VIEW_DESKTOP', 'Desktop view') },
                  { value: 'mobile', label: t('PRODUCT_EDITOR_VIEW_MOBILE', 'Mobile view') }
                ]}
              />
            </div>
          </div>
          <ProductDesktopPreview
            isMobileView={previewView === 'mobile'}
            product={product}
            productCart={productCart}
            showProductOption={showProductOption}
          />
        </Modal>
      )}
    </header>
  )
}
