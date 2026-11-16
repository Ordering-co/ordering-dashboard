import React, { useId, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { ImageBox } from '../AdvancedSettings/ImageBox'
import './app-builds.css'

// redesign my-products B4 (D3/D6): Look › Images and Icons and splash. What main's Images tab painted, in the
// grid of Product: the general images of the app (`ImagesSection`) and the four groups of resources (`ResourcesSection`: icons,
// notifications, Android splash, iOS splash), each image in the same `ImageBox` with the same props, saved at once as main does
// (`source_file` in a FormData to `updateBaseActions`, `CORRECTLY_SAVED_IMAGE`). The error of the API goes through
// `translateApiMessage` (main built the key from the text, so a message with punctuation never reached its translation). The editor
// paints the section's h2; the resources have an h3 per group, and a group with nothing in it is not painted.

// The franchise app does not edit these pictures (as in main)
const FRANCHISE_HIDDEN = [
  'empty-active-orders.png',
  'not-found.png',
  'empty-past-orders.png',
  'business_list_banner.jpg',
  'curbside.png',
  'delivery.png',
  'drivethru.png',
  'pickup.png',
  'eatin.png',
  'category-all.png'
]

const applyImagesFilter = (app) => (image) => {
  if (app?.base?.code === 'app_franchises_x') {
    return !FRANCHISE_HIDDEN.some((filePath) => image?.target_path?.includes(filePath))
  }
  return true
}

const imagesOf = (app, belongs) => (app?.baseActions ?? []).filter(belongs).filter(applyImagesFilter(app))

// The save of a picture and the error it leaves. `failed` sends every box back to its saved picture (`isResetImg`), until a box is touched.
const useImageSaving = (updateBaseActions) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [failed, setFailed] = useState(false)

  const fail = (message) => {
    setFailed(true)
    const unknown = t('ERROR_UNKNOWN', 'An error has occurred')
    showToast(ToastType.Error, typeof message === 'string' ? translateApiMessage(t, message, unknown) : unknown)
  }

  const save = async ({ id, img }) => {
    setFailed(false)
    try {
      const body = new FormData()
      body.append('source_file', img)
      const { error, result } = await updateBaseActions({ id, body })
      if (error) {
        fail(Array.isArray(result) ? result[0] : result)
        return
      }
      showToast(ToastType.Success, t('CORRECTLY_SAVED_IMAGE', 'Correctly saved image'))
    } catch (err) {
      fail(err?.message ?? err)
    }
  }

  return { failed, save, clearError: () => setFailed(false) }
}

const ImageGrid = ({ images, saving }) => (
  <div className='odc-api-grid'>
    {images.map((image) => (
      <ImageBox
        key={image.id}
        id={image.id}
        useAlertToast
        disableCrop
        editable={image.editable}
        title={image.name}
        ratio={`${image?.file_rules?.width} x ${image?.file_rules?.height} px`}
        photo={image?.public_url}
        path={image?.target_path}
        requireDimentions={image?.file_rules && { width: image?.file_rules?.width, height: image?.file_rules?.height }}
        isResetImg={saving.failed}
        fileSize={Math.max(image?.file_rules?.max_size || 0, 3072)}
        extensionFile={image?.file_rules?.extension}
        mimeTypeAccept={image?.file_rules?.mimetype}
        handleClick={saving.clearError}
        handleChangePhoto={(img) => saving.save({ id: image.id, img })}
      />
    ))}
  </div>
)

export const ImagesSection = (props) => {
  const { app, updateBaseActions } = props
  const saving = useImageSaving(updateBaseActions)

  const images = imagesOf(app, (image) => image?.group === 'general_images')
  if (!images.length) return null

  return (
    <div className='odc-api'>
      <ImageGrid images={images} saving={saving} />
    </div>
  )
}

export const ResourcesSection = (props) => {
  const { app, updateBaseActions } = props

  const [, t] = useLanguage()
  const ids = useId()
  const saving = useImageSaving(updateBaseActions)

  const groups = [
    { key: 'icons', title: t('RESOURCES_ICONS', 'Icons'), images: imagesOf(app, (image) => image?.group === 'resources_icons') },
    { key: 'notifications', title: t('RESOURCES_NOTIFICATIONS', 'Notifications'), images: imagesOf(app, (image) => image?.group === 'resources_notifications') },
    { key: 'android', title: t('RESOURCES_ANDROID_SPLASH', 'Android Splash'), images: imagesOf(app, (image) => ['splash', 'android'].every((word) => image?.group?.includes(word))) },
    { key: 'ios', title: t('RESOURCES_ICONS_IOS_SPLASH', 'iOS Splash'), images: imagesOf(app, (image) => ['splash', 'ios'].every((word) => image?.group?.includes(word))) }
  ].filter((group) => group.images.length)
  if (!groups.length) return null

  return (
    <div className='odc-api'>
      {groups.map((group) => (
        <section key={group.key} className='odc-api-group' aria-labelledby={`${ids}-${group.key}`}>
          <h3 id={`${ids}-${group.key}`} className='odc-api-title'>{group.title}</h3>
          <ImageGrid images={group.images} saving={saving} />
        </section>
      ))}
    </div>
  )
}
