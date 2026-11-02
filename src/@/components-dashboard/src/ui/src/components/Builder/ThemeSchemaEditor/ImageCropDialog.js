import React, { useEffect, useId, useRef, useState } from 'react'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { Overlay, Tooltip } from 'react-bootstrap'
import { Crop, ExclamationTriangle } from 'react-bootstrap-icons'
import styled from 'styled-components'

import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import { Modal } from '../../Shared/Modal'
import { DialogBody, DialogFooter, DialogIconTitle } from '../styles'
import { fitSize } from './imageResize'

const CropArea = styled.div`
  position: relative;
  width: 100%;
  height: min(56vh, 420px);
  border-radius: 8px;
  overflow: hidden;
  background: #F1F3F5;
  outline: none;

  &:focus-visible {
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary};
  }

  img {
    display: block;
    /* cropperjs needs it */
    max-width: 100%;
  }
`

const Facts = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0;
  font-size: 13px;

  dt {
    font-weight: 500;
  }

  dd {
    margin: 0;
    color: #5E6B7D;
  }
`

/** Next to the result: it ends up under the recommended size. */
const SmallBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #FFF4CC;
  color: #7A5A00;
  font-size: 12px;
  font-weight: 500;
  cursor: help;

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`

const Muted = styled.p`
  font-size: 12px;
  color: #5E6B7D;
`

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const pixels = (width, height) => `${width} × ${height} px`

/**
 * Crops a picked image to its slot's proportion (`plan.ratio`) before it is
 * uploaded: "Use this crop" answers `onCrop(rect)` with the crop in the
 * image's own pixels; "Upload as is" uploads the file untouched (not offered
 * when the API would refuse it); Cancel and Esc upload nothing.
 */
export const ImageCropDialog = (props) => {
  const { t, label, url, width, height, plan, hints, limits, onCrop, onUploadAsIs, onCancel } = props
  const titleId = useId()
  const textId = useId()
  const keysId = useId()
  const smallId = useId()
  // The tooltip points at the badge by a ref (OverlayTrigger would need findDOMNode)
  const smallBadge = useRef(null)
  const [showSmallHelp, setShowSmallHelp] = useState(false)
  const bodyRef = useRef(null)
  // The popup mounts its content a render later (in a portal): effects wait for these elements
  const [area, setArea] = useState(null)
  const [imageElement, setImageElement] = useState(null)
  const cropperRef = useRef(null)
  const [crop, setCrop] = useState(null)
  const [busy, setBusy] = useState(false)
  // "Upload as is" asks first (a Confirm over this dialog): the website most likely won't fit it well
  const [confirmingAsIs, setConfirmingAsIs] = useState(false)
  const confirming = useRef(false)
  confirming.current = confirmingAsIs
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

  // Focus the crop area once the dialog is in place (the popup focuses itself first)
  useEffect(() => {
    if (!area) return
    const timer = setTimeout(() => area.focus(), 0)
    return () => clearTimeout(timer)
  }, [area])

  // Keep Tab inside the dialog
  useEffect(() => {
    const onKeyDown = (event) => {
      // The Confirm over it keeps its own focus
      if (event.key !== 'Tab' || !bodyRef.current || confirming.current) return
      const scope = bodyRef.current.closest('.popup-component') || bodyRef.current
      const focusable = [...scope.querySelectorAll(FOCUSABLE)].filter(element => !element.closest('[aria-hidden="true"]'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!scope.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === scope)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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

  // The popup keeps the first `onClose` for Esc: refs, not state. With the Confirm open, Esc closes only it
  const close = () => {
    if (confirming.current) return backFromAsIs()
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
    plan.reasons.includes('ratio') && t('BUILDER_THEME_CROP_AS_IS_RATIO', 'Its proportion isn’t _ratio_, so it most likely won’t fit well on your website: it may look cut off or leave empty space.').replace('_ratio_', hints?.ratio || ''),
    plan.reasons.includes('size') && t('BUILDER_THEME_CROP_AS_IS_SIZE', 'It’s bigger than needed, so it may make your website load slower.')
  ].filter(Boolean)
  const smallHelp = tooSmall && t('BUILDER_THEME_CROP_TOO_SMALL_HELP', 'The result is smaller than the recommended _size_, so it may look blurry on large screens. Choose a bigger part of the image, or use a bigger image.').replace('_size_', pixels(minWidth, minHeight))
  const reason = plan.reasons.includes('ratio')
    ? t('BUILDER_THEME_CROP_RATIO_TEXT', 'This image has a different proportion. Move the frame to choose the part to keep.')
    : plan.reasons.includes('size')
      ? t('BUILDER_THEME_CROP_SIZE_TEXT', 'This image is bigger than needed. We’ll make it smaller so the website loads faster.')
      : t('BUILDER_THEME_CROP_LIMIT_TEXT', 'This image is over the upload limit. Crop it or make it smaller to upload it.')

  return (
    <Modal open width='min(760px, calc(100vw - 32px))' padding='24px' onClose={close}>
      <DialogBody ref={bodyRef} role='dialog' aria-modal='true' aria-labelledby={titleId} aria-describedby={textId}>
        <DialogIconTitle>
          <span aria-hidden='true'><Crop /></span>
          <h2 id={titleId}>{t('BUILDER_THEME_CROP_TITLE', 'Crop _label_').replace('_label_', label)}</h2>
        </DialogIconTitle>
        <p id={textId}>{reason}</p>
        <CropArea
          ref={setArea}
          tabIndex={0}
          role='group'
          aria-label={t('BUILDER_THEME_CROP_AREA', 'Crop frame')}
          aria-describedby={keysId}
          onKeyDown={onAreaKeyDown}
        >
          <img ref={setImageElement} src={url} alt='' />
        </CropArea>
        <Muted id={keysId}>{t('BUILDER_THEME_CROP_KEYS', 'Drag the frame or its corners. With the keyboard: arrows move it, + and − resize it.')}</Muted>
        <Facts>
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
                {tooSmall && (
                  <>
                    <SmallBadge
                      ref={smallBadge}
                      tabIndex={0}
                      onMouseEnter={() => setShowSmallHelp(true)}
                      onMouseLeave={() => setShowSmallHelp(false)}
                      onFocus={() => setShowSmallHelp(true)}
                      onBlur={() => setShowSmallHelp(false)}
                    >
                      <ExclamationTriangle aria-hidden='true' />
                      {t('BUILDER_THEME_CROP_TOO_SMALL', 'Too small')}
                      <span className='sr-only'>: {smallHelp}</span>
                    </SmallBadge>
                    <Overlay target={smallBadge.current} show={showSmallHelp} placement='top' transition={false}>
                      <Tooltip id={smallId} style={{ zIndex: 3000 }}>{smallHelp}</Tooltip>
                    </Overlay>
                  </>
                )}
              </dd>
            </>
          )}
        </Facts>
        {plan.overLimit && <Muted>{t('BUILDER_THEME_CROP_OVER_LIMIT', 'It can’t be uploaded as is: it is over the upload limit.')}</Muted>}
        <DialogFooter>
          <Button type='button' color='secundary' borderRadius='8px' disabled={busy} onClick={close}>{t('CANCEL', 'Cancel')}</Button>
          {!plan.overLimit && <Button ref={asIsButton} type='button' color='secundary' borderRadius='8px' disabled={busy} onClick={() => setConfirmingAsIs(true)}>{t('BUILDER_THEME_CROP_AS_IS', 'Upload as is')}</Button>}
          <Button type='button' color='primary' borderRadius='8px' disabled={busy || !crop} onClick={applyCrop}>
            {busy ? t('BUILDER_THEME_CROP_PREPARING', 'Preparing…') : t('BUILDER_THEME_CROP_USE', 'Use this crop')}
          </Button>
        </DialogFooter>
        <Confirm
          open={confirmingAsIs}
          width='min(440px, calc(100vw - 72px))'
          title={t('BUILDER_THEME_CROP_AS_IS_TITLE', 'Upload it without cropping?')}
          acceptText={t('BUILDER_THEME_CROP_AS_IS_CONFIRM', 'Upload anyway')}
          cancelText={t('BACK', 'Back')}
          onAccept={() => { setConfirmingAsIs(false); onUploadAsIs() }}
          onCancel={backFromAsIs}
          onClose={backFromAsIs}
        >
          {asIsWhy.map(text => <p key={text}>{text}</p>)}
        </Confirm>
      </DialogBody>
    </Modal>
  )
}

export default ImageCropDialog
