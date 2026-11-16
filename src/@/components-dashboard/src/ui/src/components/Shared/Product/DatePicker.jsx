import React, { useEffect, useId, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { Button } from './Button'
import { Sheet } from './Sheet'
import { useOverlayLayer } from './Dialog'
import { usePopoverTabOut } from './FilterPopover'
import { DayCalendar } from './DayCalendar'
import { focusFrameControl, useFieldFrame } from './Field'
import { useIsPhone } from './useIsPhone'
import { cx } from './classNames'
import { tokenOffset, tokenPx } from './positioning'
import { useProductDir } from './useProductDir'
import { Calendar } from '../Icon'
import {
  dayOf,
  describeDateFormat,
  firstDayOfWeekFor,
  formatDay,
  maskDateText,
  monthOf,
  parseDateText,
  todayDay
} from '../../../../../utils/dateRange'
// The calendar, the field and the popover are dressed with the classes of the date range (`odc-dr-*`): this file
// composes them, `date-picker.css` only adds what a single day needs (disabled days, the trigger, the hit area).
import './product.css'
import './date-range.css'
import './date-picker.css'

// redesign W0-7 (T0-28): DatePicker, one day. The popover of DateRangePopover with a one-month calendar, a typed
// field in the project's date format and a bottom sheet under 768px.

const sideOffset = tokenOffset('--od-space-1')

const REQUIRED_LABELS = ['title', 'close', 'today', 'previousMonth', 'nextMonth', 'invalidDate', 'outOfRange']

/** The typed field and the calendar. Mounted only while open, so it starts from the props every time. */
const DatePanel = ({ value, spec, label, labels, locale, firstDayOfWeek, dir, isDisabled, min, max, onChange, onClose }) => {
  const fieldId = useId()
  const errorId = useId()
  const focused = useRef(false)
  const clearable = labels.clear != null
  const [text, setText] = useState(() => formatDay(value, spec))
  const [error, setError] = useState(null)
  const [month, setMonth] = useState(() => {
    const start = value || todayDay()
    return monthOf(min && start < min ? min : max && start > max ? max : start)
  })
  const wantedLength = spec.format.length

  // A change that did not come from typing rewrites the field.
  useEffect(() => {
    if (focused.current) return
    setText(current => (parseDateText(current, spec) !== value ? formatDay(value, spec) : current))
    setError(null)
  }, [value])

  const handleText = (raw) => {
    const next = maskDateText(raw, spec)
    setText(next)
    if (next === '') {
      setError(null)
      if (clearable) onChange(null)
      return
    }
    const day = parseDateText(next, spec)
    if (!day) {
      setError(spec.masked && next.length >= wantedLength ? 'format' : null)
      return
    }
    setMonth(monthOf(day)) // the calendar follows a real date, chosen or not, so the day is seen as it is refused
    if (isDisabled(day)) {
      setError('range')
      return
    }
    setError(null)
    onChange(day)
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const day = parseDateText(text, spec)
    if (day && !isDisabled(day)) {
      onChange(day)
      onClose()
    } else if (text === '' && clearable) {
      onClose()
    } else {
      setError(day ? 'range' : 'format')
    }
  }

  const handleBlur = () => {
    focused.current = false
    if (text && !parseDateText(text, spec) && !error) setError('format')
  }

  return (
    <div className='odc-dr odc-dp'>
      <div className='odc-dr-field'>
        <label htmlFor={fieldId} className='odc-dr-label'>{label}</label>
        {/* redesign tramo B r3 (W0-QB2-02): the frame of the typed field, which owns the 44px area on a phone */}
        <div className='odc-dp-input-frame' onMouseDown={event => focusFrameControl(event.currentTarget, event)}>
          <input
            id={fieldId}
            className='odc-dr-input odc-dp-input'
            dir='ltr'
            inputMode='numeric'
            autoComplete='off'
            placeholder={spec.placeholder}
            value={text}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={() => { focused.current = true }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onChange={event => handleText(event.target.value)}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} role='alert' className='odc-dr-error'>
          {error === 'range' ? labels.outOfRange : labels.invalidDate(spec.placeholder)}
        </p>
      )}
      <DayCalendar
        month={month}
        onMonthChange={setMonth}
        from={value}
        isDisabled={isDisabled}
        min={min}
        max={max}
        locale={locale}
        firstDayOfWeek={firstDayOfWeek}
        labels={labels}
        dir={dir}
        onPick={day => {
          setError(null)
          onChange(day)
          onClose()
        }}
      />
      {clearable && (
        <div className='odc-dr-foot'>
          <Button
            variant='ghost'
            data-clear=''
            onClick={() => { onChange(null); onClose() }}
          >
            {labels.clear}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * One day, picked from a field-like trigger. The trigger (32px, calendar icon) shows the day in the project's date
 * format (`dateFormat`, Decision 13: never ISO) or `placeholder`. It opens a popover (a bottom sheet under 768px) with a
 * typed field masked to that format and a one-month calendar. A day (or Enter on a valid typed date) is
 * chosen with `onChange('YYYY-MM-DD')` and closes the layer; a valid typed date is reported as it is typed.
 * Escape closes only this layer and gives the focus back to the trigger.
 *
 * Calendar keys: arrows move a day / a week, PageUp / PageDown a month (with Shift a year), Home / End the week
 * start / end, Enter or Space chooses. A day outside `min` / `max` (days as `YYYY-MM-DD`) or for which
 * `isDayDisabled(day)` is true is `aria-disabled` and `data-disabled`: focusable, never chosen.
 *
 * `label` (the name of the field) and `labels` (`title`, `close`, `today`, `previousMonth`, `nextMonth`,
 * `invalidDate(format)`, `outOfRange`, optional `clear`, `goToToday`) are required and already translated: no text is
 * its own. With `labels.clear` the field can be emptied (`onChange(null)`).
 */
export const DatePicker = ({
  value = null,
  onChange,
  min,
  max,
  isDayDisabled,
  dateFormat,
  locale,
  firstDayOfWeek,
  placeholder,
  label,
  labels,
  disabled = false,
  invalid = false,
  className,
  ...props
}) => {
  // redesign W0-7 (T0-28): missing, not empty
  if (label == null) throw new Error('DatePicker needs a label')
  if (labels == null) throw new Error('DatePicker needs labels')
  REQUIRED_LABELS.forEach(key => {
    if (labels[key] == null) throw new Error(`DatePicker needs labels.${key}`)
  })
  const dir = useProductDir()
  const phone = useIsPhone()
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const ownLabelId = useId()
  const textId = useId()
  const popupId = useId()
  // redesign tramo B r2 (W0-QB1-04): inside a Field the visible label names the trigger (no second, hidden copy of it)
  const frame = useFieldFrame()
  const labelId = frame?.labelId ?? ownLabelId
  // redesign tramo B r3 (W0-QB2-01): an error the Field gets after the first render paints the trigger invalid too, as every other control
  const isInvalid = invalid || frame?.invalid === true
  const [open, setOpen] = useState(false)
  // redesign cierre W0 (W0-PA4-01): the word months of the fields are the Intl ones of the user's language
  const spec = React.useMemo(() => describeDateFormat(dateFormat, locale), [dateFormat, locale])
  const weekStart = firstDayOfWeek ?? firstDayOfWeekFor(locale)
  const day = dayOf(value)
  const isDisabled = React.useCallback(
    (candidate) => (!!min && candidate < min) || (!!max && candidate > max) || !!isDayDisabled?.(candidate),
    [min, max, isDayDisabled]
  )
  const overlay = useOverlayLayer(open && !phone, { modal: false })
  const { layer, popupRef, lastFocusedRef, portalStyle, onOpenChangeComplete } = overlay

  const close = () => setOpen(false)
  // redesign W0-7 (T0-29): Tab out of the desktop popover closes it and goes to the next control (not in the phone sheet)
  const tabOut = usePopoverTabOut({ getOpener: () => triggerRef.current, close, layer })

  const handleOpenChange = (next, details) => {
    if (next) return
    const reason = details?.reason
    if (reason === 'outside-press' && triggerRef.current?.contains(details.event?.target)) {
      details.cancel()
      return
    }
    if (reason === 'escape-key' && !layer.isActive) {
      details.cancel()
      return
    }
    close()
  }

  // The calendar's one tab stop (the chosen day, else today): the typed field is a Shift+Tab away, so a phone
  // never opens its keyboard by itself.
  const initialFocus = () => panelRef.current?.querySelector('[data-day][tabindex="0"]') || true

  const panel = (
    <div ref={panelRef}>
      <DatePanel
        value={day}
        spec={spec}
        label={label}
        labels={labels}
        locale={locale}
        firstDayOfWeek={weekStart}
        dir={dir}
        isDisabled={isDisabled}
        min={min}
        max={max}
        onChange={onChange}
        onClose={close}
      />
    </div>
  )

  const text = day ? formatDay(day, spec) : (placeholder ?? spec.placeholder)

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type='button'
        role='combobox'
        className={cx('odc-dr-trigger', 'odc-dp-trigger', className)}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-labelledby={`${labelId} ${textId}`}
        disabled={disabled}
        data-empty={day ? undefined : ''}
        data-invalid={isInvalid ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        onClick={() => { tabOut.reset(); setOpen(current => !current) }}
      >
        {!frame?.labelId && <span id={ownLabelId} className='odc-sr-only'>{label}</span>}
        <Calendar className='odc-icon odc-dp-trigger-icon' aria-hidden='true' />
        <span id={textId} className='odc-dr-trigger-text odc-figure' title={day ? text : undefined}>{text}</span>
      </button>
      {phone
        ? (
          <Sheet
            open={open}
            onOpenChange={setOpen}
            title={labels.title}
            closeLabel={labels.close}
            side='bottom'
            id={popupId}
            className='odc-dr-sheet odc-dp-sheet'
            initialFocus={initialFocus}
          >
            {panel}
          </Sheet>
          )
        : layer.ready && (
          <PopoverPrimitive.Root open={open} modal={false} onOpenChange={handleOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
            <PopoverPrimitive.Portal container={layer.host} className='odc-root odc-overlay-portal' style={portalStyle} dir={dir}>
              <PopoverPrimitive.Positioner
                anchor={triggerRef}
                side='bottom'
                align='start'
                sideOffset={sideOffset}
                collisionPadding={tokenPx('--od-x-viewport-gap')}
                positionMethod='fixed'
                className='odc-dr-positioner'
              >
                <PopoverPrimitive.Popup
                  ref={popupRef}
                  id={popupId}
                  aria-label={labels.title}
                  dir={dir}
                  className='odc-dr-popup odc-dp-popup'
                  initialFocus={initialFocus}
                  finalFocus={tabOut.finalFocus}
                  onKeyDown={tabOut.onKeyDown}
                  onFocusCapture={event => { lastFocusedRef.current = event.target }}
                >
                  {panel}
                </PopoverPrimitive.Popup>
              </PopoverPrimitive.Positioner>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        )}
    </>
  )
}
