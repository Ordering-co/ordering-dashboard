import React, { useRef } from 'react'
import { useLanguage } from '../../../../../index'
import { Button, NumberField } from '../../Shared/Product'
import './catering-delivery.css'

// redesign stores 5.4 · Preorders: one fieldset per catering order type with the five lead-time configs.
// It owns no state: the section (BusinessPreorderDetails) keeps the draft and the save. The five configs of the project store
// every order type in one string ("delivery,0|pickup,0|catering_delivery,5|catering_pickup,5"); this piece edits the segment of
// ONE type and the helpers below (used by the section too) never touch the others.

/** The order types this piece edits, in the order the section paints them. */
export const CATERING_TYPES = ['catering_delivery', 'catering_pickup']

/** The five configs, in paint order. `asap`: a default of 0 means «allows asap orders». */
export const CATERING_FIELDS = [
  { key: 'preorder_lead_time', labelKey: 'LEAD_TIMES_PER_ORDER_TYPE', label: 'Lead times per order type', unit: 'minutes', defaultValue: 0, asap: true },
  { key: 'preorder_slot_interval', labelKey: 'SLOT_TIMES', label: 'Slot times', unit: 'minutes', defaultValue: 30 },
  { key: 'preorder_time_range', labelKey: 'TIME_RANGE', label: 'Time range', unit: 'minutes', defaultValue: 30 },
  { key: 'preorder_minimum_days', labelKey: 'MINIMUM_DAYS_PREORDER_ORDER_TYPE', label: 'Minimum days to preorder per order type', unit: 'days', defaultValue: 0, asap: true },
  { key: 'preorder_maximum_days', labelKey: 'MAXIMUM_DAYS', label: 'Maximum days', unit: 'days', defaultValue: 15 }
]

/** The key of a field of a type in the section's draft and errors. */
export const cateringDraftKey = (type, key) => `${type}:${key}`

export const findCateringConfig = (configs, key) => (Array.isArray(configs) ? configs : []).find(config => config?.key === key)

// A segment is told by its exact key («catering_pickup», never a text that merely contains it).
const segmentsOf = config => (typeof config?.value === 'string' && config.value ? config.value.split('|') : [])

/** The saved whole number of the segment of `type` in `config`, or null (no config, no segment, or not a whole number). */
export const readCateringSegment = (config, type) => {
  const segment = segmentsOf(config).find(seg => seg.split(',')[0] === type)
  const text = segment == null ? '' : segment.split(',')[1]
  return typeof text === 'string' && /^\d+$/.test(text.trim()) ? Number(text) : null
}

/**
 * The string of `config` with the segments of `changes` (`{ [type]: number }`) replaced. The other segments stay as they are;
 * a type without a segment is added at the end.
 */
export const withCateringSegments = (config, changes) => {
  let segments = segmentsOf(config)
  Object.entries(changes).forEach(([type, value]) => {
    const segment = `${type},${value}`
    segments = segments.some(seg => seg.split(',')[0] === type)
      ? segments.map(seg => (seg.split(',')[0] === type ? segment : seg))
      : [...segments, segment]
  })
  return segments.join('|')
}

export const BusinessCateringDelivery = (props) => {
  const {
    business,
    type,
    draft = {},
    errors = {},
    disabled,
    onChange,
    onUseDefault
  } = props
  const [, t] = useLanguage()
  const inputs = useRef({})

  const legend = type === 'catering_delivery' ? t('CATERING_DELIVERY', 'Catering delivery') : t('CATERING_PICKUP', 'Catering pickup')

  const unitName = unit => (unit === 'days' ? t('DAYS', 'Days') : t('MINUTES', 'Minutes'))
  const hintOf = field => {
    const prefix = `${t('DEFAULT', 'Default')} = ${field.defaultValue}`
    if (field.asap) return `${prefix} (${t('ALLOWS_ASAP_ORDERS', 'allows asap orders')}).`
    if (field.unit === 'days') return `${prefix} ${t('DAYS', 'Days')}${field.key === 'preorder_maximum_days' ? '' : '.'}`
    return `${prefix} ${t('MINUTES', 'minutes')}.`
  }

  const applyDefault = (field, draftKey) => {
    onUseDefault?.(draftKey, field.defaultValue)
    // the button goes away once the value is the default: the focus goes to the field instead of falling to the page
    inputs.current[field.key]?.focus()
  }

  return (
    <fieldset className='odc-store-preorder-set' data-type={type}>
      <legend className='odc-store-preorder-legend'>{legend}</legend>
      <div className='odc-store-preorder-grid'>
        {CATERING_FIELDS.map(field => {
          const config = findCateringConfig(business?.configs, field.key)
          const draftKey = cateringDraftKey(type, field.key)
          const saved = readCateringSegment(config, type)
          const current = draftKey in draft ? draft[draftKey] : saved
          const label = `${t(field.labelKey, field.label)} (${unitName(field.unit)})`
          return (
            <div className='odc-store-preorder-item' key={field.key}>
              <NumberField
                ref={node => { inputs.current[field.key] = node }}
                label={label}
                hint={hintOf(field)}
                error={errors[draftKey]}
                value={current}
                min={0}
                step={1}
                // the config does not exist in this project: there is nowhere to write it
                disabled={!config || disabled}
                onChange={value => onChange?.(draftKey, value)}
              />
              {config && current !== field.defaultValue && (
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={disabled}
                  aria-label={`${t('USE_DEFAULT_VALUE', 'Use default value')}, ${label}`}
                  onClick={() => applyDefault(field, draftKey)}
                >
                  {t('USE_DEFAULT_VALUE', 'Use default value')}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
