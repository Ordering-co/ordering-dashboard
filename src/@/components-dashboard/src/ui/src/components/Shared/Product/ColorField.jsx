import React, { useEffect, useRef, useState } from 'react'

import { ColorPicker } from '../UI/ColorPicker'
import { cx } from './classNames'
import { LegacyFieldFrame, describedByIds, hasError, requireFrame, useAssociate, useFrameIds } from './legacyField'
import './product.css'
import './legacy-fields.css'

/*
 * redesign W0-7 (T0-28b) · ColorField: the Product frame around the legacy ColorPicker.
 *
 * ColorPicker (Shared/UI) is unchanged and still the picker: it takes `defaultColor` (a seed it re-syncs to when
 * it changes), `isDisabled` and `onChangeColor(hex)`, which it calls 750 ms after the last change with the hex
 * the SketchPicker emits. The wrapper passes `value` as `defaultColor`, `disabled` as `isDisabled` and `onChange`
 * as `onChangeColor`, and `onChange` receives that hex untouched.
 *
 * Around it: a named group (label, hint, error, required marker) and, beside the swatch the picker draws, the value
 * as text in mono (`odc-figure`, tabular, isolated left-to-right), so the color is never only a color. White label
 * (decision 30): the value is shown exactly as stored or emitted. It is never normalised, uppercased, corrected for
 * contrast or restricted. The text follows the swatch: it is the `value` prop, and the hex the picker emits until
 * the parent passes a new `value`.
 *
 * The picker's trigger takes no `id` or `aria-*` props, so the wrapper sets them on it (useAssociate): the label is
 * tied to it (a click on the label opens the picker) and its accessible name becomes «label + value» instead of the
 * generic «Select color». The hint and the error are linked with aria-describedby.
 *
 * No text of its own: `label` is required; `requiredLabel` when `required`.
 */

const TRIGGER = '.od-color-picker-trigger'

export const ColorField = React.forwardRef(function ProductColorField ({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  disabled = false,
  value,
  onChange,
  className,
  ...props
}, ref) {
  requireFrame('ColorField', { label, required, requiredLabel })
  const ids = useFrameIds()
  const rootRef = useRef(null)
  const [shown, setShown] = useState(value)
  useEffect(() => { setShown(value) }, [value])

  const describedBy = describedByIds(ids, { hint, error })
  const hasValue = shown != null && shown !== ''
  useAssociate(rootRef, TRIGGER, {
    id: ids.control,
    'aria-labelledby': hasValue ? `${ids.label} ${ids.value}` : ids.label,
    'aria-describedby': describedBy
  })

  const setRefs = node => {
    rootRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  return (
    <LegacyFieldFrame
      ref={setRefs}
      ids={ids}
      label={label}
      labelFor={ids.control}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
      disabled={disabled}
      group
      describedBy={describedBy}
      className={cx('odc-color-field', className)}
      {...props}
    >
      <div className='odc-color-field-control' data-invalid={hasError(error) ? '' : undefined}>
        <ColorPicker
          defaultColor={value}
          isDisabled={disabled}
          onChangeColor={hex => {
            setShown(hex)
            onChange?.(hex)
          }}
        />
        {hasValue && (
          <span id={ids.value} className='odc-color-field-value odc-figure odc-mono'>{shown}</span>
        )}
      </div>
    </LegacyFieldFrame>
  )
})
