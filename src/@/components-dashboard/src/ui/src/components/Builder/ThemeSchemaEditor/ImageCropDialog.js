import React, { useEffect, useId, useRef, useState } from 'react'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

import { TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, Dialog, Tooltip } from '../../Shared/Product'
import { byKind } from '../utils'
import { fitSize } from './imageResize'
import './image-crop.css'

const pixels = (width, height) => `${width} × ${height} px`

/**
 * Crops a picked image to its slot's proportion (`plan.ratio`) before it is
 * uploaded: "Use this crop" answers `onCrop(rect)` with the crop in the
 * image's own pixels; "Upload as is" uploads the file untouched (not offered
 * when the API would refuse it); Cancel and Esc upload nothing.
 */
export const ImageCropDialog = (props) => {
  const { t, kind = 'web', label, url, width, height, plan, hints, limits, onCrop, onUploadAsIs, onCancel } = props
  const keysId = useId()
  // redesign B3b: P/Dialog focuses the crop area on open (initialFocus) and keeps Tab inside itself, in the
  // old order (Close, crop area, badge, footer). The popup mounts its content in a portal: cropperjs waits for the image
  const area = useRef(null)
  const [imageElement, setImageElement] = useState(null)
  const cropperRef = useRef(null)
  const [crop, setCrop] = useState(null)
  const [busy, setBusy] = useState(false)
  // "Upload as is" asks first (a ConfirmDialog over this dialog): the website most likely won't fit it well. While it
  // is open it is the topmost layer, so Escape closes only it
  const [confirmingAsIs, setConfirmingAsIs] = useState(false)
  const asIsButton = useRef(null)

  useEffect(() => {
    if (!imageElement) return
    const cropper = new Cropper(imageElement, {
      aspectRatio: plan.ratio || NaN,
      viewMode: 1,
      dragMode: 'none',
      autoCropArea: 1,
      zoomable: false,
      rotatable: false,
      scalable: false,
      movable: false,
      // The browser already turns the image by its EXIF; cropperjs would turn it again
      checkOrientation: false,
      crop: (event) => setCrop({ width: Math.round(event.detail.width), height: Math.round(event.detail.height) })
    })
    cropperRef.current = cropper
    return () => {
      cropper.destroy()
      cropperRef.current = null
    }
  }, [imageElement, url, plan.ratio])

  /** Arrows move the frame (Shift: further); + and − resize it, keeping its proportion. */
  const onAreaKeyDown = (event) => {
    const cropper = cropperRef.current
    const box = cropper?.getCropBoxData()
    if (!box || box.width === undefined) return
    const step = event.shiftKey ? 50 : 10
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      cropper.setCropBoxData({ left: box.left + moves[event.key][0], top: box.top + moves[event.key][1] })
    } else if (['+', '=', '-', '_'].includes(event.key)) {
      event.preventDefault()
      const grow = event.key === '+' || event.key === '=' ? step : -step
      const nextWidth = Math.max(20, box.width + grow)
      const nextHeight = plan.ratio ? nextWidth / plan.ratio : Math.max(20, box.height + grow)
      cropper.setCropBoxData({
        left: box.left - (nextWidth - box.width) / 2,
        top: box.top - (nextHeight - box.height) / 2,
        width: nextWidth,
        height: nextHeight
      })
    }
  }

  const applyCrop = async () => {
    const data = cropperRef.current?.getData(true)
    if (!data || busy) return
    setBusy(true)
    try {
      await onCrop({ x: data.x, y: data.y, width: data.width, height: data.height })
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onCancel()
  }

  const backFromAsIs = () => {
    setConfirmingAsIs(false)
    setTimeout(() => asIsButton.current?.focus(), 0)
  }

  const recommended = plan.recommended
    ? `${pixels(plan.recommended.width, plan.recommended.height)}${hints?.ratio ? ` (${hints.ratio})` : ''}`
    : hints?.ratio
  const result = crop && fitSize(crop.width, crop.height, { hints, limits })
  // Under the recommended size the crop can't add pixels back: it may look blurry where the slot is bigger
  const [minWidth, minHeight] = Array.isArray(hints?.size) ? hints.size : []
  const tooSmall = !!result && !!minWidth && !!minHeight && (result.width < minWidth || result.height < minHeight)
  const asIsWhy = [
    plan.reasons.includes('ratio') && byKind(kind, t('BUILDER_THEME_CROP_AS_IS_RATIO', 'Its proportion isn’t _ratio_, so it most likely won’t fit well on your website: it may look cut off or leave empty space.'), t('BUILDER_APP_THEME_CROP_AS_IS_RATIO', 'Its proportion isn’t _ratio_, so it most likely won’t fit well in your app: it may look cut off or leave empty space.')).replace('_ratio_', hints?.ratio || ''),
    plan.reasons.includes('size') && byKind(kind, t('BUILDER_THEME_CROP_AS_IS_SIZE', 'It’s bigger than needed, so it may make your website load slower.'), t('BUILDER_APP_THEME_CROP_AS_IS_SIZE', 'It’s bigger than needed, so it may make your app load slower.'))
  ].filter(Boolean)
  const smallHelp = tooSmall && t('BUILDER_THEME_CROP_TOO_SMALL_HELP', 'The result is smaller than the recommended _size_, so it may look blurry on large screens. Choose a bigger part of the image, or use a bigger image.').replace('_size_', pixels(minWidth, minHeight))
  const reason = plan.reasons.includes('ratio')
    ? t('BUILDER_THEME_CROP_RATIO_TEXT', 'This image has a different proportion. Move the frame to choose the part to keep.')
    : plan.reasons.includes('size')
      ? byKind(kind, t('BUILDER_THEME_CROP_SIZE_TEXT', 'This image is bigger than needed. We’ll make it smaller so the website loads faster.'), t('BUILDER_APP_THEME_CROP_SIZE_TEXT', 'This image is bigger than needed. We’ll make it smaller so the app loads faster.'))
      : t('BUILDER_THEME_CROP_LIMIT_TEXT', 'This image is over the upload limit. Crop it or make it smaller to upload it.')

  const badge = (
    <span className='odc-ic-small' tabIndex={0}>
      <TriangleAlert className='odc-icon' aria-hidden='true' />
      {t('BUILDER_THEME_CROP_TOO_SMALL', 'Too small')}
      <span className='odc-sr-only'>: {smallHelp}</span>
    </span>
  )

  return (
    <Dialog
      open
      size='lg'
      className='odc-ic-dialog'
      title={t('BUILDER_THEME_CROP_TITLE', 'Crop _label_').replace('_label_', label)}
      description={reason}
      closeLabel={t('CLOSE', 'Close')}
      closeDisabled={busy}
      initialFocus={area}
      onOpenChange={close}
      footer={(
        <>
          <Button disabled={busy} onClick={close}>{t('CANCEL', 'Cancel')}</Button>
          {!plan.overLimit && <Button ref={asIsButton} disabled={busy} onClick={() => setConfirmingAsIs(true)}>{t('BUILDER_THEME_CROP_AS_IS', 'Upload as is')}</Button>}
          <Button variant='primary' disabled={busy || !crop} onClick={applyCrop}>
            {busy ? t('BUILDER_THEME_CROP_PREPARING', 'Preparing…') : t('BUILDER_THEME_CROP_USE', 'Use this crop')}
          </Button>
        </>
      )}
    >
      <div
        ref={area}
        className='odc-ic-area'
        tabIndex={0}
        role='group'
        aria-label={t('BUILDER_THEME_CROP_AREA', 'Crop frame')}
        aria-describedby={keysId}
        onKeyDown={onAreaKeyDown}
      >
        <img ref={setImageElement} src={url} alt='' />
      </div>
      <p id={keysId} className='odc-ic-muted'>{t('BUILDER_THEME_CROP_KEYS', 'Drag the frame or its corners. With the keyboard: arrows move it, + and − resize it.')}</p>
      <dl className='odc-ic-facts'>
        <dt>{t('BUILDER_THEME_CROP_YOURS', 'Your image')}</dt>
        <dd>{pixels(width, height)}</dd>
        {recommended && (
          <>
            <dt>{t('BUILDER_THEME_CROP_RECOMMENDED', 'Recommended')}</dt>
            <dd>{recommended}</dd>
          </>
        )}
        {result && (
          <>
            <dt>{t('BUILDER_THEME_CROP_RESULT', 'Result')}</dt>
            <dd aria-live='polite'>
              {pixels(result.width, result.height)}
              {tooSmall && <Tooltip content={smallHelp}>{badge}</Tooltip>}
            </dd>
          </>
        )}
      </dl>
      {plan.overLimit && <p className='odc-ic-muted'>{t('BUILDER_THEME_CROP_OVER_LIMIT', 'It can’t be uploaded as is: it is over the upload limit.')}</p>}
      <ConfirmDialog
        open={confirmingAsIs}
        tone='primary'
        title={t('BUILDER_THEME_CROP_AS_IS_TITLE', 'Upload it without cropping?')}
        confirmLabel={t('BUILDER_THEME_CROP_AS_IS_CONFIRM', 'Upload anyway')}
        cancelLabel={t('BACK', 'Back')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => { setConfirmingAsIs(false); onUploadAsIs() }}
        onCancel={backFromAsIs}
      >
        {asIsWhy.map(text => <p key={text}>{text}</p>)}
      </ConfirmDialog>
    </Dialog>
  )
}

export default ImageCropDialog
