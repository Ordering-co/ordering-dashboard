import React from 'react'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { DirectionProvider } from '@base-ui/react/direction-provider'

import { cx } from './classNames'
import { useProductDir } from './useProductDir'
import './product.css'
import './radio-group.css'
import './field.css' // redesign bugs F row 38: the asterisk is Field's own (.odc-field-required)

// redesign W0-7 (T0-22)
const assertProps = (label, options) => {
  // missing, not empty: an empty translation paints an empty title
  if (label == null) throw new Error('RadioGroup needs a label')
  if (!Array.isArray(options)) throw new Error('RadioGroup needs options')
}

/**
 * Exclusive options (product.md > Control semantics): a named `radiogroup`
 * that wraps only its title and its radios. Each option is a native <button>
 * with role="radio" and aria-checked. Arrows (inverted in RTL), Home and End
 * move the choice; the roving tabindex gives the group one Tab stop, and a
 * `value` that matches no option leaves the tab stop on the first enabled one.
 *
 * `label` names the group and is required: it is the visible title (a legend
 * above the options) or, with `hideLabel`, only the accessible name.
 * `options` is `[{ value, label, description?, disabled? }]`; `description` is
 * secondary text announced with the option. `orientation` is `vertical`
 * (default) or `horizontal`. The wrapper has no text of its own.
 *
 * The row is the target: at least 32px tall with a fine pointer; 44px VISIBLE on a phone or with a
 * coarse pointer (redesign tramo B r2, W0-QB1-06: the rows are stacked closer than two 44px areas
 * need, so a pseudo-element area would overlap the neighbour).
 *
 * A chosen option that is disabled keeps the group in the Tab order: the stop is then on the first enabled radio (stores 5.18).
 *
 * redesign stores 5.15b (G5-15): OPT-IN `variant='cards'`. The same radiogroup and keyboard; each option is a framed
 * card in a grid and may carry `media`, a decorative preview drawn above its circle and label (aria-hidden: the label and the
 * description say what it is). Without the variant `media` is ignored and the list is exactly as before.
 *
 * redesign bugs F row 38: OPT-IN `requiredLabel` together with `required`. The title gets the same mark Field draws (an
 * aria-hidden asterisk and the screen-reader text) and the group gets aria-required. `required` alone is still handed to Base UI and draws
 * nothing (BusinessPaymentAccount paints its own mark inside `label`); without `required`: as before.
 */
export const RadioGroup = React.forwardRef(function ProductRadioGroup ({
  label,
  hideLabel = false,
  options,
  value,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  variant,
  disabled = false,
  required = false,
  requiredLabel,
  className,
  ...props
}, ref) {
  assertProps(label, options)
  // redesign bugs F row 38: `required` already reached Base UI before (BusinessPaymentAccount draws its own mark in `label`),
  // so the mark is drawn only when a `requiredLabel` comes with it; `required` alone behaves as it did
  const showRequiredMark = required && requiredLabel != null
  const cards = variant === 'cards'
  const direction = useProductDir()
  const baseId = React.useId()
  const titleId = `${baseId}-title`
  const groupRef = React.useRef(null)
  const setRefs = node => {
    groupRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  // redesign stores 5.18 (from 5.15b): Base UI gives the one Tab stop to the chosen radio. When that radio is disabled it
  // cannot take the focus, and the whole group fell out of the Tab order. Then the stop goes to the first enabled radio (as with a
  // value that matches no option); the focus alone chooses nothing. Checked after every render: Base UI owns the tabindex.
  React.useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    const isOff = radio => radio.disabled || radio.hasAttribute('data-disabled')
    const radios = [...group.querySelectorAll('[role="radio"]')]
    const chosen = radios.find(radio => radio.getAttribute('aria-checked') === 'true')
    const first = radios.find(radio => !isOff(radio))
    if (!chosen || !isOff(chosen) || !first) return
    radios.forEach(radio => { radio.tabIndex = radio === first ? 0 : -1 })
  })

  // Base UI's group moves with the arrows but has no Home or End: choose the first or last enabled radio.
  const onKeyDown = event => {
    props.onKeyDown?.(event)
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key !== 'Home' && event.key !== 'End') return
    const radios = [...groupRef.current.querySelectorAll('[role="radio"]:not([disabled]):not([data-disabled])')]
    const target = event.key === 'Home' ? radios[0] : radios[radios.length - 1]
    if (!target) return
    event.preventDefault()
    target.focus()
    if (target.getAttribute('aria-checked') !== 'true') target.click()
  }

  return (
    <DirectionProvider direction={direction}>
      <RadioGroupPrimitive
        {...props}
        required={required}
        aria-required={required && requiredLabel != null ? 'true' : props['aria-required']}
        ref={setRefs}
        value={value}
        defaultValue={defaultValue}
        onValueChange={next => onValueChange?.(next)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-labelledby={hideLabel ? undefined : titleId}
        aria-label={hideLabel ? label : undefined}
        data-orientation={orientation}
        data-variant={cards ? 'cards' : undefined}
        className={cx('odc-root', 'odc-radiogroup', className)}
      >
        {!hideLabel && (
          <span id={titleId} className='odc-radiogroup-title'>
            {label}
            {showRequiredMark && (
              <>
                {' '}
                <span className='odc-field-required' aria-hidden='true' title={requiredLabel}>*</span>
                <span className='odc-sr-only'>{requiredLabel}</span>
              </>
            )}
          </span>
        )}
        <div className='odc-radiogroup-options'>
          {options.map((option, index) => {
            const nameId = `${baseId}-${index}-name`
            const descriptionId = option.description != null ? `${baseId}-${index}-description` : undefined
            return (
              <RadioPrimitive.Root
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                nativeButton
                render={<button type='button' />}
                aria-labelledby={nameId}
                aria-describedby={descriptionId}
                className='odc-radio'
              >
                {cards && option.media != null && <span className='odc-radio-media' aria-hidden='true'>{option.media}</span>}
                <span className='odc-radio-box' aria-hidden='true'>
                  <RadioPrimitive.Indicator className='odc-radio-dot' keepMounted={false} />
                </span>
                <span className='odc-radio-text'>
                  <span id={nameId} className='odc-radio-label'>{option.label}</span>
                  {descriptionId && <span id={descriptionId} className='odc-radio-description'>{option.description}</span>}
                </span>
              </RadioPrimitive.Root>
            )
          })}
        </div>
      </RadioGroupPrimitive>
    </DirectionProvider>
  )
})
