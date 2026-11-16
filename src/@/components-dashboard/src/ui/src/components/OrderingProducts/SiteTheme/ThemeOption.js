import React, { useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Checkbox, Field, TextField, useFieldFrame } from '../../Shared/Product'
import { ColorField } from '../../Shared/Product/ColorField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { useLabelFocusesTrigger } from '../../Settings/SettingsHubForm/useLabelFocusesTrigger'
import { ThemeImage } from './ThemeImage'
import { filterBorderRadius, getTitle, validHexColor } from './themeValues'
import { THEME_TITLES } from './themeTitles'
import './site-theme.css'

// redesign (lot D, decision 7): one option of a block on Product controls, all controlled by the current value. The value
// is written through `onChange(path, value)` (the tab keeps the values and writes a copy), never into the object it reads.

// The select is the Product anatomy (C18): trigger as wide as the field, brand rows.
const FIT_TRIGGER = { fitTrigger: true }

// redesign the tab lives in `.odc-record-body` (overflow-y: auto). A list drawn in place opened upwards and was clipped by
// that body (one option of 26 visible, no click reached it), so every select of the tab is `portal`: the list is drawn in the shared
// layer host, above the panel, and keeps its own scroll.
/** The C18 trigger names itself «label + value» through the frame of its Field; a click on the label focuses it. */
const FramedSelect = ({ label, placeholder, options, value, onChange }) => {
  const frame = useFieldFrame()
  const rootRef = useRef(null)
  useLabelFocusesTrigger(rootRef, frame?.labelId)
  return (
    <span ref={rootRef} className='odc-op-theme-select'>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={frame?.labelId || undefined}
          ariaLabel={label}
          options={options}
          defaultValue={value}
          onChange={onChange}
          placeholder={placeholder}
          portal
        />
      </SelectSurfaceContext.Provider>
    </span>
  )
}

/** A labelled select (Field + C18). `options` is `[{ value, content }]`. */
export const ThemeSelect = ({ label, placeholder, options, value, onChange }) => (
  <Field label={label}>
    <FramedSelect label={label} placeholder={placeholder} options={options} value={value} onChange={onChange} />
  </Field>
)

/**
 * `[{ value, content }]` of the plain choices of the theme (a key of the JSON, or a number). Capitalized by the CSS, as in `main`.
 * redesign J5 row 48 (ordering-products P-4, ): a theme key with its own title (THEME_TITLES) goes through it; any other
 * choice keeps main's key, built at run time.
 */
export const getThemeChoices = (t, choices) => (choices || []).map(choice => ({
  value: choice,
  content: (
    <span className='odc-op-theme-option'>
      {typeof choice === 'string'
        ? (Object.prototype.hasOwnProperty.call(THEME_TITLES, choice) ? THEME_TITLES[choice](t) : t(choice.toUpperCase(), choice.replace(/_/g, ' ')))
        : choice}
    </span>
  )
}))

export const ThemeOption = (props) => {
  const {
    name,
    optionObject,
    valueObject,
    path,
    onChange,
    handleAddThemeGallery
  } = props

  const [, t] = useLanguage()
  const title = getTitle(t, name) // J5 row 48: the translated title, see getTitle
  const valueType = optionObject?.value_type
  const hasChoices = !!optionObject?.options
  const isBoolean = valueType === 'boolean'
  // redesign (Q-02): text or color is decided once, with the value the option has when it mounts. `main` decided it on every
  // change, so typing `#ff0000` turned the field into a ColorField at `#ff0` (valid hex) and lost the focus. The tree mounts again
  // when the section changes or with Discard, which is when it must be worked out again.
  const [startsAsColor] = useState(() => validHexColor(valueObject))
  const asText = (valueType === 'integer' || valueType === 'string' || name === 'borderRadius') && !hasChoices && !startsAsColor
  const asColor = valueType === 'string' && name !== 'borderRadius' && startsAsColor
  const isImage = (name === 'image' || name === 'dummy_image') && valueType === 'string'
  // a control that carries the title as its name; without one the title is a heading
  const titled = isBoolean || asText || asColor || hasChoices
  const change = (value) => onChange(path, value)

  return (
    <div className='odc-op-theme-box'>
      {!titled && <h6 className='odc-op-theme-title'>{title}</h6>}
      {isBoolean && (
        <Checkbox checked={!!valueObject} onCheckedChange={change}>
          <span className='odc-op-theme-cap'>{title}</span>
        </Checkbox>
      )}
      {asText && (
        <TextField
          label={title}
          value={valueObject == null || typeof valueObject === 'object' ? '' : String(valueObject)}
          onChange={text => change(name === 'borderRadius' ? filterBorderRadius(text) : text)}
        />
      )}
      {asColor && (
        <ColorField label={title} value={valueObject} onChange={change} />
      )}
      {hasChoices && (
        <ThemeSelect
          label={title}
          placeholder={t('SELECT_ITEM', 'Select a _attribute_').replace('_attribute_', title)}
          options={getThemeChoices(t, optionObject.options)}
          value={valueObject}
          onChange={change}
        />
      )}
      {isImage && (
        <ThemeImage
          label={title}
          valueObject={valueObject}
          handleAddThemeGallery={handleAddThemeGallery}
          handleChangeValue={change}
        />
      )}
      {/* a group is walked by its keys; a bare string (no value_type) is not a group (its characters would recurse forever) */}
      {(!valueType && !optionObject?.components && optionObject && typeof optionObject === 'object') && Object.keys(optionObject).filter(subOption => subOption !== 'value_type' && subOption !== 'options' && subOption !== 'components').map(subOption => (
        <ThemeOption
          key={subOption}
          name={subOption}
          optionObject={optionObject[subOption]}
          valueObject={valueObject?.[subOption]}
          path={path + '.' + subOption}
          onChange={onChange}
          handleAddThemeGallery={handleAddThemeGallery}
        />
      ))}
      {optionObject?.components && Object.keys(optionObject.components).map(subOption => (
        <ThemeOption
          key={subOption}
          name={subOption}
          optionObject={optionObject.components[subOption]}
          valueObject={valueObject?.components?.[subOption]}
          // redesign (OP-19): `main` wrote this value at `path.subOption` but read it from `path.components.subOption`; with controls that show
          // the stored value the two must be the same place, so it is written where it is read.
          path={path + '.components.' + subOption}
          onChange={onChange}
          handleAddThemeGallery={handleAddThemeGallery}
        />
      ))}
    </div>
  )
}
