import React, { useRef } from 'react'

import { InputPhoneNumber } from '../UI/InputPhoneNumber'
import { focusFrameControl } from './Field'
import { cx } from './classNames'
import { LegacyFieldFrame, describedByIds, hasError, requireFrame, useAssociate, useFrameIds } from './legacyField'
import './product.css'
import './legacy-fields.css'

/*
 * redesign W0-7 (T0-28b) · PhoneField: the Product frame around the legacy InputPhoneNumber.
 *
 * InputPhoneNumber (Shared/UI) is unchanged: country select and number in react-phone-number-input, the
 * validation (libphonenumber-js, `validation_phone_number_lib`), the UK zero rule, `setValue(val, isValid, raw)`
 * and `handleIsValid(isValid)`. The wrapper passes it `value`, `setValue`, `handleIsValid`, `user`, `isUser` and
 * `disabled` untouched, with the same names, so a consumer swaps one tag for the other.
 *
 * Around it: a visible label tied to the number input (`<label for>`), the hint, the required marker and the
 * wrapper's own `error` (a message the parent computed, e.g. a required field left empty). The piece's own
 * invalid message (it paints one when the number is not valid) stays and is linked to the input too, so the
 * input is `aria-invalid` and described by it.
 *
 * The piece renders its input and error without `id` or `aria-*` props, so the wrapper sets them on those nodes
 * (useAssociate). Country and number read as one 32px field with one border and one focus ring (32px on a phone too: the 44px
 * area is a pseudo-element of the box, redesign tramo B r3 W0-QB2-02); in RTL the
 * number stays left-to-right and isolated. The country select is named by `countryLabel` (required, already translated,
 * e.g. «Mobile phone country»): the library's own «Phone number country» is English only and does not tell the fields apart.
 *
 * No text of its own: `label` and `countryLabel` are required; `requiredLabel` when `required`.
 */

const INPUT = 'input.PhoneInputInput'
const LEGACY_ERROR = '.od-phone-input-error'
const COUNTRY = 'select.PhoneInputCountrySelect'

export const PhoneField = React.forwardRef(function ProductPhoneField ({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  disabled = false,
  countryLabel,
  value,
  setValue,
  handleIsValid,
  user,
  isUser,
  className,
  ...props
}, ref) {
  requireFrame('PhoneField', { label, required, requiredLabel })
  // redesign tramo B r2 (W0-QB1-08): the name of the country selector comes by prop, translated; missing throws, '' paints empty
  if (countryLabel == null) throw new Error('PhoneField needs a countryLabel')
  const ids = useFrameIds()
  const rootRef = useRef(null)

  // The piece's own invalid message gets an id so the input can point at it.
  useAssociate(rootRef, LEGACY_ERROR, { id: ids.legacyError })
  useAssociate(rootRef, INPUT, root => {
    const ownMessage = Boolean(root.querySelector(LEGACY_ERROR))
    return {
      id: ids.control,
      'aria-describedby': describedByIds(ids, { hint, error }, ownMessage ? ids.legacyError : null),
      'aria-invalid': hasError(error) || ownMessage,
      'aria-required': required
    }
  })

  // The library names the select in English («Phone number country») and takes no prop for it: the wrapper writes the name.
  useAssociate(rootRef, COUNTRY, { 'aria-label': countryLabel })

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
      className={cx('odc-phone-field', className)}
      {...props}
    >
      {/* redesign tramo B r3 (W0-QB2-02): the 44px area is a pseudo-element of the box (`.PhoneInput`); a press that lands on the box
          itself, outside the country and the number, focuses the number */}
      <div
        className='odc-phone-field-control'
        onMouseDown={event => {
          if (event.target.classList?.contains('PhoneInput')) focusFrameControl(event.target, event, INPUT)
        }}
      >
        <InputPhoneNumber
          value={value}
          setValue={setValue}
          handleIsValid={handleIsValid}
          user={user}
          isUser={isUser}
          disabled={disabled}
        />
      </div>
    </LegacyFieldFrame>
  )
})
