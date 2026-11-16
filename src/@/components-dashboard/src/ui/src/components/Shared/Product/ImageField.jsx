import React, { useEffect, useRef, useState } from 'react'

import { Image, Trash2 } from '../Icon'
import { ImageCrop } from '../UI/ImageCrop'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { cx } from './classNames'
import { LegacyFieldFrame, describedByIds, requireFrame, useFrameIds } from './legacyField'
import './product.css'
import './legacy-fields.css'

/*
 * redesign W0-7 (T0-28b) · ImageField: the Product frame around the legacy ImageCrop.
 *
 * ImageCrop (Shared/UI) is unchanged: it still takes the data URL of the picked file, crops it and returns the
 * result through `handleChangePhoto(photo)` (a data URL, or the optimized Cloudinary URL when `useCloudinaryUrl`
 * and `themeId` are set), then calls `onClose`. The wrapper hands it exactly the props the legacy consumers hand
 * it (`photo`, `handleChangePhoto`, `aspectRatio`, `showAspectRatioBox`, `useCloudinaryUrl`, `themeId`, `onClose`)
 * and `onChange` receives what `handleChangePhoto` emits, untouched.
 *
 * Around it: a named group (label, hint, error, required marker), a preview of `value`, a «Change» button that
 * opens the file chooser and a «Remove» button (only with a `value` and an `onRemove`). The picked file is read
 * as a data URL, as every legacy consumer does, and cropped inside a Product Dialog.
 *
 * No text of its own. Required: `label`, `changeLabel`, `cropTitle`, `closeLabel`, and `removeLabel` when there
 * is an `onRemove`. `changeLabel` and `removeLabel` are the accessible names and carry the object («Change logo of
 * Burger Hub»); `changeText` and `removeText` are the optional shorter visible words (default: the label). When a
 * visible word differs, the accessible name must contain it (WCAG 2.5.3).
 *
 * `validateFile(file)` is the consumer's hook for what the legacy screens checked before cropping (type, size):
 * returning `false` stops the flow. `value` is controlled: the preview shows what the parent passes back.
 *
 * redesign stores 5.1a (G2-26): OPT-IN `droppable`. A file dropped anywhere on the field (preview, label, buttons,
 * hint) goes through the same flow as a picked one (validateFile, then the crop), and the browser never opens it instead; several
 * files at once are refused with `tooManyFilesText` (required with `droppable`) as the field's error until the next pick or drop.
 * A drop puts the focus on «Change» first, so closing the crop gives it back there (review F2: it went to the first control of
 * the page). A disabled field ignores drops. Without `droppable` the field is exactly as before.
 *
 * redesign stores 5.14 (S-11): OPT-IN `crop` (default `true`: exactly as before). With `crop={false}` a picked or dropped
 * file still goes through `validateFile`, but it is handed straight to `onChange(dataURL)`: no Dialog and no ImageCrop (the image is
 * kept as it is, for the screens whose `main` never cropped), so `cropTitle` and `closeLabel` are not needed.
 *
 * AB-S01: `aspectRatio` (width / height, a positive number) also shapes the preview box, not only the crop: it keeps that
 * proportion inside the old 4:3 footprint's height and twice its width. Without a usable ratio the box is the old 4:3 one.
 */

const noop = () => {}
const hasErrorText = error => error != null && error !== false && error !== ''
// AB-S01: the crop ratio (width / height) the preview box follows; anything else leaves the 4:3 box
const usableRatio = (ratio) => {
  if (ratio == null || ratio === '' || typeof ratio === 'boolean') return null
  const number = Number(ratio)
  return Number.isFinite(number) && number > 0 ? number : null
}

export const ImageField = React.forwardRef(function ProductImageField ({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  disabled = false,
  value,
  previewAlt = '',
  changeLabel,
  changeText,
  removeLabel,
  removeText,
  onChange,
  onRemove,
  accept = 'image/png, image/jpeg, image/jpg',
  validateFile,
  cropTitle,
  closeLabel,
  aspectRatio,
  showAspectRatioBox,
  useCloudinaryUrl,
  themeId,
  resolveThemeId,
  className,
  droppable = false,
  tooManyFilesText,
  crop = true,
  ...props
}, ref) {
  requireFrame('ImageField', { label, required, requiredLabel })
  if (changeLabel == null) throw new Error('ImageField needs a changeLabel')
  if (crop && cropTitle == null) throw new Error('ImageField needs a cropTitle')
  if (crop && closeLabel == null) throw new Error('ImageField needs a closeLabel')
  if (onRemove && removeLabel == null) throw new Error('ImageField needs a removeLabel')
  if (droppable && tooManyFilesText == null) throw new Error('ImageField needs a tooManyFilesText')

  const ids = useFrameIds()
  const fileRef = useRef(null)
  const changeRef = useRef(null)
  const [cropState, setCropState] = useState({ open: false, photo: null })
  const closeCrop = () => setCropState(current => ({ ...current, open: false }))

  const [dropError, setDropError] = useState(null)
  const [dragging, setDragging] = useState(false)

  const read = (file) => {
    setDropError(null)
    if (!file || validateFile?.(file) === false) return
    const reader = new window.FileReader()
    reader.onload = () => {
      if (crop) setCropState({ open: true, photo: reader.result })
      else onChange?.(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // the same file can be picked again
    read(file)
  }

  const canDrop = droppable && !disabled
  const dropProps = canDrop
    ? {
        onDragOver: (event) => {
          event.preventDefault()
          setDragging(true)
        },
        onDragLeave: () => setDragging(false),
        onDrop: (event) => {
          event.preventDefault()
          setDragging(false)
          const files = event.dataTransfer?.files || []
          changeRef.current?.focus({ preventScroll: true })
          if (files.length > 1) {
            setDropError(tooManyFilesText)
            return
          }
          read(files[0])
        }
      }
    : {}

  const shownError = hasErrorText(error) ? error : dropError
  const hasValue = value != null && value !== ''
  // redesign bugs F row 35: remember which value failed to load; a new value is tried again, the stored one is never touched
  const [failedValue, setFailedValue] = useState(null)
  useEffect(() => { setFailedValue(null) }, [value])
  const broken = hasValue && failedValue === value
  const ratio = usableRatio(aspectRatio)
  const describedBy = describedByIds(ids, { hint, error: shownError })

  return (
    <LegacyFieldFrame
      ref={ref}
      ids={ids}
      label={label}
      hint={hint}
      error={shownError}
      required={required}
      requiredLabel={requiredLabel}
      disabled={disabled}
      group
      describedBy={describedBy}
      className={cx('odc-image-field', className)}
      data-has-image={hasValue ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      {...dropProps}
      {...props}
    >
      <div className='odc-image-field-body'>
        <div
          className='odc-image-field-preview'
          data-ratio={ratio ? '' : undefined}
          style={ratio ? { '--odc-image-ratio': ratio } : undefined}
        >
          {hasValue && !broken
            ? <img className='odc-image-field-img' src={value} alt={previewAlt} onError={() => setFailedValue(value)} />
            : <Image className='odc-icon odc-image-field-empty' aria-hidden='true' data-broken={broken ? '' : undefined} />}
        </div>
        <div className='odc-image-field-actions'>
          <Button
            ref={changeRef}
            icon={Image}
            disabled={disabled}
            aria-label={changeLabel}
            aria-describedby={describedBy}
            onClick={() => fileRef.current?.click()}
          >
            {changeText ?? changeLabel}
          </Button>
          {hasValue && onRemove && (
            <Button
              variant='ghost'
              icon={Trash2}
              disabled={disabled}
              aria-label={removeLabel}
              onClick={() => onRemove()}
            >
              {removeText ?? removeLabel}
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type='file'
          accept={accept}
          hidden
          tabIndex={-1}
          aria-hidden='true'
          disabled={disabled}
          onChange={pick}
        />
      </div>
      {crop && (
        <Dialog
          open={cropState.open}
          onOpenChange={closeCrop}
          title={cropTitle}
          closeLabel={closeLabel}
          size='lg'
          returnFocus={changeRef}
        >
          {cropState.photo && (
            <ImageCrop
              photo={cropState.photo}
              handleChangePhoto={onChange ?? noop}
              onClose={closeCrop}
              aspectRatio={aspectRatio}
              showAspectRatioBox={showAspectRatioBox}
              useCloudinaryUrl={useCloudinaryUrl}
              themeId={themeId}
              {...(resolveThemeId ? { resolveThemeId } : {})}
            />
          )}
        </Dialog>
      )}
    </LegacyFieldFrame>
  )
})
