import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useLanguage } from '../../../../../../index'
import { bytesConverter } from '../../../../utils'
import { Checkbox, Field, TextField, useFieldFrame } from '../../../Shared/Product'
import { ColorField } from '../../../Shared/Product/ColorField'
import { ImageField } from '../../../Shared/Product/ImageField'
import { FirstSelect } from '../../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'
import { useLabelFocusesTrigger } from '../../../Settings/SettingsHubForm/useLabelFocusesTrigger'
import { ImageFormatContext } from '../../AdvancedSettings/ImageBox'
import { DEFAULT_SETTING_COLOR } from '../../AdvancedSettings/themeDefaults'

// redesign ordering-website B4 (D3): the controls of Advanced, in Product (P/) dress. The behaviour is that of
// MyProducts/AdvancedSettings (SettingComponent, HideCheckBox, ImageBox): the same lists, the same paths, the same values written. What
// changes is how they look and how they are named: a checkbox per `.hidden` setting that is checked when the item is SHOWN, a select
// with a visible label, a color and a text field with theirs, and images with the error in their field.

// The images of a website take JPG and WEBP only (AdvancedSettings/index.js:46-48 gives that to every ImageBox through its context);
// ImageBox's own defaults do the rest: up to 3072 KB, no required dimensions, cropped before it is kept.
export const WEBSITE_IMAGE_FORMAT = { extensionFile: 'jpg, webp', mimeTypeAccept: 'image/jpeg, image/jpg, image/webp' }
const IMAGE_MAX_SIZE_KB = 3072

// What SettingComponent shows in a color picker whose setting has no value yet (the stored theme value's default, not a style).
const DEFAULT_COLOR_VALUE = DEFAULT_SETTING_COLOR

// The select is the Product anatomy (C18, docs/REDESIGN_PLAYBOOK.md §3): the trigger as wide as the field, brand rows.
const FIT_TRIGGER = { fitTrigger: true }

const HIDDEN_SUFFIX = '.hidden'

/** The value at the dotted `path` of `object` (`undefined` when any step is missing), as `deepFind` of SettingComponent. */
export const getAt = (object, path) => {
  let node = object
  for (const key of String(path).split('.')) {
    if (node !== null && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, key)) node = node[key]
    else return undefined
  }
  return node
}

// Sets `value` at the dotted `path`, in place, creating the objects the path needs (`updateObject` of AdvancedSettings/index.js:85-96).
const setAt = (object, value, path) => {
  const stack = path.split('.')
  let node = object
  while (stack.length > 1) {
    const key = stack.shift()
    if (!node[key] || typeof node[key] !== 'object') node[key] = {}
    node = node[key]
  }
  node[stack.shift()] = value
}

/**
 * `updateThemeValue(value, path)`: what `handleUpdateThemeValue` of AdvancedSettings/index.js:98-103 does. It clones the latest draft,
 * writes the value at the path (creating what is missing) and gives the copy to `setAdvancedValues`. The latest draft is kept in a ref,
 * so two writes before the next render (a color that settles after a keystroke) do not start from the same old copy.
 */
export const useUpdateAdvancedValue = (advancedValues, setAdvancedValues) => {
  const latest = useRef(advancedValues)
  useEffect(() => { latest.current = advancedValues }, [advancedValues])
  return useCallback((value, path) => {
    if (!path) return
    const next = JSON.parse(JSON.stringify(latest.current ?? {}))
    setAt(next, value, path)
    latest.current = next
    setAdvancedValues(next)
  }, [setAdvancedValues])
}

const normalizeExtension = (extension) => (extension === 'jpeg' ? 'jpg' : extension)

/**
 * The error ImageBox gives a file for a website, or `null` when it takes it: the extension first (JPG and WEBP, `.jpeg` is JPG), then
 * the type (an image) and the size (3 MB), as `handleFiles` of AdvancedSettings/ImageBox.js:63-111 does, with the same texts. `format`
 * is the `{ extensionFile }` of ImageBox (an app's is ImageBox's own).
 */
export const getImageError = (file, t, format = WEBSITE_IMAGE_FORMAT) => {
  const { extensionFile } = format
  const extension = normalizeExtension(file.name?.split('.').pop()?.toLowerCase())
  const allowed = extensionFile.toLowerCase().split(',').map(item => normalizeExtension(item.trim()))
  if (extension && !allowed.includes(extension)) {
    return t('ERROR_IMAGE_EXTENSION', 'Invalid file type. Allowed format is :ext:').replace(':ext:', extensionFile.toUpperCase())
  }
  if (String(file.type).split('/')[0] !== 'image') return t('ERROR_ONLY_IMAGES', 'Only images can be accepted')
  if (bytesConverter(file.size) > IMAGE_MAX_SIZE_KB) {
    const sizeLabel = IMAGE_MAX_SIZE_KB >= 1024 ? `${IMAGE_MAX_SIZE_KB / 1024} MB` : `${IMAGE_MAX_SIZE_KB} KB`
    return t('ERROR_IMAGE_MAXIMUM_SIZE', 'The maximum image size is :size:').replace(':size:', sizeLabel)
  }
  return null
}

/**
 * An image of Advanced: P/ImageField with the rules of ImageBox for a website (or for an app: the format comes from ImageFormatContext,
 * as ImageBox's does). The error of a rejected file shows in the field (it was
 * an Alert titled «Ordering» in the legacy page) and goes away with the next valid file; a valid one is cropped and `onChange(image,
 * path)` gets what the crop gives (Cloudinary URL of the theme `themeId`).
 */
export const AdvancedImageField = ({ title, ratio, path, photo, themeId, onChange }) => {
  const [, t] = useLanguage()
  const [error, setError] = useState(null)
  const format = useContext(ImageFormatContext) ?? WEBSITE_IMAGE_FORMAT

  const validateFile = (file) => {
    const message = getImageError(file, t, format)
    setError(message)
    return !message
  }

  return (
    <ImageField
      label={title}
      hint={`${ratio} · ${t('FORMAT', 'Format')}: ${format.extensionFile.toUpperCase()}`}
      error={error}
      value={photo}
      changeLabel={t('CATALOG_CHANGE_IMAGE_OF', 'Change image of _name_').replace('_name_', title)}
      changeText={t('CHANGE', 'Change')}
      accept={format.mimeTypeAccept}
      validateFile={validateFile}
      // redesign ordering-website integration: ImageBox took dropped files (DragAndDrop), so these do too
      droppable
      tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
      cropTitle={t('IMAGE_CROP', 'Image crop')}
      closeLabel={t('CLOSE', 'Close')}
      useCloudinaryUrl
      themeId={themeId}
      onChange={(image) => onChange(image, path)}
    />
  )
}

/** A native-looking dropdown tied to the label of its Field (the C18 trigger names itself «label + value»). */
const FramedSelect = ({ label, options, value, onChange }) => {
  const [, t] = useLanguage()
  const frame = useFieldFrame()
  const rootRef = useRef(null)
  useLabelFocusesTrigger(rootRef, frame?.labelId)
  return (
    <div ref={rootRef}>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={frame?.labelId || undefined}
          ariaLabel={label}
          options={options}
          defaultValue={value}
          onChange={onChange}
          placeholder={t('SELECT_OPTION', 'Select an option')}
        />
      </SelectSurfaceContext.Provider>
    </div>
  )
}

const PositionSetting = ({ setting, value, themesList, onChange }) => {
  const [, t] = useLanguage()
  // The options come from the theme's structure, at `<path>.options` (SettingComponent.js:31-36); a theme without them leaves the list empty.
  const options = useMemo(() => {
    const found = getAt(themesList?.themes?.[0]?.structure, `${setting.path}.options`)
    return Array.isArray(found)
      ? found.map(option => ({ value: option, content: t(option.toString().toUpperCase(), option) }))
      : []
  }, [themesList, setting.path, t])
  return (
    <Field label={setting.name}>
      <FramedSelect label={setting.name} options={options} value={value} onChange={(next) => onChange(next, setting.path)} />
    </Field>
  )
}

// A `.hidden` path says the item is hidden, so the checkbox says the opposite: checked = it is shown on the website (D3). The other
// paths (`tracking_settings.tracking_only`, `homepage_image_fullscreen`) are plain flags and are written as they are.
const CheckSetting = ({ setting, value, fallbackName, onChange }) => {
  const inverted = setting.path.endsWith(HIDDEN_SUFFIX)
  return (
    <Checkbox
      checked={inverted ? !value : !!value}
      onCheckedChange={(next) => onChange(inverted ? !next : next, setting.path)}
    >
      {setting.name || fallbackName}
    </Checkbox>
  )
}

/**
 * A list of `AdvancedSettingsUtilities` (`{ name, type, path, disabled }`), painted with the controls of P/ and read from / written to
 * `advancedValues` through `updateThemeValue(value, path)`. The `disabled` ones are skipped. A list with checkboxes of `.hidden`
 * paths says above them what a check means (`shownHint`, for an app; a website's by default). `fallbackName` names the checkbox whose
 * setting has no name (the first one of «Business listing»).
 */
export const ProductSettingList = ({ list, advancedValues, themesList, updateThemeValue, fallbackName, shownHint }) => {
  const [, t] = useLanguage()
  const settings = list.filter(setting => !setting.disabled)
  const hasShownChecks = settings.some(setting => setting.type === 'hidden' && setting.path.endsWith(HIDDEN_SUFFIX))

  return (
    <>
      {hasShownChecks && (
        <p className='odc-ows-hint'>{shownHint ?? t('ADVANCED_SHOWN_HINT', 'Checked items are shown on your website.')}</p>
      )}
      {settings.map((setting) => {
        const value = getAt(advancedValues, setting.path)
        if (setting.type === 'hidden') {
          return <CheckSetting key={setting.path} setting={setting} value={value} fallbackName={fallbackName} onChange={updateThemeValue} />
        }
        if (setting.type === 'position') {
          return <PositionSetting key={setting.path} setting={setting} value={value} themesList={themesList} onChange={updateThemeValue} />
        }
        if (setting.type === 'color') {
          return (
            <ColorField
              key={setting.path}
              label={setting.name}
              value={value || DEFAULT_COLOR_VALUE}
              onChange={(color) => updateThemeValue(color, setting.path)}
            />
          )
        }
        if (setting.type === 'input') {
          return (
            <TextField
              key={setting.path}
              label={setting.name}
              value={value ?? ''}
              onChange={(next) => updateThemeValue(next, setting.path)}
            />
          )
        }
        if (setting.type === 'image') {
          return (
            <AdvancedImageField
              key={setting.path}
              title={setting.name}
              ratio='900 x 200 px'
              path={setting.path}
              photo={value}
              themeId={themesList?.themes?.[0]?.id}
              onChange={updateThemeValue}
            />
          )
        }
        return null
      })}
    </>
  )
}
