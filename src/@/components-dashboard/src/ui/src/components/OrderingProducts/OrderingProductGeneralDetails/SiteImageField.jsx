import React, { useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { bytesConverter } from '../../../utils/bytesConverter'
import { CircleAlert, Image } from '../../Shared/Icon'
import { Button } from '../../Shared/Product'
import './ordering-product-general.css'

// redesign (lot C, decision 6, OP-06, OP-10): one image of a site (Header, Logo, Social share), in place of main's
// ExamineClick + DragAndDrop zones. The zone shows the image; a real button opens the file chooser and a file can also be dropped on
// the zone. Same checks as main (one file, an image, 2 MB at most) and no crop; the reason is said under the zone, not in an Alert.
// The preview is decorative (`alt=''`): the name of the control is the button's («Choose image» + the label).

const ACCEPT = 'image/png, image/jpeg, image/jpg'
const MAX_KILOBYTES = 2048

/**
 * @param {object}   props
 * @param {string}   props.label     «Header», «Logo», «Social share». Names the group and the button.
 * @param {string}   [props.hint]    A line under the zone.
 * @param {string}   [props.value]   The image shown: a URL or a data URL.
 * @param {Function} props.onFile    `(file)`: a file that passed the checks.
 * @param {boolean}  [props.disabled]
 * @param {'wide'|'square'} [props.aspect] `'wide'` for the header.
 */
export const SiteImageField = ({ label, hint, value, onFile, disabled = false, aspect = 'square' }) => {
  const [, t] = useLanguage()
  const base = useId()
  const ids = { label: `${base}-label`, hint: `${base}-hint`, error: `${base}-error` }
  const inputRef = useRef(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  // redesign (OP-06): the checks of main (OrderingProductGeneralDetails.handleFiles), said under the zone
  const take = (files) => {
    if (files.length !== 1) return // one file at a time, as in main
    const file = files[0]
    if (String(file.type).split('/')[0] !== 'image') {
      setError(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return
    }
    if (bytesConverter(file.size) > MAX_KILOBYTES) {
      setError(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return
    }
    setError(null)
    onFile?.(file)
  }

  const pick = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = '' // the same file can be chosen again
    take(files)
  }

  const dropProps = disabled
    ? {}
    : {
        onDragOver: (event) => {
          event.preventDefault()
          setDragging(true)
        },
        onDragLeave: () => setDragging(false),
        onDrop: (event) => {
          event.preventDefault()
          setDragging(false)
          take(Array.from(event.dataTransfer?.files || []))
        }
      }

  const hasHint = hint != null && hint !== ''
  const hasValue = value != null && value !== ''
  const describedBy = [hasHint ? ids.hint : null, error ? ids.error : null].filter(Boolean).join(' ') || undefined

  return (
    <div
      className='odc-root odc-op-image'
      role='group'
      aria-labelledby={ids.label}
      aria-describedby={describedBy}
      data-aspect={aspect === 'wide' ? 'wide' : 'square'}
      data-invalid={error ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
    >
      <span id={ids.label} className='odc-op-image-label'>{label}</span>
      <div className='odc-op-image-zone' data-dragging={dragging ? '' : undefined} {...dropProps}>
        <div className='odc-op-image-preview'>
          {hasValue
            ? <img className='odc-op-image-img' src={value} alt='' loading='lazy' />
            : <Image className='odc-icon odc-op-image-empty' aria-hidden='true' />}
        </div>
        <Button icon={Image} disabled={disabled} onClick={() => inputRef.current?.click()}>
          {t('CHOOSE_IMAGE', 'Choose image')}{' '}
          <span className='odc-sr-only'>{label}</span>
        </Button>
      </div>
      {hasHint && <p id={ids.hint} className='odc-op-image-hint'>{hint}</p>}
      {error && (
        <p id={ids.error} className='odc-op-image-error' role='alert'>
          <CircleAlert className='odc-icon' aria-hidden='true' />
          <span>{error}</span>
        </p>
      )}
      <input
        ref={inputRef}
        type='file'
        accept={ACCEPT}
        hidden
        tabIndex={-1}
        aria-hidden='true'
        disabled={disabled}
        onChange={pick}
      />
    </div>
  )
}
