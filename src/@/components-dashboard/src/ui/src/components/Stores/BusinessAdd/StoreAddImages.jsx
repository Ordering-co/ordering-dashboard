import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { bytesConverter, getUniqueId } from '../../../utils'
import { Image as ImageIcon, Trash2, Upload } from '../../Shared/Icon'
import { Button, IconButton, InlineNotice } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import './store-add-images.css'

// redesign stores · (lote 2.3-C): the «Images» group of the add-a-store page on Product. Same three things as main's cards
// (BusinessAdd/Images and BusinessAdd/Photos), same rules, same values:
//  - Logo and homepage background: a cropped image kept as a data URL in `changes.logo` / `changes.header` (P/ImageField, which crops with
//    ImageCrop). Only images, 2048 KB at most; the file is checked before the crop, as main did.
//  - Photos: several at once (a hidden `multiple` input behind a real «Add photos» button, or a drop on the zone), each one read to a data
//    URL and kept as { temp_id, file } in the page's local gallery (the controller uploads them after the store exists). No crop per photo,
//    as the editor's gallery (5.3). What is not an image, or is over 2048 KB, is left out and named in ONE notice; the rest still joins.
//    A photo that comes from Google is an https URL in `file`: it is drawn as it is.
// Nothing here talks to the API: the page owns `form` and `gallery`.
//
// Removing the logo or the background sends `undefined`, not '': main's `handleChangeSwtich` only ever put a cropped data URL there, and
// the request (`ordering.businesses().save(changes)`) never carried an empty logo/header, so the key is left present-but-undefined and
// JSON drops it, as if nothing had been picked.

const MAX_IMAGE_KB = 2048
const ACCEPT = 'image/png, image/jpeg, image/jpg'

const withCount = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

const readAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new window.FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export const StoreAddImages = ({ form, changeFields, gallery = [], onGalleryChange, disabled = false }) => {
  const [, t] = useLanguage()
  const id = useId()

  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const mounted = useRef(true)
  const galleryRef = useRef(gallery)
  galleryRef.current = gallery
  useEffect(() => () => { mounted.current = false }, [])

  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [failures, setFailures] = useState([])
  const [imageErrors, setImageErrors] = useState({})

  const busy = disabled || reading

  const reasonFor = (file) => {
    if (file?.type?.split('/')[0] !== 'image') return t('ERROR_ONLY_IMAGES', 'Only images can be accepted')
    if (bytesConverter(file?.size) > MAX_IMAGE_KB) return t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')
    return null
  }

  // ---- logo and homepage background ---------------------------------------------------------------------------------------------
  const validateImage = name => (file) => {
    const message = reasonFor(file)
    setImageErrors(current => ({ ...current, [name]: message }))
    return message == null
  }

  // review 8: an empty image offers «Upload», a set one «Change»
  const imageField = ({ name, label, hint, aspectRatio, changeLabel, uploadLabel, removeLabel }) => (
    <ImageField
      label={label}
      hint={hint}
      error={imageErrors[name]}
      disabled={disabled}
      value={form?.[name]}
      previewAlt={label}
      changeLabel={form?.[name] ? changeLabel : uploadLabel}
      changeText={form?.[name] ? t('CHANGE', 'Change') : t('UPLOAD', 'Upload')}
      removeLabel={removeLabel}
      validateFile={validateImage(name)}
      aspectRatio={aspectRatio}
      cropTitle={t('IMAGE_CROP', 'Image crop')}
      closeLabel={t('CLOSE', 'Close')}
      droppable
      tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
      onChange={image => changeFields({ [name]: image })}
      onRemove={() => {
        setImageErrors(current => ({ ...current, [name]: null }))
        changeFields({ [name]: undefined })
      }}
    />
  )

  // ---- photos --------------------------------------------------------------------------------------------------------------------
  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0 || busy) return
    setFailures([])
    setReading(true)
    const results = await Promise.all(files.map(async (file) => {
      const reason = reasonFor(file)
      if (reason) return { name: file?.name || '', reason }
      try {
        return { photo: { temp_id: getUniqueId(), file: await readAsDataUrl(file) } }
      } catch {
        return { name: file?.name || '', reason: t('GALLERY_IMAGE_READ_FAILED', 'The file could not be read.') }
      }
    }))
    if (!mounted.current) return
    setReading(false)
    const added = results.filter(result => result.photo).map(result => result.photo)
    setFailures(results.filter(result => !result.photo))
    // the gallery as it is NOW: a photo removed while these were being read stays removed
    if (added.length > 0) onGalleryChange([...galleryRef.current, ...added])
  }

  const openPicker = () => {
    if (!busy) inputRef.current?.click()
  }

  const handlePicked = (event) => {
    const files = Array.from(event.target.files || [])
    // the same files can be picked again after a failure
    event.target.value = ''
    addPhotos(files)
  }

  const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files')
  const handleDragEnter = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.current += 1
    if (!busy) setDragging(true)
  }
  const handleDragOver = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy'
  }
  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const handleDrop = (event) => {
    event.preventDefault() // the browser never opens a dropped file instead
    dragDepth.current = 0
    setDragging(false)
    if (!busy) addPhotos(event.dataTransfer?.files)
  }

  const removePhoto = (tempId) => {
    setFailures([])
    onGalleryChange(galleryRef.current.filter(item => item.temp_id !== tempId))
  }

  const failedText = failures.length > 0
    ? withCount(failures.length === 1
      ? t('GALLERY_IMAGES_FAILED_ONE', '_count_ image could not be added:')
      : t('GALLERY_IMAGES_FAILED_OTHER', '_count_ images could not be added:'), { count: failures.length })
    : null

  const photoAlt = index => withCount(t('STORE_ADD_PHOTO_ALT', 'Store photo _number_'), { number: index + 1 })
  const photoRemove = index => withCount(t('STORE_ADD_REMOVE_PHOTO', 'Remove photo _number_'), { number: index + 1 })

  return (
    <section className='odc-sadd-group' aria-labelledby={`${id}-title`}>
      <h2 className='odc-sadd-group-title' id={`${id}-title`}>
        {t('IMAGES', 'Images')}{' '}
        <span className='odc-sadd-group-optional'>{t('OPTIONAL', 'Optional')}</span>
      </h2>

      <div className='odc-sadd-img'>
        <div className='odc-sadd-img-pair'>
          {imageField({
            name: 'logo',
            label: t('BUSINESS_LOGO', 'Business logo'),
            hint: t('STORE_ADD_LOGO_HINT', '512 × 512 px · PNG, JPG'),
            aspectRatio: 1,
            changeLabel: t('STORE_CHANGE_LOGO', 'Change logo'),
            uploadLabel: t('STORE_ADD_UPLOAD_LOGO', 'Upload logo'),
            removeLabel: t('STORE_ADD_REMOVE_LOGO', 'Remove logo')
          })}
          {imageField({
            name: 'header',
            label: t('HOMEPAGE_BACKGROUND', 'Homepage background'),
            hint: t('STORE_ADD_BACKGROUND_HINT', '1350 × 400 px · PNG, JPG'),
            aspectRatio: 1350 / 400,
            changeLabel: t('STORE_ADD_CHANGE_BACKGROUND', 'Change homepage background'),
            uploadLabel: t('STORE_ADD_UPLOAD_BACKGROUND', 'Upload homepage background'),
            removeLabel: t('STORE_ADD_REMOVE_BACKGROUND', 'Remove homepage background')
          })}
        </div>

        <div className='odc-sadd-img-photos' role='group' aria-labelledby={`${id}-photos`}>
          <h3 className='odc-sadd-img-subtitle' id={`${id}-photos`}>{t('PHOTOS', 'Photos')}</h3>
          <div
            className='odc-sadd-img-drop'
            data-dragging={dragging || undefined}
            data-busy={busy || undefined}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <ImageIcon aria-hidden='true' className='odc-sadd-img-drop-icon' />
            <p className='odc-sadd-img-drop-title'>{t('DRAG_AND_DROP', 'Drag and drop')}</p>
            <p className='odc-sadd-img-drop-hint' id={`${id}-hint`}>
              {t('GALLERY_IMAGES_HINT', 'PNG or JPG, up to 2 MB each. You can add several at once.')}
            </p>
            <Button
              variant='secondary'
              icon={Upload}
              onClick={openPicker}
              disabled={busy}
              aria-describedby={`${id}-hint`}
            >
              {t('STORE_ADD_ADD_PHOTOS', 'Add photos')}
            </Button>
            <input
              ref={inputRef}
              type='file'
              accept={ACCEPT}
              multiple
              hidden
              tabIndex={-1}
              aria-hidden='true'
              disabled={disabled}
              onChange={handlePicked}
              data-testid='store-add-photos-input'
            />
          </div>

          {failedText && (
            <InlineNotice tone='danger'>
              <span>{failedText}</span>
              <ul className='odc-sadd-img-failures'>
                {failures.map((failure, index) => (
                  <li key={`${failure.name}-${index}`}>
                    {failure.name ? <bdi className='odc-sadd-img-file'>{failure.name}</bdi> : null}
                    {failure.name ? ': ' : ''}
                    {failure.reason}
                  </li>
                ))}
              </ul>
            </InlineNotice>
          )}

          {gallery.length > 0 && (
            <ul className='odc-sadd-img-grid' aria-label={t('PHOTOS', 'Photos')}>
              {gallery.map((photo, index) => (
                <li key={photo.temp_id} className='odc-sadd-img-item'>
                  <img src={photo.file} alt={photoAlt(index)} loading='lazy' />
                  <IconButton
                    className='odc-sadd-img-remove'
                    icon={Trash2}
                    label={photoRemove(index)}
                    variant='secondary'
                    size='sm'
                    disabled={disabled}
                    onClick={() => removePhoto(photo.temp_id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
