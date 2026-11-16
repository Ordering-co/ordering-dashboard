import React, { useState } from 'react'

import { useLanguage } from '../../../../../../index'
import { bytesConverter } from '../../../../utils'
import { Checkbox } from '../../../Shared/Product'
import { ImageField } from '../../../Shared/Product/ImageField'
import { setThemePath } from './themeDraft'

// redesign ordering-website B3b (D5): Website › Images. The six pictures of the website (up to five for a franchise) as
// Product image fields, and the «Homepage image fullscreen» choice. The same pictures, rules and writes as the legacy editor
// (OW: 668-928): a JPG or WEBP up to 3 MB, cropped before it is kept. The site's logo and image go to the controller's
// `handleChangeInput` (with their mirror in the theme, as `handleChangeSiteSettings` did); the others to `images.*` of the theme draft.
// What the legacy editor said in an Alert is said in the field now, and a new valid pick clears it.

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE_KB = 3072

export const ImagesSection = (props) => {
  const {
    orderingTheme,
    themesList,
    ensureSite,
    themeValues,
    setThemeValues,
    site,
    handleChangeInput,
    isDashboard,
    isFranchise
  } = props

  const [, t] = useLanguage()
  const [errors, setErrors] = useState({})

  const images = themeValues?.images?.components

  // The site's own fields (logo, image): the theme keeps a mirror (not in the dashboard) and the controller keeps the draft.
  const writeSiteField = (name, value) => {
    if (!isDashboard) setThemeValues(setThemePath(themeValues, 'website_settings', `values.${name}`, value))
    handleChangeInput({ target: { name, value } })
  }

  const writeImage = (path, value) => setThemeValues(setThemePath(themeValues, 'images', path, value))

  const validateImage = (name) => (file) => {
    let message = null
    if (!ALLOWED_TYPES.includes(file?.type)) {
      message = t('ERROR_ONLY_JPG_WEBP_IMAGES', 'Only JPG and WEBP images can be accepted')
    } else if (bytesConverter(file.size) > MAX_SIZE_KB) {
      const sizeLabel = MAX_SIZE_KB >= 1024 ? `${MAX_SIZE_KB / 1024} MB` : `${MAX_SIZE_KB} KB`
      message = t('ERROR_IMAGE_MAXIMUM_SIZE', 'The maximum image size is :size:').replace(':size:', sizeLabel)
    }
    setErrors((current) => ({ ...current, [name]: message }))
    return message == null
  }

  const hintOf = (size) => (
    <>
      <span className='odc-figure'>{size}</span> · {t('FORMAT', 'Format')}: JPG, WEBP
    </>
  )

  const fields = [
    {
      name: 'logo',
      label: t('SITE_LOGO', 'Site logo'),
      size: '512 × 512 px',
      value: site?.logo,
      aspectRatio: 1,
      onChange: (image) => writeSiteField('logo', image)
    },
    {
      name: 'header',
      label: t('HEADER_LOGO', 'Header logo'),
      size: '900 × 200 px',
      value: images?.logo?.components?.image,
      onChange: (image) => writeImage('logo.components.image', image)
    },
    {
      name: 'logo_mobile',
      label: t('HEADER_MOBILE_LOGO', 'Header mobile logo'),
      size: '512 × 512 px',
      value: images?.logo_mobile?.components?.image,
      aspectRatio: 1,
      onChange: (image) => writeImage('logo_mobile.components.image', image)
    },
    !isFranchise && {
      name: 'image',
      label: t('SITE_IMAGE', 'Site image'),
      size: '1920 × 1280 px',
      value: site?.image,
      onChange: (image) => writeSiteField('image', image)
    },
    {
      name: 'homepage_background',
      label: t('HOMEPAGE_BACKGROUND', 'Homepage background'),
      size: '1920 × 1280 px',
      value: images?.homepage_background?.components?.image,
      onChange: (image) => writeImage('homepage_background.components.image', image)
    },
    {
      name: 'homepage_mobile_background',
      label: t('HOMEPAGE_MOBILE_BACKGROUND', 'Homepage mobile background'),
      size: '1440 × 770 px',
      value: images?.homepage_mobile_background?.components?.image,
      onChange: (image) => writeImage('homepage_mobile_background.components.image', image)
    }
  ].filter(Boolean)

  const cropTitle = t('IMAGE_CROP', 'Image crop')
  const closeLabel = t('CLOSE', 'Close')
  const changeText = t('CHANGE', 'Change')
  const tooManyFilesText = t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')
  const changeLabelOf = (label) => t('CATALOG_CHANGE_IMAGE_OF', 'Change image of _name_').replace('_name_', label)
  const themeId = orderingTheme?.themes?.[0]?.theme_id
  // a site still to be created (/my-products/ordering-website-2) has no theme assigned, so the gallery would be skipped and
  // the picture kept whole as a `data:` URI. The upload creates the site first (the user is already writing to the gallery) and goes to
  // the default theme, as AdvancedImageField does. Without `ensureSite` (the other routes) nothing changes.
  const defaultThemeId = themesList?.themes?.[0]?.id
  const canResolveTheme = !themeId && !!ensureSite && defaultThemeId != null
  const resolveThemeIdOf = (name) => async () => {
    try {
      await ensureSite()
      return defaultThemeId
    } catch (result) {
      const message = [result instanceof Error ? result.message : result].flat().find((item) => typeof item === 'string')
      setErrors((current) => ({ ...current, [name]: message || t('ERROR_UNKNOWN', 'An error has occurred') }))
      return null
    }
  }

  return (
    <div className='odc-ows-form odc-ows-form-wide'>
      <div className='odc-ows-images'>
        {fields.map((field) => (
          <ImageField
            key={field.name}
            label={field.label}
            hint={hintOf(field.size)}
            error={errors[field.name]}
            value={field.value}
            previewAlt={field.label}
            changeLabel={changeLabelOf(field.label)}
            changeText={changeText}
            accept='image/jpeg, image/jpg, image/webp'
            validateFile={validateImage(field.name)}
            useCloudinaryUrl
            themeId={themeId}
            resolveThemeId={canResolveTheme ? resolveThemeIdOf(field.name) : undefined}
            aspectRatio={field.aspectRatio}
            droppable
            tooManyFilesText={tooManyFilesText}
            cropTitle={cropTitle}
            closeLabel={closeLabel}
            onChange={field.onChange}
          />
        ))}
      </div>
      <Checkbox
        checked={!!images?.homepage_image_fullscreen}
        onCheckedChange={(checked) => writeImage('homepage_image_fullscreen', checked)}
      >
        {t('HOMEPAGE_IMAGE_FULLSCREEN', 'Homepage image fullscreen')}
      </Checkbox>
    </div>
  )
}
