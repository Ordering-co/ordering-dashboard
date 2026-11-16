import React, { useId, useLayoutEffect } from 'react'

import { CircleAlert } from '../Icon'
import { cx } from './classNames'
import './product.css'
import './legacy-fields.css'

/*
 * redesign W0-7 (T0-28b) · Frame shared by ImageField, ColorField and PhoneField.
 *
 * The three wrappers put the Product frame (visible label tied to the control, hint, error with aria,
 * required marker, disabled state) around a legacy piece (ImageCrop, ColorPicker, InputPhoneNumber)
 * without rewriting it. The common API is the one of Field (`label`, `hint`, `error`, `required`,
 * `requiredLabel`, `disabled`). This frame is a stand-in: when Field lands, the label, hint and error
 * markup and the id plumbing below can be delegated to it; what stays here is the DOM association with
 * a control the legacy piece renders without an `id` or `aria-*` props (see useAssociate).
 */

/** A name that is missing throws; an empty string is a name that paints empty. */
export const requireFrame = (component, { label, required, requiredLabel }) => {
  if (label == null) throw new Error(`${component} needs a label`)
  if (required && requiredLabel == null) throw new Error(`${component} needs a requiredLabel`)
}

export const hasError = error => error != null && error !== false && error !== ''
export const hasHint = hint => hint != null && hint !== false && hint !== ''

export const useFrameIds = () => {
  const base = useId()
  return {
    label: `${base}-label`,
    hint: `${base}-hint`,
    error: `${base}-error`,
    control: `${base}-control`,
    value: `${base}-value`,
    legacyError: `${base}-legacy-error`
  }
}

/** The ids the hint and the error own, in reading order, for aria-describedby. */
export const describedByIds = (ids, { hint, error }, ...extra) => (
  [hasHint(hint) ? ids.hint : null, hasError(error) ? ids.error : null, ...extra].filter(Boolean).join(' ') || undefined
)

/**
 * Sets attributes on the control a legacy piece renders, after every commit. The legacy pieces take no `id`
 * or `aria-*` props, so a label cannot be tied to their control from React; the wrapper does it on the DOM.
 * Attributes the piece does not manage survive its re-renders (React only touches the props it sets).
 * `null`, `undefined` and `false` remove the attribute; `true` writes "true". `attributes` may be a function of the
 * root when what to write depends on what the piece rendered (PhoneField's own invalid message).
 */
export const useAssociate = (rootRef, selector, attributes) => {
  useLayoutEffect(() => {
    const root = rootRef.current
    const target = root?.querySelector(selector)
    if (!target) return
    const resolved = typeof attributes === 'function' ? attributes(root) : attributes
    for (const [name, value] of Object.entries(resolved)) {
      if (value == null || value === false) target.removeAttribute(name)
      else target.setAttribute(name, value === true ? 'true' : String(value))
    }
  })
}

/**
 * Frame: label (a <label for> when the control has an id, else a span the control points to), the
 * control (children), hint and error. `group` makes the root a named group (ImageField, ColorField);
 * PhoneField labels its input and leaves the root a plain block.
 */
export const LegacyFieldFrame = React.forwardRef(function LegacyFieldFrame ({
  ids,
  label,
  labelFor,
  hint,
  error,
  required = false,
  requiredLabel,
  disabled = false,
  group = false,
  describedBy,
  className,
  children,
  ...props
}, ref) {
  const failed = hasError(error)
  const Label = labelFor ? 'label' : 'span'
  return (
    <div
      ref={ref}
      className={cx('odc-root', 'odc-legacy-field', className)}
      role={group ? 'group' : undefined}
      aria-labelledby={group ? ids.label : undefined}
      aria-describedby={group ? describedBy : undefined}
      data-invalid={failed ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-required={required ? '' : undefined}
      {...props}
    >
      <Label id={ids.label} htmlFor={labelFor || undefined} className='odc-legacy-field-label'>
        <span className='odc-legacy-field-label-text'>{label}</span>
        {required && (
          <>
            <span className='odc-legacy-field-required' aria-hidden='true' title={requiredLabel}>*</span>
            {' '}
            <span className='odc-sr-only'>{requiredLabel}</span>
          </>
        )}
      </Label>
      {children}
      {hasHint(hint) && <p id={ids.hint} className='odc-legacy-field-hint'>{hint}</p>}
      {failed && (
        <p id={ids.error} className='odc-legacy-field-error' role='alert'>
          <CircleAlert className='odc-icon odc-legacy-field-error-icon' aria-hidden='true' />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})
