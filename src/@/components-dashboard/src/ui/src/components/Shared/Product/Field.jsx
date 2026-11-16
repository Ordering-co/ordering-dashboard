import React, { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react'
import { Field as FieldPrimitive } from '@base-ui/react/field'
import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field'

import { CircleAlert, Eye, EyeOff, Minus, Plus } from '../Icon'
import { IconButton } from './Button'
import { cx } from './classNames'
import './product.css'
import './field.css'

/*
 * redesign W0-7 (T0-21) · Form field family: Field, TextField, TextArea, PasswordField, NumberField.
 *
 * Built on Base UI Field (Field.Root, Field.Label, Field.Description, Field.Error), which wires the
 * accessible name (`<label for>`), `aria-describedby` toward the hint and the error, and `aria-invalid`.
 * The wrapper has no text of its own: `label`, `hint`, `error`, `requiredLabel`, `showLabel`,
 * `hideLabel`, `incrementLabel` and `decrementLabel` arrive already translated.
 *
 * Common API: `label` (required unless `aria-label` names the control), `hint`, `error` (a string:
 * with it the field is invalid, data-invalid on the root and the control, aria-invalid on the control,
 * and the message is a role="alert"), `required` + `requiredLabel` (the asterisk is aria-hidden and the
 * label carries the text, e.g. «Required»), `disabled`, `value` / `defaultValue` / `onChange`
 * (controlled or not), `name`, `id` (without it, Base UI generates one).
 *
 * Sizes follow the pilot: a 32px control (--od-x-control-height), 13px text, 16px under 768px so iOS
 * does not zoom on focus. On a phone the control stays 32px (decision 12, redesign tramo B r3 W0-QB2-02, as the buttons and
 * the DatePicker are): an <input> takes no ::after, so the 44px area is a pseudo-element on its FRAME: `.odc-field-control`,
 * the container the Field puts around a bare control (TextField, TextArea, a native select), or `.odc-field-box` (password,
 * number). A press on the frame outside the control (the 6px above and below it) focuses the control. The buttons inside a
 * box (show/hide, steppers) are 28px with a centred 44px hit area of their own. The frame's area crosses the neighbour's
 * if two stacked controls are less than 12px apart: the form that stacks fields without a visible label keeps >= 12px
 * between them (the label line alone puts a labelled field > 24px from the one above).
 *
 * redesign tramo B r2 (W0-QB1-04) · Any child control. Base UI wires its own controls (Field.Control, NumberField). For a
 * child it does not know (a native <select>, a DatePicker, a combobox) the frame writes the same links on the control after
 * each commit: `id` and the label's `for`, `aria-describedby` toward the hint and the error, `aria-invalid` and
 * `aria-required`; a click on the label focuses a button-like control without activating it. A control that Base UI wired
 * is left as it is; one the frame wired is rewritten after every commit, so an error or a required mark that arrives after
 * the first render is linked too (redesign tramo B r3, W0-QB2-01). `useFieldFrame()` hands a framed control the id of the
 * visible label and whether the field is invalid or required (DatePicker paints its border from it).
 */

// A name that is missing throws; an empty string is a name that paints empty (never the same as missing).
const requireName = (component, label, ariaLabel) => {
  if (label == null && ariaLabel == null) throw new Error(`${component} needs a label`)
}

const requireRequiredLabel = (component, required, requiredLabel) => {
  if (required && requiredLabel == null) throw new Error(`${component} needs a requiredLabel`)
}

const hasError = error => error != null && error !== false && error !== ''

// redesign tramo B r2 (W0-QB1-04): the control a frame links to when Base UI did not wire it.
const FieldFrameContext = createContext(null)
/**
 * Inside a Field: `{ labelId, labelTextId, invalid, required, describedBy }` (`labelId` and `labelTextId` are null without a visible label; `describedBy` is the
 * space-separated ids of the hint and of the error when they are shown, else null). Outside one: null.
 */
export const useFieldFrame = () => useContext(FieldFrameContext)

const CONTROL_SELECTOR = [
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="spinbutton"]',
  'button[aria-haspopup]',
  // SC-2: the trigger of U/FirstSelect is a div with a role, not a native button
  '[role="button"][aria-haspopup]'
].join(',')

// What a <label for> can name; a div with a role (the FirstSelect trigger) needs aria-labelledby instead.
const LABELABLE = 'input, select, textarea, button'

// attributes the frame wrote on an element, so it only takes back what it put
const OWNED = new WeakMap()

const linkControl = (root, ids, { failed, required, errorShown }) => {
  if (!root) return
  const label = root.querySelector('.odc-field-label')
  // Base UI already wired it (its control is what the label points at): nothing to add. A control THIS frame wired is not
  // Base UI's: it is written again on every commit, so an error or a required mark that arrives later is linked
  // (redesign tramo B r3, W0-QB2-01).
  const pointed = label?.htmlFor ? root.querySelector(`[id="${label.htmlFor}"]`) : null
  if (pointed && !OWNED.has(pointed)) return
  const control = [...root.querySelectorAll(CONTROL_SELECTOR)]
    .find(node => !node.closest('.odc-field-label, .odc-field-error, .odc-field-hint'))
  if (!control) return
  const owned = OWNED.get(control) ?? new Set()
  OWNED.set(control, owned)
  const write = (name, value) => {
    if (value == null) {
      if (owned.has(name)) {
        control.removeAttribute(name)
        owned.delete(name)
      }
    } else if (control.getAttribute(name) !== value) {
      control.setAttribute(name, value)
      owned.add(name)
    }
  }
  const labelable = control.matches(LABELABLE)
  if (label) {
    if (!control.id) { control.id = ids.control; owned.add('id') }
    label.htmlFor = control.id
    // SC-2: «<label> <own content>» (the control's own id in the list is the content), unless the control already has a
    // name of its own (a surface's SelectFieldLabelContext, an aria-label): that one wins.
    if (!labelable && label.id && (owned.has('aria-labelledby') || !(control.hasAttribute('aria-labelledby') || control.hasAttribute('aria-label')))) {
      write('aria-labelledby', `${label.id} ${control.id}`)
    }
  }
  // redesign tramo B r4 (W0-QB3-03): the error's id is decided by the prop, not by whether its node is in the DOM. Base UI keeps the
  // error mounted while it leaves (a transition), so a lookup in the DOM still found it when the error was removed and the link was
  // left pointing at a node that was about to go. The hint is not animated: its node is the truth.
  const mine = [ids.hint, ids.error].filter(id => id === ids.error ? errorShown : root.querySelector(`[id="${id}"]`))
  const kept = (control.getAttribute('aria-describedby') || '').split(' ').filter(token => token && token !== ids.hint && token !== ids.error)
  write('aria-describedby', [...kept, ...mine].join(' ') || null)
  if (!mine.length && !kept.length) control.removeAttribute('aria-describedby')
  write('aria-invalid', failed ? 'true' : null)
  // aria-required is not allowed on a role=button (axe aria-allowed-attr): the required mark is in the label that names it
  write('aria-required', required && (labelable || control.getAttribute('role') !== 'button') ? 'true' : null)
}

const FOCUSABLE = 'input:not([type="hidden"]), select, textarea'

/**
 * redesign tramo B r3 (W0-QB2-02): the 44px area of a text control is a pseudo-element on its frame, and a press on a
 * pseudo-element lands on the frame. When it does (the press is on the frame itself, not on the control or a button in it),
 * the control takes the focus, as a press on the control would have. Returns whether it did.
 */
export const focusFrameControl = (frame, event, selector = FOCUSABLE) => {
  if (event.target !== frame) return false
  const control = frame.querySelector(selector)
  if (!control) return false
  event.preventDefault()
  control.focus()
  // Android Chrome does not open a native select on a programmatic focus(), so the tap on the frame needed a
  // second one. On a coarse pointer the select opens its picker; a mouse keeps the plain focus. showPicker() throws
  // NotAllowedError without a user gesture, and the select already has the focus then.
  if (control.tagName === 'SELECT' && window.matchMedia?.('(pointer: coarse)')?.matches) {
    try { control.showPicker?.() } catch (error) { /* the select stays focused; the next tap opens it */ }
  }
  return true
}

/**
 * Field frame: label, the control (children), hint and error. `children` must be a Base UI
 * control (`Field.Control`, an Input, a NumberField) or a control that sets its own `aria-label`:
 * Base UI links the label, the hint and the error to it. Use TextField and its siblings for the
 * usual inputs; use Field to frame another control.
 */
export const Field = React.forwardRef(function ProductField ({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  disabled = false,
  name,
  invalid,
  className,
  children,
  'aria-label': ariaLabel, // satisfies the name check when the control carries it; the frame paints nothing for it
  ...props
}, ref) {
  requireName('Field', label, ariaLabel)
  requireRequiredLabel('Field', required, requiredLabel)
  const failed = hasError(error) || invalid === true
  const base = useId()
  const ids = { label: `${base}-label`, labelText: `${base}-label-text`, hint: `${base}-hint`, error: `${base}-error`, control: `${base}-control` }
  const hasLabel = label != null
  // redesign 2.E: `describedBy` is the hint id (a hint is rendered) and the error id (an error shows), for a framed
  // control that wires a second control the frame does not link (TimeField's minute select).
  const hasHint = hint != null && hint !== ''
  const errorShown = hasError(error)
  const describedBy = [hasHint ? ids.hint : null, errorShown ? ids.error : null].filter(Boolean).join(' ') || null
  // redesign 2.C: `labelTextId` is the label's words alone (without the screen-reader required text), for a control
  // that names something after the field (SecretField's «Show <label>»).
  const frame = React.useMemo(() => ({ labelId: hasLabel ? ids.label : null, labelTextId: hasLabel ? ids.labelText : null, invalid: failed, required, describedBy }), [hasLabel, ids.label, ids.labelText, failed, required, describedBy])
  const rootRef = useRef(null)
  const setRefs = node => {
    rootRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }
  // redesign tramo B r2 (W0-QB1-04): after every commit, so a control that mounts later (a lazy one) is linked too
  useLayoutEffect(() => { linkControl(rootRef.current, ids, { failed, required, errorShown: hasError(error) }) })
  // A click on the label of a button-like control (DatePicker) focuses it; the label's own activation would open it.
  const focusInstead = event => {
    const target = event.currentTarget.htmlFor ? document.getElementById(event.currentTarget.htmlFor) : null
    if (target && (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button')) {
      event.preventDefault()
      target.focus()
    }
  }
  return (
    <FieldFrameContext.Provider value={frame}>
    <FieldPrimitive.Root
      ref={setRefs}
      name={name}
      disabled={disabled}
      invalid={failed}
      className={cx('odc-root', 'odc-field', className)}
      data-required={required ? '' : undefined}
      {...props}
    >
      {label != null && (
        <FieldPrimitive.Label id={ids.label} className='odc-field-label' onClick={focusInstead}>
          <span id={ids.labelText} className='odc-field-label-text'>{label}</span>
          {required && (
            <>
              {' '}
              <span className='odc-field-required' aria-hidden='true' title={requiredLabel}>*</span>
              <span className='odc-sr-only'>{requiredLabel}</span>
            </>
          )}
        </FieldPrimitive.Label>
      )}
      {/* redesign tramo B r3 (W0-QB2-02): the frame of the control, which owns the 44px area on a phone */}
      <div className='odc-field-control' onMouseDown={event => focusFrameControl(event.currentTarget, event)}>
        {children}
      </div>
      {hasHint && (
        <FieldPrimitive.Description id={ids.hint} className='odc-field-hint'>{hint}</FieldPrimitive.Description>
      )}
      <FieldPrimitive.Error id={ids.error} match={hasError(error)} className='odc-field-error' role='alert'>
        {hasError(error) && (
          <>
            <CircleAlert className='odc-icon odc-field-error-icon' aria-hidden='true' />
            <span>{error}</span>
          </>
        )}
      </FieldPrimitive.Error>
    </FieldPrimitive.Root>
    </FieldFrameContext.Provider>
  )
})

/**
 * SC-3: `Field.Scope`, a `div` that is a Field scope of its own. A Base UI input inside a Field takes the Field's label as
 * its name; a control that lives inside a framed control (the search of a U/FirstSelect list) goes in a scope so it keeps its own
 * name. A static member, not a barrel export: it is plumbing for the pieces that render inside a Field, not a component for pages.
 */
Field.Scope = ({ className, children }) => <FieldPrimitive.Root className={className}>{children}</FieldPrimitive.Root>
Field.Scope.displayName = 'ProductFieldScope'

// What a control element needs besides what the user passes: the required hint for assistive tech.
const controlProps = ({ required, 'aria-label': ariaLabel }) => ({
  'aria-required': required ? 'true' : undefined,
  'aria-label': ariaLabel
})

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
}, component) => {
  requireName(component, label, rest['aria-label'])
  requireRequiredLabel(component, required, requiredLabel)
  return {
    frame: { label, hint, error, required, requiredLabel, disabled, name, invalid, 'aria-label': rest['aria-label'], className: fieldClassName, ...fieldProps },
    rest
  }
}

const fireChange = onChange => (next, details) => onChange?.(next, details?.event)

/**
 * Single-line text field. `onChange(value, event)` gets the string. `type` is a text-like type
 * (text, email, tel, url, search); use PasswordField for passwords and NumberField for numbers.
 * Extra props (placeholder, autoComplete, inputMode, maxLength, readOnly, …) go to the <input>.
 */
export const TextField = React.forwardRef(function ProductTextField ({
  value,
  defaultValue,
  onChange,
  type = 'text',
  className,
  ...props
}, ref) {
  const { frame, rest } = splitFrame(props, 'TextField')
  return (
    <Field {...frame}>
      <FieldPrimitive.Control
        ref={ref}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onValueChange={fireChange(onChange)}
        className={cx('odc-field-input', className)}
        {...rest}
        {...controlProps({ required: frame.required, 'aria-label': rest['aria-label'] })}
      />
    </Field>
  )
})

/** Multi-line text. `rows` (3 by default) sets the starting height; the user can resize it vertically. */
export const TextArea = React.forwardRef(function ProductTextArea ({
  value,
  defaultValue,
  onChange,
  rows = 3,
  className,
  ...props
}, ref) {
  const { frame, rest } = splitFrame(props, 'TextArea')
  return (
    <Field {...frame}>
      <FieldPrimitive.Control
        ref={ref}
        render={<textarea />}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        onValueChange={fireChange(onChange)}
        className={cx('odc-field-input', 'odc-field-textarea', className)}
        {...rest}
        {...controlProps({ required: frame.required, 'aria-label': rest['aria-label'] })}
      />
    </Field>
  )
})

/**
 * Password field with a show/hide button. `showLabel` and `hideLabel` are required: the button's
 * accessible name is «show» while the text is hidden and «hide» while it shows, and `type` switches
 * between `password` and `text`. The text is hidden again whenever the field is disabled.
 */
export const PasswordField = React.forwardRef(function ProductPasswordField ({
  value,
  defaultValue,
  onChange,
  showLabel,
  hideLabel,
  className,
  ...props
}, ref) {
  const [shown, setShown] = useState(false)
  const { frame, rest } = splitFrame(props, 'PasswordField')
  if (showLabel == null) throw new Error('PasswordField needs a showLabel')
  if (hideLabel == null) throw new Error('PasswordField needs a hideLabel')
  const visible = shown && !frame.disabled
  return (
    <Field {...frame}>
      <div className='odc-field-box' data-end-adornment='' onMouseDown={event => focusFrameControl(event.currentTarget, event)}>
        <FieldPrimitive.Control
          ref={ref}
          type={visible ? 'text' : 'password'}
          value={value}
          defaultValue={defaultValue}
          onValueChange={fireChange(onChange)}
          className={cx('odc-field-input', className)}
          data-password-visible={visible ? '' : undefined}
          {...rest}
          {...controlProps({ required: frame.required, 'aria-label': rest['aria-label'] })}
        />
        <IconButton
          icon={visible ? EyeOff : Eye}
          label={visible ? hideLabel : showLabel}
          size='sm'
          className='odc-field-adornment'
          disabled={frame.disabled}
          onClick={() => setShown(current => !current)}
        />
      </div>
    </Field>
  )
})

/**
 * Number field on Base UI NumberField: arrows and Page keys step, wheel and Home / End follow min and
 * max. `onChange(value)` gets a number or null (empty). `format` is an optional `Intl.NumberFormatOptions`
 * (currency, percent, fraction digits) and `locale` an optional Intl locale; both only shape the text.
 * The steppers are opt-in and need both names: `incrementLabel` and `decrementLabel`.
 * Figures read in mono with tabular digits (decision 11: `odc-figure`).
 */
export const NumberField = React.forwardRef(function ProductNumberField ({
  value,
  defaultValue,
  onChange,
  min,
  max,
  step,
  format,
  locale,
  incrementLabel,
  decrementLabel,
  readOnly,
  className,
  ...props
}, ref) {
  const { frame, rest } = splitFrame(props, 'NumberField')
  const steppers = incrementLabel != null || decrementLabel != null
  if (steppers && incrementLabel == null) throw new Error('NumberField needs an incrementLabel')
  if (steppers && decrementLabel == null) throw new Error('NumberField needs a decrementLabel')
  const { id, 'aria-label': ariaLabel, ...inputRest } = rest
  return (
    <Field {...frame}>
      <NumberFieldPrimitive.Root
        id={id}
        name={frame.name}
        disabled={frame.disabled}
        readOnly={readOnly}
        value={value}
        defaultValue={defaultValue}
        onValueChange={next => onChange?.(next)}
        min={min}
        max={max}
        step={step}
        format={format}
        locale={locale}
        className='odc-field-number'
      >
        <NumberFieldPrimitive.Group
          className='odc-field-box'
          data-start-adornment={steppers ? '' : undefined}
          data-end-adornment={steppers ? '' : undefined}
          onMouseDown={event => focusFrameControl(event.currentTarget, event)}
        >
          {steppers && (
            <NumberFieldPrimitive.Decrement
              className='odc-field-adornment odc-field-step'
              aria-label={decrementLabel}
              render={<IconButton icon={Minus} label={decrementLabel} size='sm' />}
            />
          )}
          <NumberFieldPrimitive.Input
            ref={ref}
            className={cx('odc-field-input', 'odc-figure', 'odc-num', className)}
            {...inputRest}
            {...controlProps({ required: frame.required, 'aria-label': ariaLabel })}
          />
          {steppers && (
            <NumberFieldPrimitive.Increment
              className='odc-field-adornment odc-field-step'
              aria-label={incrementLabel}
              render={<IconButton icon={Plus} label={incrementLabel} size='sm' />}
            />
          )}
        </NumberFieldPrimitive.Group>
      </NumberFieldPrimitive.Root>
    </Field>
  )
})
