import React, { useEffect, useId, useRef, useState } from 'react'
import { Field as FieldPrimitive } from '@base-ui/react/field'

import { Button } from './Button'
import { Field, focusFrameControl, useFieldFrame } from './Field'
import { cx } from './classNames'
import './product.css'
import './secret-field.css'

/*
 * redesign 2.C · A secret (an API key, a token, a billing account) in an input that is hidden by default, with a
 * «Show» / «Hide» button beside it and, under it, the last four characters («Ends in …k3Fz»). Decision 7 of the Stores plan: the
 * owner approved the click on «Show» to read a secret. Built on Field (label, hint, error, required, disabled, name) as TextField is;
 * the input sits in the field family's `.odc-field-box` (as PasswordField's), which owns its 32px look and, on a phone, its 44px area.
 *
 * Hidden by default: `type='password'`; Show makes it `type='text'`, Hide goes back. The button is a P/Button (secondary, md) beside
 * the box. Its visible text is `showLabel` while hidden and `hideLabel` while shown; both words sit stacked in one grid cell, so the
 * button always has the width of the longer one and nothing moves on a toggle (the inactive word is `visibility: hidden` and
 * `aria-hidden`). Its accessible name is the active word followed by the field («Show Secret key»): `aria-labelledby` over the word and
 * the words of the field's visible label, without a required field's screen-reader «Required» (`useFieldFrame().labelTextId`; with only an `aria-label`, `aria-label` = «<word> <aria-label>» when both are strings, else the word).
 * `aria-controls` points to the input. The state is the input's type plus `data-secret-visible` (on the input and on the row), never
 * `aria-pressed` (the name already changes: two signals for one thing). A disabled field is always hidden (and the button is disabled
 * too; a secret the user had shown is hidden again, and stays so when the field is enabled). The toggle keeps the focus on the button.
 * Optional `shownStatus` and `hiddenStatus` (both or neither) are a polite status line for a screen reader, spoken after a toggle
 * and never on mount.
 *
 * Value: `value` (controlled) or `defaultValue`, and `onChange(value, event)` as TextField's: the event is the native change event, so a
 * consumer reads `event.target.name` / `event.target.value` (a payment form keeps one handler for many secrets).
 *
 * The ending: `endingLabel(ending)` is required and returns the translated line; `ending` is a node (`<bdi class='odc-figure'
 * dir='ltr'>…k3Fz</bdi>`: the ellipsis and the four characters, mono, left to right in an RTL page) to place inside the text, e.g.
 * `ending => <>Ends in {ending}</>`. It shows in both states, only when the current value is a string of SECRET_ENDING_MIN_LENGTH (12)
 * characters or more: with fewer, four characters are a third of the key or more and are not shown. It is rendered inside the Field hint,
 * so the input's aria-describedby reaches it; a `hint` of the consumer is kept on a line of its own above it. An empty or short value
 * paints no ending node. Uncontrolled, the ending also follows a reset of the form that holds the input.
 *
 * No text of its own (a Product wrapper): `label` (or `aria-label`), `showLabel`, `hideLabel` and `endingLabel` arrive already
 * translated; one that is missing (`== null`) throws, an empty string paints empty (W0-Q1-01).
 *
 * The browser does not fill it or remember it (decision D2): `autoComplete='new-password'` (NOT `off`: Chrome ignores `off` on a
 * password field and could fill the admin's saved Dashboard password into a store's secret; `new-password` tells it this is not the
 * saved one), the password managers' opt-outs (`data-1p-ignore`, `data-lpignore='true'`, `data-bwignore`, `data-form-type='other'`),
 * and no spell check, capitals or correction (an enhanced spell checker may send the text out, a phone keyboard capitalizes a key's
 * first letter). They are defaults: any prop of the consumer wins. `readOnly` passes through (hidden by default, Show works).
 * The input is `dir='ltr'` by default too: a key is LTR text, and in an RTL page a shown key would otherwise scroll its first
 * characters out of the box («.test_51H…» for «sk_test_51H…»).
 *
 * Frame props (`label`, `hint`, `error`, `required`, `requiredLabel`, `disabled`, `name`, `invalid`, `fieldClassName`, `fieldProps`,
 * `aria-label`) go to Field as TextField's do; `id` and the other props go to the <input>, `ref` is the input. Not adopted by any
 * section yet (5.9 Payments and 5.16 Spoonity will).
 */

/** The shortest value that shows its ending: with fewer characters, the last four are too much of the key. */
export const SECRET_ENDING_MIN_LENGTH = 12
const ENDING_LENGTH = 4
const ELLIPSIS = '…'

// the frame props go to Field as TextField's do (a small local copy: Field.jsx keeps its own)
const splitFrame = ({
  label,
  hint,
  error,
  required,
  requiredLabel,
  disabled,
  name,
  invalid,
  fieldClassName,
  fieldProps,
  ...rest
}) => {
  if (label == null && rest['aria-label'] == null) throw new Error('SecretField needs a label')
  if (required && requiredLabel == null) throw new Error('SecretField needs a requiredLabel')
  return {
    frame: { label, hint, error, required, requiredLabel, disabled, name, invalid, 'aria-label': rest['aria-label'], className: fieldClassName, ...fieldProps },
    rest
  }
}

const hasHint = hint => hint != null && hint !== ''

// Inside Field, to read the id of the visible label it provides (the button's name ends with it).
const SecretBody = ({
  inputRef,
  inputId,
  className,
  rest,
  required,
  disabled,
  ariaLabel,
  value,
  defaultValue,
  onValueChange,
  showLabel,
  hideLabel,
  shownStatus,
  hiddenStatus
}) => {
  const frame = useFieldFrame()
  const base = useId()
  const showId = `${base}-show`
  const hideId = `${base}-hide`
  const [shown, setShown] = useState(false)
  // null on mount: a status is spoken after a toggle, never on load
  const [announced, setAnnounced] = useState(null)
  const visible = shown && !disabled
  // a secret that was shown does not come back on its own when the field is enabled again
  // (and a status that said «shown» says «hidden», so a reader never finds a stale state)
  useEffect(() => {
    if (!disabled) return
    setShown(false)
    setAnnounced(current => current === 'shown' ? 'hidden' : current)
  }, [disabled])

  const activeText = visible ? hideLabel : showLabel
  const activeId = visible ? hideId : showId
  // the label's words alone: a required field's screen-reader «Required» is not part of the button's name
  const labelId = frame?.labelTextId ?? null
  const namedByAria = labelId == null && typeof activeText === 'string' && typeof ariaLabel === 'string'
  const toggle = () => {
    setShown(current => !current)
    setAnnounced(visible ? 'hidden' : 'shown')
  }

  return (
    <div className='odc-secret' data-secret-visible={visible ? '' : undefined}>
      <div className='odc-field-box' onMouseDown={event => focusFrameControl(event.currentTarget, event)}>
        <FieldPrimitive.Control
          ref={inputRef}
          autoComplete='new-password'
          data-1p-ignore=''
          data-lpignore='true'
          data-bwignore=''
          data-form-type='other'
          spellCheck={false}
          autoCapitalize='off'
          autoCorrect='off'
          dir='ltr'
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          className={cx('odc-field-input', 'odc-secret-input', className)}
          {...rest}
          id={inputId}
          type={visible ? 'text' : 'password'}
          data-secret-visible={visible ? '' : undefined}
          aria-required={required ? 'true' : undefined}
          aria-label={ariaLabel}
        />
      </div>
      <Button
        variant='secondary'
        size='md'
        type='button'
        className='odc-secret-toggle'
        aria-controls={inputId}
        aria-labelledby={labelId != null ? `${activeId} ${labelId}` : undefined}
        aria-label={namedByAria ? `${activeText} ${ariaLabel}` : undefined}
        disabled={disabled}
        onClick={toggle}
      >
        <span className='odc-secret-words'>
          <span id={showId} className='odc-secret-word' aria-hidden={visible ? 'true' : undefined}>{showLabel}</span>
          <span id={hideId} className='odc-secret-word' aria-hidden={visible ? undefined : 'true'}>{hideLabel}</span>
        </span>
      </Button>
      {shownStatus != null && (
        <span role='status' aria-live='polite' className='odc-sr-only'>
          {announced === 'shown' ? shownStatus : announced === 'hidden' ? hiddenStatus : ''}
        </span>
      )}
    </div>
  )
}

/** Secret input with Show / Hide and the last four characters; see the header of this file. `onChange(value, event)`. */
export const SecretField = React.forwardRef(function ProductSecretField ({
  value,
  defaultValue,
  onChange,
  showLabel,
  hideLabel,
  endingLabel,
  shownStatus,
  hiddenStatus,
  className,
  id,
  ...props
}, ref) {
  const { frame, rest } = splitFrame(props)
  if (showLabel == null) throw new Error('SecretField needs a showLabel')
  if (hideLabel == null) throw new Error('SecretField needs a hideLabel')
  if (endingLabel == null) throw new Error('SecretField needs an endingLabel')
  if ((shownStatus == null) !== (hiddenStatus == null)) throw new Error('SecretField needs both a shownStatus and a hiddenStatus, or neither')

  const generatedId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef(null)
  const setRefs = node => {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }
  // The current value is read only to compute the ending; the input owns it (Base UI Field.Control), controlled or not.
  const controlled = value !== undefined
  const [typed, setTyped] = useState(defaultValue)
  const current = controlled ? value : typed

  // Uncontrolled: a reset of the form puts the input back to its default without a change event, so the ending reads it again
  // (after the reset has run).
  useEffect(() => {
    const form = inputRef.current?.form
    if (controlled || !form) return undefined
    let timer
    const onReset = () => {
      timer = setTimeout(() => setTyped(inputRef.current?.value ?? ''), 0)
    }
    form.addEventListener('reset', onReset)
    return () => {
      form.removeEventListener('reset', onReset)
      clearTimeout(timer)
    }
  }, [controlled])

  const ending = typeof current === 'string' && current.length >= SECRET_ENDING_MIN_LENGTH
    ? (
      <span className='odc-secret-ending'>
        {endingLabel(<bdi className='odc-figure odc-secret-ending-figure' dir='ltr'>{ELLIPSIS}{current.slice(-ENDING_LENGTH)}</bdi>)}
      </span>
      )
    : null
  const hint = ending
    ? (
      <>
        {hasHint(frame.hint) && <span className='odc-secret-hint'>{frame.hint}</span>}
        {ending}
      </>
      )
    : frame.hint

  const fireChange = (next, details) => {
    if (!controlled) setTyped(next)
    onChange?.(next, details?.event)
  }

  return (
    <Field {...frame} hint={hint}>
      <SecretBody
        inputRef={setRefs}
        inputId={inputId}
        className={className}
        rest={rest}
        required={frame.required}
        disabled={frame.disabled}
        ariaLabel={rest['aria-label']}
        value={value}
        defaultValue={defaultValue}
        onValueChange={fireChange}
        showLabel={showLabel}
        hideLabel={hideLabel}
        shownStatus={shownStatus}
        hiddenStatus={hiddenStatus}
      />
    </Field>
  )
})
