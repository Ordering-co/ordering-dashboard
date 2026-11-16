import React, { useId, useState } from 'react'

// The context by file (as ScheduleEditor), not the components-dashboard index: the barrel must not reach bootstrap (W0-7).
import { useConfig } from '../../../../../contexts/ConfigContext'
import { Field, focusFrameControl, useFieldFrame } from './Field'
import { cx } from './classNames'
import './product.css'
import './time-field.css'

// redesign 2.E
/*
 * A time of day or a duration, in two native <select>s (hour and minute) inside a labelled group, framed by Field.
 *
 * `mode`: 'duration' (default) reads «2 h 30 min»: the hours are plain «0».. «23», each select has its unit after it, and the
 * wrapper NEVER reads AM/PM. 'time' is a time of day: «:» between the selects, and the hour follows `general_hour_format`
 * with the rule of ScheduleEditor (the format contains `hh:mm` -> 12 h: one select of 24 options «12 AM» .. «11 PM»,
 * values 0-23; otherwise «00» .. «23»). 12/24 h is read only in time mode. Delivery and Pickup (`"H:M"`) and Preorder
 * (`valueFormat='minutes'`) are durations; the catalog's `duration` (minutes) is too.
 *
 * Value: `value` / `defaultValue` / `onChange(next)`, controlled or not. `valueFormat` 'hm' (default) is the string "H:M"
 * (reads "02:05", "2:5", "2:05", and "H:M:S" with the seconds dropped as today; writes it UNPADDED, "2:5": the format
 * saved today); 'minutes' is an integer of minutes (a numeric string is read too). null, undefined, '' and garbage
 * read as 0:0 (and emit nothing). It emits only on a user change, never on mount, and changing the hour keeps
 * the minute and vice versa. Range: hours 0-23, minutes 0-59, step 1. A value outside it (a saved «30:00», 1500 minutes,
 * minute 75) is never changed on its own: it is added as the last option of its select so it shows selected, and it
 * is only replaced when the user picks something.
 *
 * `is12Hours` (optional boolean, time mode only): when given it decides 12/24 h instead of `general_hour_format` (Snooze follows
 * the project's `format_time`, like the hours of its options). Omitted (or undefined), the format is read as above.
 *
 * It has no text of its own (a Product wrapper): `hourLabel` and `minuteLabel` (the selects' accessible names), `hoursUnit`
 * and `minutesUnit` (duration), `amLabel` and `pmLabel` (time in 12 h) arrive already translated. One that is needed and
 * missing (`== null`) throws; an empty string paints empty (W0-Q1-01).
 *
 * Frame props (`label`, `hint`, `error`, `required`, `requiredLabel`, `disabled`, `name`, `invalid`, `fieldClassName`,
 * `aria-label`) go to Field as TextField does; `id` and the ref go to the hour select (the one the label points at); `name` gives the
 * selects `${name}-hour` and `${name}-minute`. Field links the hint, the error and the required mark to the first control
 * only, so the wrapper writes them on both selects (`useFieldFrame().describedBy`, `invalid`, `required`); with a visible
 * label each select is named «<label> <hourLabel|minuteLabel>» («Delivery time Hours»), without one `aria-label` is used. The selects are 32px; under 768px (or with a coarse pointer) each one's
 * frame reaches a 44px area (decision 12) and the text is 16px so iOS does not zoom.
 */

const MODES = ['duration', 'time']
const FORMATS = ['hm', 'minutes']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute)
const LAST_HOUR = 23
const LAST_MINUTE = 59

const pad = value => (value < 10 ? `0${value}` : String(value))

const requireText = (name, text) => {
  if (text == null) throw new Error(`TimeField needs a ${name}`)
}

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
  if (label == null && rest['aria-label'] == null) throw new Error('TimeField needs a label')
  if (required && requiredLabel == null) throw new Error('TimeField needs a requiredLabel')
  return {
    frame: { label, hint, error, required, requiredLabel, disabled, name, invalid, 'aria-label': rest['aria-label'], className: fieldClassName, ...fieldProps },
    rest
  }
}

const wholeNumber = part => {
  const number = parseInt(part, 10)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const readValue = (value, valueFormat) => {
  if (valueFormat === 'minutes') {
    const total = Math.floor(Number(value))
    const minutes = Number.isFinite(total) && total > 0 ? total : 0
    return { hour: Math.floor(minutes / 60), minute: minutes % 60 }
  }
  const [hour, minute] = String(value ?? '').split(':')
  return { hour: wholeNumber(hour), minute: wholeNumber(minute) }
}

const writeValue = ({ hour, minute }, valueFormat) => (valueFormat === 'minutes' ? hour * 60 + minute : `${hour}:${minute}`)

/**
 * A native select inside a frame that owns the phone's 44px area; a press on the frame itself focuses the select.
 * With a visible label the name is «<label> <own name>» (aria-labelledby over the label and an sr-only span holding the
 * part's name), so «Hours» is heard in the context of «Delivery time»; without one it is `aria-label`.
 */
const TimePart = React.forwardRef(function TimePart ({ unit, label, groupLabelId, value, options, id, name, disabled, invalid, required, describedBy, onChange }, ref) {
  const nameId = useId()
  return (
    <span className='odc-time-field-part' onMouseDown={event => focusFrameControl(event.currentTarget, event, 'select')}>
      <select
        ref={ref}
        className='odc-time-field-select odc-figure'
        id={id}
        name={name}
        aria-label={groupLabelId ? undefined : label}
        aria-labelledby={groupLabelId ? `${groupLabelId} ${nameId}` : undefined}
        aria-describedby={describedBy ?? undefined}
        aria-invalid={invalid ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        data-unit={unit}
        disabled={disabled}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.text}</option>)}
      </select>
      {groupLabelId && <span id={nameId} className='odc-sr-only'>{label}</span>}
    </span>
  )
})

// Inside Field, to read the frame (the visible label's id, invalid, required) it provides.
const TimeFieldBody = ({
  hourRef,
  mode,
  current,
  onPick,
  is12Hours,
  hourLabel,
  minuteLabel,
  hoursUnit,
  minutesUnit,
  amLabel,
  pmLabel,
  id,
  name,
  disabled,
  ariaLabel,
  className,
  rest
}) => {
  const frame = useFieldFrame()
  const labelId = frame?.labelId ?? null

  const formatHour = hour => {
    if (is12Hours) {
      const suffix = hour < 12 ? amLabel : pmLabel
      return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`.trim()
    }
    return mode === 'time' ? pad(hour) : String(hour)
  }
  // A value past the range is the last option, painted plainly (a «30 PM» would read as another time).
  const hourOptions = [
    ...HOURS.map(hour => ({ value: hour, text: formatHour(hour) })),
    ...(current.hour > LAST_HOUR ? [{ value: current.hour, text: mode === 'time' ? pad(current.hour) : String(current.hour) }] : [])
  ]
  const minuteOptions = [
    ...MINUTES.map(minute => ({ value: minute, text: pad(minute) })),
    ...(current.minute > LAST_MINUTE ? [{ value: current.minute, text: pad(current.minute) }] : [])
  ]
  const shared = { disabled, groupLabelId: labelId, invalid: frame?.invalid, required: frame?.required, describedBy: frame?.describedBy }

  return (
    <div
      {...rest}
      className={cx('odc-time-field', className)}
      role='group'
      aria-labelledby={labelId ?? undefined}
      aria-label={labelId ? undefined : ariaLabel}
      data-mode={mode}
    >
      <TimePart
        {...shared}
        ref={hourRef}
        unit='hour'
        label={hourLabel}
        id={id}
        name={name != null ? `${name}-hour` : undefined}
        value={current.hour}
        options={hourOptions}
        onChange={hour => onPick({ hour, minute: current.minute })}
      />
      {mode === 'duration'
        ? <span className='odc-time-field-unit' aria-hidden='true'>{hoursUnit}</span>
        : <span className='odc-time-field-separator' aria-hidden='true'>:</span>}
      <TimePart
        {...shared}
        unit='minute'
        label={minuteLabel}
        name={name != null ? `${name}-minute` : undefined}
        value={current.minute}
        options={minuteOptions}
        onChange={minute => onPick({ hour: current.hour, minute })}
      />
      {mode === 'duration' && <span className='odc-time-field-unit' aria-hidden='true'>{minutesUnit}</span>}
    </div>
  )
}

/** Time of day or duration; see the header of this file. `onChange(next)` gets "H:M" or integer minutes (`valueFormat`). */
export const TimeField = React.forwardRef(function ProductTimeField ({
  mode = 'duration',
  value,
  defaultValue,
  onChange,
  valueFormat = 'hm',
  hourLabel,
  minuteLabel,
  hoursUnit,
  minutesUnit,
  amLabel,
  pmLabel,
  is12Hours: is12HoursProp,
  className,
  id,
  ...props
}, ref) {
  const { frame, rest: { 'aria-label': ariaLabel, ...rest } } = splitFrame(props)
  const [{ configs }] = useConfig()
  if (!MODES.includes(mode)) throw new Error(`TimeField mode must be one of ${MODES.join(', ')}`)
  if (!FORMATS.includes(valueFormat)) throw new Error(`TimeField valueFormat must be one of ${FORMATS.join(', ')}`)
  requireText('hourLabel', hourLabel)
  requireText('minuteLabel', minuteLabel)
  // Only a time of day follows the project's format; a duration never reads AM/PM. A caller that writes its other times with a
  // different setting (Snooze: `format_time`) passes `is12Hours`, which then wins over `general_hour_format`; omitted, it is read as before.
  const is12Hours = mode === 'time' && (is12HoursProp ?? !!configs?.general_hour_format?.value?.includes('hh:mm'))
  if (mode === 'duration') {
    requireText('hoursUnit', hoursUnit)
    requireText('minutesUnit', minutesUnit)
  }
  if (is12Hours) {
    requireText('amLabel', amLabel)
    requireText('pmLabel', pmLabel)
  }

  const controlled = value !== undefined
  const [inner, setInner] = useState(() => readValue(defaultValue, valueFormat))
  const current = controlled ? readValue(value, valueFormat) : inner
  const onPick = next => {
    if (!controlled) setInner(next)
    onChange?.(writeValue(next, valueFormat))
  }

  return (
    <Field {...frame}>
      <TimeFieldBody
        hourRef={ref}
        mode={mode}
        current={current}
        onPick={onPick}
        is12Hours={is12Hours}
        hourLabel={hourLabel}
        minuteLabel={minuteLabel}
        hoursUnit={hoursUnit}
        minutesUnit={minutesUnit}
        amLabel={amLabel}
        pmLabel={pmLabel}
        id={id}
        name={frame.name}
        disabled={frame.disabled}
        ariaLabel={ariaLabel}
        className={className}
        rest={rest}
      />
    </Field>
  )
})
