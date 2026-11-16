// Adapted from shadcn/ui Base UI select, commit
// 7c9eaba1c0a6404c990c144a654792e3313c650d (MIT).
import React, { useEffect, useRef, useState } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'

import { Check, ChevronDown } from '../Icon'
import { LegacySelect } from './LegacySelect'
import { useOrderingUI } from './theme'

const optionForValue = (options, value) => options.find(option => option.value === value)
const EMPTY_VALUE = '__od_select_no_value__'

const textFromNode = node => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join(' ').trim()
  if (React.isValidElement(node)) return textFromNode(node.props.children)
  return ''
}

/**
 * T1 Select contract. This intentionally covers the scalar FirstSelect surface
 * used by the pilot; search, pagination, edit/delete actions and multi-select
 * remain on their existing implementations.
 */
const PilotSelect = React.forwardRef(function OrderingPilotSelect ({
  options = [],
  defaultValue,
  onChange,
  notAsync = false,
  noSelected = false,
  isDisabled = false,
  className,
  placeholder,
  type,
  position = 'right'
}, ref) {
  const { style, dir } = useOrderingUI()
  const [value, setValue] = useState(defaultValue)
  const keyboardRepeatRef = useRef(false)

  useEffect(() => {
    if (!notAsync) setValue(defaultValue)
  }, [defaultValue, notAsync, options])

  const selectedOption = value === null || value === undefined
    ? undefined
    : optionForValue(options, value)
  const accessibleName = textFromNode(
    selectedOption
      ? (selectedOption.showOnSelected || selectedOption.content)
      : placeholder
  )
  const align = position?.toLowerCase() === 'left' ? 'start' : 'end'

  const handleValueChange = nextValue => {
    // Base UI may report an item press for the active value. The explicit item
    // click below owns that legacy re-selection callback so it cannot double.
    if (Object.is(nextValue, value)) return
    if (!noSelected) setValue(nextValue)
    onChange?.(nextValue)
  }

  const handleItemClick = option => {
    if (option.disabled || option.value === null) return
    if (!Object.is(option.value, value)) return
    if (keyboardRepeatRef.current) {
      keyboardRepeatRef.current = false
      return
    }
    onChange?.(option.value)
  }

  const handleItemKeyDown = (event, option) => {
    if (option.disabled || option.value === null) return
    if (!Object.is(option.value, value)) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    keyboardRepeatRef.current = true
    onChange?.(option.value)
    window.setTimeout(() => {
      keyboardRepeatRef.current = false
    }, 0)
  }

  return (
    <div
      className={`od-ui select od-relative od-inline-block od-max-w-full${className ? ` ${className}` : ''}`}
      style={style}
      dir={dir}
      data-type={type || undefined}
      data-slot='select-root'
    >
      <SelectPrimitive.Root
        value={value === undefined || value === null ? EMPTY_VALUE : value}
        onValueChange={handleValueChange}
        disabled={isDisabled}
        modal={false}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          className='od-control od-flex od-w-full od-items-center od-justify-between od-gap-2'
          data-type={type || undefined}
          aria-label={accessibleName || undefined}
        >
          <SelectPrimitive.Value>
            {currentValue => {
              const currentOption = currentValue === EMPTY_VALUE
                ? undefined
                : optionForValue(options, currentValue)
              return currentOption
                ? (currentOption.showOnSelected || currentOption.content)
                : (placeholder || '')
            }}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon>
            <ChevronDown />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal className='od-ui' style={style} dir={dir}>
          <SelectPrimitive.Positioner
            className='od-select-positioner'
            side='bottom'
            sideOffset={7}
            align={align}
            alignItemWithTrigger={false}
          >
            <SelectPrimitive.Popup
              className='od-ui od-select-popup'
              style={style}
              dir={dir}
            >
              <SelectPrimitive.List>
                {options.map((option, index) => {
                  const disabled = Boolean(option.disabled || option.value === null)
                  return (
                    <SelectPrimitive.Item
                      key={index}
                      value={option.value}
                      disabled={disabled}
                      className='od-select-option od-flex od-w-full od-items-center od-justify-between od-gap-2'
                      onClick={() => handleItemClick(option)}
                      onKeyDown={event => handleItemKeyDown(event, option)}
                    >
                      <SelectPrimitive.ItemText>
                        {option.content}
                      </SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator>
                        <Check />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  )
                })}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
})

PilotSelect.displayName = 'OrderingPilotSelect'

export const Select = React.forwardRef(function OrderingSelect (props, ref) {
  if (props.compatibility === 'legacy-select') return <LegacySelect {...props} />
  return <PilotSelect {...props} ref={ref} />
})

Select.displayName = 'OrderingSelect'
