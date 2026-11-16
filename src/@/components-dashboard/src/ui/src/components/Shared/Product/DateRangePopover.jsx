import React, { useEffect, useId, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { Sheet } from './Sheet'
import { useOverlayLayer } from './Dialog'
import { usePopoverTabOut } from './FilterPopover'
import { Button } from './Button'
import { DayCalendar } from './DayCalendar'
import { useIsPhone } from './useIsPhone'
import { cx } from './classNames'
import { tokenOffset, tokenPx } from './positioning'
import { useProductDir } from './useProductDir'
import { Check, ChevronDown } from '../Icon'
import {
  describeDateFormat,
  firstDayOfWeekFor,
  formatDay,
  maskDateText,
  monthOf,
  parseDateText,
  pickDay,
  todayDay
} from '../../../../../utils/dateRange'
import './date-range.css'

// redesign W0-2b (T0-5): promoted from Orders/DateTypeSelector, no behavior change.
// redesign fix-qa: the date range of the filters (E1). Brand popover on Base UI Popover (a bottom
// Sheet under 768px) with the presets, two typed fields (From / To) and a calendar of buttons.

const sideOffset = tokenOffset('--od-space-1')
// redesign W0-4b (D-25): same rule as the filter pill popovers: flip the side, shift along the edge, never flip the alignment.
const collisionAvoidance = { side: 'flip', align: 'shift' }

/**
 * Presets, the two typed fields and the calendar. Mounted only while open, so it starts from the props every time.
 *
 * `hold` (redesign F6c-1, P3-05 / Q2-28): the range is a draft of the panel. The calendar and the fields change the
 * draft only, and «Done» hands it over once (`onDone(draft)`). Without `hold` every valid change goes out at once
 * through `onRange`, as the Filters sheet always did.
 */
const DateRangePanel = ({ presets, presetValue, from: savedFrom, to: savedTo, hold, spec, labels, locale, dir, today, onPreset, onRange, onDone }) => {
  const [draft, setDraft] = useState({ from: savedFrom, to: savedTo })
  const from = hold ? draft.from : savedFrom
  const to = hold ? draft.to : savedTo
  const emitRange = hold ? setDraft : onRange
  const fromId = useId()
  const toId = useId()
  const errorId = useId()
  const focused = useRef(null)
  const [texts, setTexts] = useState(() => ({ from: formatDay(from, spec), to: formatDay(to, spec) }))
  const [errors, setErrors] = useState({ from: null, to: null })
  const firstDayOfWeek = React.useMemo(() => firstDayOfWeekFor(locale), [locale])
  const [month, setMonth] = useState(() => monthOf(from || to || today || todayDay()))

  // A change that did not come from typing (the calendar, a preset) rewrites the field that is not being typed in.
  useEffect(() => {
    setTexts(current => {
      const next = { ...current }
      if (focused.current !== 'from' && parseDateText(current.from, spec) !== from) next.from = formatDay(from, spec)
      if (focused.current !== 'to' && parseDateText(current.to, spec) !== to) next.to = formatDay(to, spec)
      return next
    })
    setErrors(current => ({
      from: focused.current === 'from' ? current.from : null,
      to: focused.current === 'to' ? current.to : null
    }))
  }, [from, to])

  const fieldDefs = [
    { key: 'from', id: fromId, label: labels.from },
    { key: 'to', id: toId, label: labels.to }
  ]
  const wantedLength = spec.format.length

  const setError = (key, error) => setErrors(current => ({ ...current, [key]: error }))

  // R-02: the other field's value is what it SHOWS when that parses, not only what is stored. A From typed after To
  // is refused (it is never emitted), so the stored one is the old From; reading it here sent the range out with the old
  // From and the effect above then rewrote the typed text back to it.
  const shownDay = (key) => parseDateText(texts[key], spec) || (key === 'from' ? from : to)

  const handleText = (key, raw) => {
    const text = maskDateText(raw, spec)
    setTexts(current => ({ ...current, [key]: text }))
    const otherKey = key === 'from' ? 'to' : 'from'
    if (text === '') {
      setError(key, null)
      emitRange({ from: key === 'from' ? null : shownDay('from'), to: key === 'to' ? null : shownDay('to') })
      return
    }
    const day = parseDateText(text, spec)
    if (!day) {
      setError(key, spec.masked && text.length >= wantedLength ? 'format' : null)
      return
    }
    const other = shownDay(otherKey)
    if (other && (key === 'from' ? day > other : day < other)) {
      setError(key, 'order')
      return
    }
    // a valid range: no field is left with an order error (the other one may have carried it)
    setErrors({ from: null, to: null })
    setMonth(monthOf(day))
    emitRange({ from: key === 'from' ? day : other, to: key === 'to' ? day : other })
  }

  const handleBlur = (key) => {
    focused.current = null
    if (texts[key] && !parseDateText(texts[key], spec) && !errors[key]) setError(key, 'format')
  }

  const message = errors.from || errors.to
  const messageText = message === 'order' ? labels.rangeOrder : message ? labels.invalidDate(spec.placeholder) : ''

  return (
    <div className='odc-dr'>
      <div className='odc-dr-presets' role='group' aria-label={labels.presets}>
        {presets.map((preset, index) => (
          <button
            key={preset.value}
            type='button'
            className='odc-dr-preset'
            aria-pressed={presetValue === preset.value}
            data-initial-focus={index === 0 ? '' : undefined}
            onClick={() => onPreset(preset.value)}
          >
            {presetValue === preset.value && <Check className='odc-icon' />}
            {preset.label}
          </button>
        ))}
      </div>
      <div className='odc-dr-fields'>
        {fieldDefs.map(({ key, id, label }) => (
          <div key={key} className='odc-dr-field'>
            <label htmlFor={id} className='odc-dr-label'>{label}</label>
            <input
              id={id}
              className='odc-dr-input'
              dir='ltr'
              inputMode='numeric'
              autoComplete='off'
              placeholder={spec.placeholder}
              value={texts[key]}
              aria-invalid={errors[key] ? 'true' : undefined}
              aria-describedby={errors[key] ? errorId : undefined}
              onFocus={() => { focused.current = key }}
              onBlur={() => handleBlur(key)}
              onChange={event => handleText(key, event.target.value)}
            />
          </div>
        ))}
      </div>
      {message && <p id={errorId} role='alert' className='odc-dr-error'>{messageText}</p>}
      <DayCalendar
        month={month}
        onMonthChange={setMonth}
        from={from}
        to={to}
        locale={locale}
        firstDayOfWeek={firstDayOfWeek}
        labels={labels}
        dir={dir}
        today={today}
        onPick={day => {
          setErrors({ from: null, to: null })
          emitRange(pickDay({ from, to }, day))
        }}
      />
      {/* redesign W0-2 r2 (W0-Q1-03): on a phone the foot is the only way to hand a held draft over; see date-range.css */}
      <div className='odc-dr-foot' data-hold={hold ? '' : undefined}>
        <Button variant='primary' onClick={() => onDone(hold ? draft : null)}>{labels.done}</Button>
      </div>
    </div>
  )
}

/**
 * The picker of the Date filter: a field-like trigger that opens the presets (Any, Today, …), the
 * From / To fields and the calendar. Presets close it; the fields and the calendar keep it open
 * and report each valid change through `onRange({ from, to })` (days as `YYYY-MM-DD`, `null` when
 * empty). Escape closes only this layer and gives the focus back to the trigger. Under 768px it is
 * a bottom sheet. All text comes in `labels`.
 *
 * `onApplyRange({ from, to })` (redesign F6c-1) makes a custom range a draft: the calendar and the fields do not call
 * `onRange`; «Done» calls `onApplyRange` once with the range (only when it differs from `from` / `to`), and leaving
 * with Escape, a press outside or the close button applies nothing. Presets still apply at once.
 *
 * `today` (optional, `YYYY-MM-DD`) is the day the calendar marks as today and opens on when there is no range; without it,
 * the browser's day. redesign (row 71, Q-09): a report in another zone passes the day of that zone.
 *
 * `renderTrigger({ ref, expanded, toggle })` replaces the field-like trigger (the Date pill of the filter
 * bar, redesign F1b): `ref` goes on the node the popover anchors to and a press on it is not an outside
 * press; `align` places the popover against that node (`end` by default, `start` under a pill).
 */
export const DateRangePopover = ({
  presets,
  presetValue,
  from = null,
  to = null,
  dateFormat,
  triggerText,
  empty = false,
  labels,
  locale,
  onPreset,
  onRange,
  onApplyRange,
  renderTrigger,
  align = 'end',
  today,
  className
}) => {
  const dir = useProductDir()
  const phone = useIsPhone()
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  // redesign cierre W0 (W0-PA4-01): the word months of the fields are the Intl ones of the user's language
  const spec = React.useMemo(() => describeDateFormat(dateFormat, locale), [dateFormat, locale])
  const overlay = useOverlayLayer(open && !phone, { modal: false })
  const { layer, popupRef, lastFocusedRef, portalStyle, onOpenChangeComplete } = overlay

  const close = () => setOpen(false)
  // redesign tramo A (W0-Q2-03): Tab out of the desktop popover closes it and goes to the next control, as the pill lists do
  const tabOut = usePopoverTabOut({ getOpener: () => triggerRef.current, close, layer })
  const toggle = () => { tabOut.reset(); setOpen(current => !current) }

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

  const initialFocus = () => panelRef.current?.querySelector('[data-initial-focus]') || true

  const panel = (
    <div ref={panelRef}>
      <DateRangePanel
        presets={presets}
        presetValue={presetValue}
        from={from}
        to={to}
        spec={spec}
        labels={labels}
        locale={locale}
        dir={dir}
        today={today}
        onPreset={(value) => { onPreset(value); close() }}
        hold={typeof onApplyRange === 'function'}
        onRange={onRange}
        onDone={(range) => {
          if (range && (range.from !== from || range.to !== to)) onApplyRange(range)
          close()
        }}
      />
    </div>
  )

  return (
    <>
      {renderTrigger
        ? renderTrigger({ ref: triggerRef, expanded: open, toggle })
        : (
          <button
            ref={triggerRef}
            type='button'
            className={cx('odc-dr-trigger', className)}
            aria-haspopup='dialog'
            aria-expanded={open}
            data-empty={empty ? '' : undefined}
            onClick={toggle}
          >
            <span className='odc-dr-trigger-text' title={empty ? undefined : triggerText}>{triggerText}</span>
            <ChevronDown className='odc-icon odc-dr-trigger-chevron' aria-hidden='true' />
          </button>
          )}
      {phone
        ? (
          <Sheet
            open={open}
            onOpenChange={setOpen}
            title={labels.title}
            closeLabel={labels.close}
            side='bottom'
            className='odc-dr-sheet'
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
                align={align}
                sideOffset={sideOffset}
                collisionAvoidance={collisionAvoidance}
                collisionPadding={tokenPx('--od-x-viewport-gap')}
                positionMethod='fixed'
                className='odc-dr-positioner'
              >
                <PopoverPrimitive.Popup
                  ref={popupRef}
                  aria-label={labels.title}
                  dir={dir}
                  className='odc-dr-popup'
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
