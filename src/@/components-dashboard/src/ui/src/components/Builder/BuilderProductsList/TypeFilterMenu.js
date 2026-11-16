import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Checkbox, FilterPopover, PopoverFoot } from '../../Shared/Product'
import { BUILDER_KINDS, BUILDER_TYPE_OPTIONS, getTypeFilterLabel } from '../utils'

// redesign B4: the Builder styled menu becomes a Product filter pill (P/FilterPopover, the house pick-many filter:
// P/Menu has no checkboxes and closes on a pick). Escape and a press elsewhere close it with the focus back on the pill.

/**
 * The type filter of the list: a «Type» pill that opens the types
 * grouped in Apps and Websites, each with a shortcut for the whole group.
 * `value` is the list of types on; empty means every type.
 */
export const TypeFilterMenu = ({ value = [], onChange }) => {
  const [, t] = useLanguage()

  const toggle = (type) => {
    onChange(value.includes(type) ? value.filter(item => item !== type) : [...value, type])
  }

  const toggleGroup = (types, allOn) => {
    onChange(allOn
      ? value.filter(item => !types.includes(item))
      : [...value.filter(item => !types.includes(item)), ...types])
  }

  return (
    <FilterPopover
      label={t('BUILDER_TYPE', 'Type')}
      value={value.length ? getTypeFilterLabel(value, t) : undefined}
      popupClassName='odc-builder-type-popover'
    >
      {BUILDER_KINDS.map(kind => {
        const types = BUILDER_TYPE_OPTIONS.filter(option => option.kind === kind.value)
        const values = types.map(option => option.value)
        const allOn = values.every(item => value.includes(item))
        return (
          <fieldset key={kind.value} className='odc-builder-type-group'>
            <legend>
              {kind.label(t)}
              <Button variant='link' size='sm' onClick={() => toggleGroup(values, allOn)}>
                {allOn ? t('BUILDER_CLEAR', 'Clear') : t('BUILDER_SELECT_ALL', 'Select all')}
              </Button>
            </legend>
            {types.map(option => (
              <Checkbox key={option.value} checked={value.includes(option.value)} onCheckedChange={() => toggle(option.value)}>{option.label(t)}</Checkbox>
            ))}
          </fieldset>
        )
      })}
      {value.length > 0 && <PopoverFoot clearLabel={t('BUILDER_ALL_TYPES', 'All types')} onClear={() => onChange([])} />}
    </FilterPopover>
  )
}
