import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage, useUtils, BannerImageDetails as BannerImageDetailsController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { bytesConverter } from '../../../utils/bytesConverter'
import { Button, ConfirmDialog, Dialog, InlineNotice, RadioGroup } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import { Check, CircleAlert, Trash2 } from '../../Shared/Icon'
import { BusinessRadioList } from './BusinessRadioList'
import { ProductPicker } from './ProductPicker'
import './banner-image.css'

// redesign AB-B4 (decision 3 → 3A, decision 17; M-AB01, M-AB03, M-AB08, M-AB13, M-AB15, M-AB16, M-AB18, M-AB20, M-AB22, M-AB24, M-AB25): the image
// of a banner is edited in a Product Dialog over the panel (main: a third panel). K/BannerImageDetails (AB-B1 contract) owns the state and the
// requests; this file only draws it. What changes against main: the picture is a Product ImageField (cropped with the proportion of the position,
// drops accepted, the same two refusals as main: not an image, over 2 MB); the link is a required radio group (a business or a product, and
// «Link kept as it is» for a type main did not know); the product link lists businesses with the same search and pages as the business link;
// each missing field says so on itself; a failed save keeps the dialog open with the translated error; deleting asks with verb and object and
// does not close if it failed; closing with a picked image or a changed link asks to discard.
//
// Props (README): `open`, `image` (the item, or null = add), `bannerId`, `position` (D/bannerPositions), `onClose`, `handleDeleteBannerItem`,
// `handleUpdateBannerItem`, `handleSuccessBannerItemAdd`; and the optional `bannerName` (the delete confirmation names the banner).

const SAVED_BEAT_MS = 600 // «Saved» is read before the dialog closes on edit
const MAX_IMAGE_KB = 2048 // main's measure: bytesConverter(size) > 2048
// 'none' is «No link» (P13): no action key is sent. Offered only without a stored link: an edit without the key keeps it
const KNOWN_LINKS = ['business', 'product', 'none']

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// The translated lines of an API error (an array of messages, a message, an Error), or the fallback sentence
const linesOf = (t, error, fallback) => {
  const messages = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .filter(Boolean)
  return messages.length ? messages.map(message => translateApiMessage(t, message, fallback)) : [fallback]
}

const same = (a, b) => a != null && a !== '' && b != null && b !== '' && String(a) === String(b)
const norm = (value) => (value == null || value === 'none' ? '' : String(value))

const FieldError = ({ id, children }) => (
  <p id={id} className='odc-banners-field-error' role='alert'>
    <CircleAlert className='odc-icon' aria-hidden='true' />
    <span>{children}</span>
  </p>
)

const Required = ({ label }) => (
  <>
    <span className='odc-banners-required' aria-hidden='true'>{' *'}</span>
    <span className='odc-sr-only'>{label}</span>
  </>
)

const ImageDialogUI = (props) => {
  const {
    image,
    position,
    bannerName,
    onClose,
    handleDeleteBannerItem,
    imageState,
    changesState,
    handleChangeItem,
    searchValue,
    onSearch,
    businessList,
    handleChangeBusinessPage,
    selectedLinkType,
    setSelectedLinkType,
    selectedBusinessId,
    setSelectedBusinessId,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedProductId,
    setSelectedProductId,
    handleSaveImage,
    aspectRatio,
    showAspectRatioBox
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const ids = { link: useId(), linkError: useId() }

  const [submitted, setSubmitted] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [picked, setPicked] = useState(null) // the business the person chose: its slug survives a change of page of the list

  const mounted = useRef(true)
  const beat = useRef(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(beat.current)
    }
  }, [])

  const stored = image?.action
  const storedType = stored?.type ?? null
  // redesign AB-R1 (review r1 #6): the stored business is named by the path of its link («/store/burgerpalace»), not by its id
  const storedBusinessPath = (() => {
    if (typeof stored?.url !== 'string' || !stored.url.trim()) return ''
    try { return new URL(stored.url, 'https://link.invalid').pathname } catch (error) { return '' }
  })()
  const linkedText = storedBusinessPath && stored?.business_id != null && stored.business_id === selectedBusinessId
    ? t('AD_BANNERS_LINKED_NOW_PATH', 'Linked now: _path_').replace('_path_', () => storedBusinessPath)
    : undefined
  const isKnown = KNOWN_LINKS.includes(selectedLinkType)
  const keptType = selectedLinkType && !isKnown ? selectedLinkType : null
  const newImage = changesState?.changes?.image
  const working = saving || !!imageState?.loading || !!changesState?.loading
  const blocked = working || deleting

  // ---- what the person changed (the discard guard) ----
  const linkChanged = norm(selectedLinkType) !== norm(storedType) ||
    (selectedLinkType === 'business' && norm(selectedBusinessId) !== norm(stored?.business_id)) ||
    (selectedLinkType === 'product' && (
      norm(selectedBusinessId) !== norm(stored?.business_id) || norm(selectedProductId) !== norm(stored?.product_id)
    ))
  const dirty = !saved && (!!newImage || linkChanged)

  // ---- validation: each message on its own field (M-AB25) ----
  const validate = () => {
    const found = {}
    if (!image && !newImage) found.image = t('AD_BANNERS_IMAGE_REQUIRED', 'Choose an image.')
    if (!selectedLinkType) {
      found.link = t('AD_BANNERS_LINK_REQUIRED', 'Choose what the image links to.')
    } else if (selectedLinkType === 'business' && !selectedBusinessId) {
      found.business = t('AD_BANNERS_BUSINESS_REQUIRED', 'Choose a business.')
    } else if (selectedLinkType === 'product') {
      if (!selectedBusinessId) found.business = t('AD_BANNERS_BUSINESS_REQUIRED', 'Choose a business.')
      else if (!selectedProductId) found.product = t('AD_BANNERS_PRODUCT_REQUIRED', 'Choose a product.')
    }
    return found
  }
  const errors = submitted ? validate() : {}

  // ---- the picture ----
  const validateFile = (file) => {
    if (String(file?.type).split('/')[0] !== 'image') {
      setFileError(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return false
    }
    if (bytesConverter(file.size) > MAX_IMAGE_KB) {
      setFileError(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return false
    }
    setFileError(null)
    return true
  }
  const storedUrl = imageState?.image?.url ?? image?.url
  const imageValue = newImage || (storedUrl ? optimizeImage(storedUrl, 'h_130,c_limit') : undefined)

  // ---- the link ----
  const chooseBusiness = (id, business) => {
    setPicked(business ? { id: business.id, slug: business.slug } : null)
    if (!same(id, selectedBusinessId)) {
      // a product belongs to its business: another business forgets the product (main kept the stale one)
      setSelectedProductId(null)
      setSelectedCategoryId(null)
    }
    setSelectedBusinessId(id)
  }

  let pickerBusiness = null
  if (selectedBusinessId != null && selectedBusinessId !== '') {
    const onPage = (businessList?.businesses ?? []).find(business => same(business.id, selectedBusinessId))
    if (onPage) pickerBusiness = { id: onPage.id, slug: onPage.slug }
    else if (same(picked?.id, selectedBusinessId)) pickerBusiness = { id: picked.id, slug: picked.slug }
    else if (same(stored?.business_id, selectedBusinessId)) pickerBusiness = { id: selectedBusinessId } // its slug is in the stored URL
  }

  // ---- closing ----
  const close = () => {
    clearTimeout(beat.current)
    onClose?.()
  }
  const requestClose = () => {
    if (blocked) return
    if (dirty) setDiscardOpen(true)
    else close()
  }

  // ---- saving ----
  const save = async () => {
    if (blocked || saved) return
    setSubmitted(true)
    setSaveError(null)
    if (Object.keys(validate()).length > 0) return
    setSaving(true)
    let result
    try {
      result = await handleSaveImage()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setSaving(false)
    if (!result?.ok) {
      setSaveError(linesOf(t, result?.error ?? result?.result, t('AD_BANNERS_IMAGE_SAVE_ERROR', "We couldn't save the image. Try again.")))
      return
    }
    // On add the controller has told the list and closed the dialog; on edit this one says «Saved» and closes
    if (image) {
      setSaved(true)
      beat.current = setTimeout(() => onClose?.(), SAVED_BEAT_MS)
    }
  }

  // ---- deleting ----
  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setSaveError(null)
    let result
    try {
      result = await handleDeleteBannerItem(image.id)
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
    if (result?.ok) onClose?.()
    else setSaveError(linesOf(t, result?.error ?? result?.result, t('AD_BANNERS_DELETE_IMAGE_ERROR', "We couldn't delete the image. Try again.")))
  }

  const apiLines = saveError ?? (!imageState?.loading && hasError(imageState?.error)
    ? linesOf(t, imageState.error, t('AD_BANNERS_IMAGE_SAVE_ERROR', "We couldn't save the image. Try again."))
    : null)

  const requiredLabel = t('REQUIRED', 'Required')
  const bannerLabel = bannerName
    ? t('AD_BANNERS_DELETE_IMAGE_BODY', 'It stops showing in "_name_". This can\'t be undone.').replace('_name_', () => bannerName)
    : t('AD_BANNERS_DELETE_IMAGE_BODY_UNNAMED', 'It stops showing in this banner. This can\'t be undone.')

  const footer = (
    <>
      {image && (
        <Button
          variant='ghost'
          icon={Trash2}
          className='odc-banners-image-delete'
          disabled={blocked}
          onClick={() => setDeleteOpen(true)}
        >
          {t('AD_BANNERS_DELETE_IMAGE', 'Delete image')}
        </Button>
      )}
      <Button onClick={requestClose} disabled={blocked}>{t('CANCEL', 'Cancel')}</Button>
      <Button
        variant='primary'
        busy={working}
        disabled={saved || !!businessList?.loading}
        onClick={save}
      >
        {image ? t('AD_BANNERS_SAVE_IMAGE', 'Save image') : t('AD_BANNERS_ADD_IMAGE', 'Add image')}
      </Button>
    </>
  )

  return (
    <>
      <Dialog
        open
        size='lg'
        title={image ? t('AD_BANNERS_EDIT_IMAGE_TITLE', 'Edit image') : t('AD_BANNERS_ADD_IMAGE', 'Add image')}
        closeLabel={t('CLOSE', 'Close')}
        onOpenChange={requestClose}
        footer={footer}
      >
        <div className='odc-root odc-banners-image-body'>
          <ImageField
            label={t('IMAGE', 'Image')}
            required={!image}
            requiredLabel={requiredLabel}
            hint={t('AD_BANNERS_IMAGE_HINT', '_size_ · up to 2 MB').replace('_size_', () => position?.size ?? '')}
            error={fileError ?? errors.image}
            value={imageValue}
            previewAlt={t('AD_BANNERS_IMAGE_PREVIEW', 'Preview of the image')}
            changeLabel={imageValue ? t('AD_BANNERS_CHANGE_IMAGE', 'Change image') : t('AD_BANNERS_CHOOSE_IMAGE', 'Choose image')}
            cropTitle={t('IMAGE_CROP', 'Image crop')}
            closeLabel={t('CLOSE', 'Close')}
            aspectRatio={aspectRatio}
            showAspectRatioBox={showAspectRatioBox}
            droppable
            tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
            validateFile={validateFile}
            disabled={blocked}
            onChange={(dataUrl) => {
              setFileError(null)
              handleChangeItem({ image: dataUrl, type: 'image' })
            }}
          />

          <section className='odc-banners-image-section' aria-labelledby={ids.link}>
            <h3 id={ids.link} className='odc-banners-image-section-title'>
              {t('AD_BANNERS_LINK', 'Link')}
              <Required label={requiredLabel} />
            </h3>
            {keptType && (
              <p className='odc-banners-link-kept'>
                <Check className='odc-icon' aria-hidden='true' />
                <span>{t('AD_BANNERS_LINK_KEPT', 'Link kept as it is (_type_)').replace('_type_', () => keptType)}</span>
              </p>
            )}
            <RadioGroup
              hideLabel
              orientation='horizontal'
              label={t('AD_BANNERS_LINK', 'Link')}
              value={isKnown ? selectedLinkType : ''}
              onValueChange={setSelectedLinkType}
              options={[
                { value: 'business', label: t('AD_BANNERS_LINK_BUSINESS', 'A business') },
                { value: 'product', label: t('AD_BANNERS_LINK_PRODUCT', 'A product') },
                ...(storedType ? [] : [{ value: 'none', label: t('AD_BANNERS_NO_LINK', 'No link') }])
              ]}
              aria-required='true'
              aria-invalid={errors.link ? 'true' : undefined}
              aria-describedby={errors.link ? ids.linkError : undefined}
            />
            {errors.link && <FieldError id={ids.linkError}>{errors.link}</FieldError>}
          </section>

          {isKnown && selectedLinkType !== 'none' && (
            <section className='odc-banners-image-section'>
              <h3 className='odc-banners-image-section-title'>{t('BUSINESS', 'Business')}</h3>
              <BusinessRadioList
                label={t('BUSINESS', 'Business')}
                businessList={businessList}
                initialSearch={searchValue ?? ''}
                onSearch={onSearch}
                onPageChange={handleChangeBusinessPage}
                value={selectedBusinessId}
                onChange={chooseBusiness}
                linkedText={linkedText}
              />
              {errors.business && <FieldError>{errors.business}</FieldError>}
            </section>
          )}

          {selectedLinkType === 'product' && pickerBusiness && (
            <section className='odc-banners-image-section'>
              <h3 className='odc-banners-image-section-title'>{t('PRODUCT', 'Product')}</h3>
              <ProductPicker
                business={pickerBusiness}
                storedUrl={stored?.url}
                categoryId={selectedCategoryId}
                productId={selectedProductId}
                onChange={({ categoryId, productId }) => {
                  setSelectedCategoryId(categoryId)
                  setSelectedProductId(productId)
                }}
              />
              {errors.product && <FieldError>{errors.product}</FieldError>}
            </section>
          )}

          {saved && <InlineNotice tone='info'>{t('SAVED', 'Saved')}</InlineNotice>}
          {apiLines && <InlineNotice tone='danger'>{apiLines.join(' ')}</InlineNotice>}
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={t('AD_BANNERS_DELETE_IMAGE_TITLE', 'Delete this image?')}
        confirmLabel={t('AD_BANNERS_DELETE_IMAGE', 'Delete image')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteOpen(false) }}
      >
        {bannerLabel}
      </ConfirmDialog>

      <ConfirmDialog
        open={discardOpen}
        tone='danger'
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          setDiscardOpen(false)
          close()
        }}
        onCancel={() => setDiscardOpen(false)}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

export const BannerImageDialog = ({ open = false, image = null, position, ...host }) => {
  // The controller (and the Dialog inside it) exist only while open, so the focus goes back to what opened the dialog by hand
  const openerRef = useRef(null)
  if (open && openerRef.current === null && typeof document !== 'undefined') openerRef.current = document.activeElement
  useEffect(() => {
    if (open) return
    const opener = openerRef.current
    openerRef.current = null
    if (opener && opener !== document.body && opener.isConnected) opener.focus()
  }, [open])

  if (!open) return null
  return (
    <BannerImageDetailsController
      key={image?.id ?? 'new'}
      {...host}
      image={image}
      position={position}
      aspectRatio={position?.aspectRatio}
      showAspectRatioBox={position?.showAspectRatioBox}
      isSearchByName
      UIComponent={ImageDialogUI}
    />
  )
}
