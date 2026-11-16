import React, { useEffect, useState } from 'react'

// The controller by file (it only imports react), not the components-dashboard index: the barrel must not reach bootstrap (W0-7).
import { Schedule as ScheduleController } from '../../../../../components/Schedule'
import { useConfig } from '../../../../../contexts/ConfigContext'
import { useUtils } from '../../../../../contexts/UtilsContext'
import { Copy, Plus, Trash2 } from '../Icon'
import { AlertDialog } from './AlertDialog'
import { Button, IconButton } from './Button'
import { Checkbox } from './Checkbox'
import { ConfirmDialog, Dialog } from './Dialog'
import { focusFrameControl } from './Field'
import { Switch } from './Switch'
import { cx } from './classNames'
import './product.css'
import './schedule-editor.css'

// redesign SL-F3 (C)
/*
 * Weekly opening hours: the Product UIComponent for the Schedule controller (`C/components/Schedule`, untouched: the
 * same handlers as the legacy `Shared/UI/Schedule.jsx`, 12 consumers keep that one).
 *
 * One row per day: the day name, an open/closed Switch, the lapses of that day on one line (four native <select>s, each
 * with an accessible name: open hour, open minute, close hour, close minute; hour and minute go to
 * `handleChangeScheduleTime` separately, as before), a delete button when the day has more than one lapse (it asks first),
 * «Add hours» and «Copy hours to…» (a dialog with the days to choose). Conflicts and invalid times from the controller
 * (`isConflict`, `isTimeChangeError`) open an alert dialog. 12 or 24 hours follows `configs.general_hour_format`.
 *
 * It has no text of its own (a Product wrapper): `labels` carries all of it, already translated. A label that is missing
 * (`== null`) throws; an empty string paints empty (W0-Q1-01). `labels.days` has the seven names from Sunday;
 * `labels.daysAbbreviated` is required only with `useDaysAbbrevation`; `labels.copyDays` (optional) names the days in the
 * copy dialog when they are not the same words as `days`.
 *
 * The time selects are 32px; under 768px (or with a coarse pointer) their frame reaches a 44px area (decision 12) and the
 * text is 16px so iOS does not zoom.
 */

const REQUIRED_LABELS = [
  'schedule', 'open', 'close', 'hour', 'minute', 'am', 'pm', 'unavailable', 'addHours', 'copyHours', 'copyTitle',
  'apply', 'cancel', 'delete', 'deleteQuestion', 'accept', 'conflict', 'endTimeLater'
]

const requireDays = (name, list) => {
  if (!Array.isArray(list) || list.length !== 7 || list.some(day => day == null)) {
    throw new Error(`ScheduleEditor needs seven ${name}`)
  }
}

const requireLabels = (labels, useDaysAbbrevation) => {
  if (labels == null) throw new Error('ScheduleEditor needs labels')
  for (const name of REQUIRED_LABELS) {
    if (labels[name] == null) throw new Error(`ScheduleEditor needs a label ${name}`)
  }
  requireDays('labels.days', labels.days)
  if (useDaysAbbrevation) requireDays('labels.daysAbbreviated', labels.daysAbbreviated)
  if (labels.copyDays != null) requireDays('labels.copyDays', labels.copyDays)
}

const pad = value => (value < 10 ? `0${value}` : String(value))

const getNextDate = (dayIndex) => {
  const now = new Date()
  now.setDate(now.getDate() + (dayIndex + (7 - now.getDay())) % 7)
  return now
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute)

/** A native select inside a frame that owns the phone's 44px area; a press on the frame itself focuses the select. */
const TimeSelect = ({ name, value, options, boundary, unit, lapse, onChange }) => (
  <span className='odc-sched-time' onMouseDown={event => focusFrameControl(event.currentTarget, event, 'select')}>
    <select
      className='odc-sched-select odc-figure'
      aria-label={name}
      data-boundary={boundary}
      data-unit={unit}
      data-lapse={lapse}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
    >
      {options.map(option => <option key={option.value} value={option.value}>{option.text}</option>)}
    </select>
  </span>
)

const ScheduleEditorUI = (props) => {
  const {
    labels,
    scheduleState = [],
    isConflict,
    setIsConflict,
    isTimeChangeError,
    setIsTimeChangeError,
    addScheduleTime,
    openAddSchedule = {},
    handleEnabledSchedule,
    handleChangeScheduleTime,
    handleDeleteSchedule,
    handleOpenAddSchedule,
    handleChangeAddScheduleTime,
    handleAddSchedule,
    selectedCopyDays = [],
    cleanSelectedCopyDays,
    handleSelectCopyTimes,
    handleApplyScheduleCopyTimes,
    isShowDate,
    disableSchedule,
    useDaysAbbrevation
  } = props

  const [{ configs }] = useConfig()
  const [{ parseDate }] = useUtils()
  const is12Hours = !!configs?.general_hour_format?.value?.includes('hh:mm')

  const [copyDay, setCopyDay] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const rowDays = useDaysAbbrevation ? labels.daysAbbreviated : labels.days
  const copyDays = labels.copyDays ?? labels.days

  const formatHour = (hour) => {
    if (!is12Hours) return pad(hour)
    if (hour === 0) return `12 ${labels.am}`
    if (hour < 12) return `${hour} ${labels.am}`
    if (hour === 12) return `12 ${labels.pm}`
    return `${hour - 12} ${labels.pm}`
  }
  const formatClock = ({ hour, minute }) => {
    if (!is12Hours) return `${pad(hour)}:${pad(minute)}`
    return `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour < 12 ? labels.am : labels.pm}`
  }
  const hourOptions = HOURS.map(hour => ({ value: hour, text: formatHour(hour) }))
  const minuteOptions = MINUTES.map(minute => ({ value: minute, text: pad(minute) }))

  // The controller's own message state: a conflict wins over an invalid time, as the legacy alert did.
  const alertOpen = !!(isConflict || isTimeChangeError)
  const alertContent = [isConflict ? labels.conflict : labels.endTimeLater]
  const closeAlert = () => {
    setIsConflict(false)
    setIsTimeChangeError(false)
  }

  // Opening the copy dialog starts from no destination day, as the legacy popover did.
  useEffect(() => {
    if (copyDay != null) cleanSelectedCopyDays()
  }, [copyDay])

  const lapseToDelete = confirmDelete ? scheduleState[confirmDelete.day]?.lapses?.[confirmDelete.index] : null

  return (
    <>
      <div className='odc-root odc-sched' data-slot='schedule-editor' data-disabled={disableSchedule ? '' : undefined}>
        {scheduleState.map((schedule, dayIndex) => {
          const dayName = rowDays[dayIndex]
          const enabled = !!schedule?.enabled
          const lapses = schedule?.lapses || []
          return (
            <div
              key={dayIndex}
              className='odc-sched-day'
              role='group'
              aria-label={dayName}
              data-slot='schedule-day'
              data-day={dayIndex}
              data-enabled={enabled ? '' : undefined}
            >
              <div className='odc-sched-head'>
                {!disableSchedule && (
                  <Switch
                    label={`${labels.schedule}: ${dayName}`}
                    checked={enabled}
                    onCheckedChange={checked => handleEnabledSchedule(dayIndex, checked)}
                  />
                )}
                <span className='odc-sched-name'>
                  <span className='odc-sched-day-name'>{dayName}</span>
                  {isShowDate && (
                    <span className='odc-sched-date odc-figure'>{parseDate(getNextDate(dayIndex), { dateOnly: true })}</span>
                  )}
                </span>
              </div>

              <div className='odc-sched-body'>
                {enabled
                  ? (
                    <div className='odc-sched-lapses'>
                      {lapses.map((lapse, index) => (
                        <div key={index} className='odc-sched-lapse' data-slot='schedule-lapse' data-lapse={index}>
                          <span className='odc-sched-pair'>
                            <TimeSelect
                              name={`${dayName} ${labels.open} ${labels.hour} ${index + 1}`}
                              boundary='open' unit='hour' lapse={index}
                              value={lapse?.open?.hour} options={hourOptions}
                              onChange={value => handleChangeScheduleTime(value, dayIndex, index, true, 'hour')}
                            />
                            <TimeSelect
                              name={`${dayName} ${labels.open} ${labels.minute} ${index + 1}`}
                              boundary='open' unit='minute' lapse={index}
                              value={lapse?.open?.minute} options={minuteOptions}
                              onChange={value => handleChangeScheduleTime(value, dayIndex, index, true, 'minute')}
                            />
                          </span>
                          <span className='odc-sched-split' aria-hidden='true' />
                          <span className='odc-sched-pair'>
                            <TimeSelect
                              name={`${dayName} ${labels.close} ${labels.hour} ${index + 1}`}
                              boundary='close' unit='hour' lapse={index}
                              value={lapse?.close?.hour} options={hourOptions}
                              onChange={value => handleChangeScheduleTime(value, dayIndex, index, false, 'hour')}
                            />
                            <TimeSelect
                              name={`${dayName} ${labels.close} ${labels.minute} ${index + 1}`}
                              boundary='close' unit='minute' lapse={index}
                              value={lapse?.close?.minute} options={minuteOptions}
                              onChange={value => handleChangeScheduleTime(value, dayIndex, index, false, 'minute')}
                            />
                          </span>
                          {!disableSchedule && lapses.length > 1 && (
                            <IconButton
                              icon={Trash2}
                              label={`${labels.delete} ${labels.schedule}: ${dayName} ${index + 1}`}
                              data-schedule-action='delete'
                              onClick={() => setConfirmDelete({ day: dayIndex, index })}
                            />
                          )}
                        </div>
                      ))}
                      {openAddSchedule[dayIndex] && (
                        <div className='odc-sched-lapse' data-slot='schedule-lapse' data-lapse='manual'>
                          <span className='odc-sched-pair'>
                            <TimeSelect
                              name={`${dayName} ${labels.open} ${labels.hour}`}
                              boundary='open' unit='hour' lapse='manual'
                              value={addScheduleTime?.open?.hour} options={hourOptions}
                              onChange={value => handleChangeAddScheduleTime(value, true, 'hour')}
                            />
                            <TimeSelect
                              name={`${dayName} ${labels.open} ${labels.minute}`}
                              boundary='open' unit='minute' lapse='manual'
                              value={addScheduleTime?.open?.minute} options={minuteOptions}
                              onChange={value => handleChangeAddScheduleTime(value, true, 'minute')}
                            />
                          </span>
                          <span className='odc-sched-split' aria-hidden='true' />
                          <span className='odc-sched-pair'>
                            <TimeSelect
                              name={`${dayName} ${labels.close} ${labels.hour}`}
                              boundary='close' unit='hour' lapse='manual'
                              value={addScheduleTime?.close?.hour} options={hourOptions}
                              onChange={value => handleChangeAddScheduleTime(value, false, 'hour')}
                            />
                            <TimeSelect
                              name={`${dayName} ${labels.close} ${labels.minute}`}
                              boundary='close' unit='minute' lapse='manual'
                              value={addScheduleTime?.close?.minute} options={minuteOptions}
                              onChange={value => handleChangeAddScheduleTime(value, false, 'minute')}
                            />
                          </span>
                          <span className='odc-sched-manual-actions'>
                            <Button
                              variant='primary'
                              data-schedule-action='apply-manual'
                              aria-label={`${labels.apply} ${labels.schedule}: ${dayName}`}
                              onClick={() => handleAddSchedule(dayIndex)}
                            >
                              {labels.apply}
                            </Button>
                            <Button
                              data-schedule-action='cancel-manual'
                              aria-label={`${labels.cancel} ${labels.schedule}: ${dayName}`}
                              onClick={() => handleOpenAddSchedule(null)}
                            >
                              {labels.cancel}
                            </Button>
                          </span>
                        </div>
                      )}
                    </div>
                    )
                  : <p className='odc-sched-off'>{labels.unavailable}</p>}

                {!disableSchedule && (
                  <div className='odc-sched-actions'>
                    <Button
                      variant='ghost'
                      icon={Plus}
                      disabled={!enabled}
                      data-schedule-action='add'
                      aria-label={`${labels.addHours}: ${dayName}`}
                      onClick={() => handleAddSchedule(dayIndex)}
                    >
                      {labels.addHours}
                    </Button>
                    <Button
                      variant='ghost'
                      icon={Copy}
                      disabled={!enabled}
                      data-schedule-action='copy'
                      aria-haspopup='dialog'
                      aria-label={`${labels.copyHours}: ${dayName}`}
                      onClick={() => setCopyDay(dayIndex)}
                    >
                      {labels.copyHours}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={copyDay != null}
        onOpenChange={open => { if (!open) setCopyDay(null) }}
        size='sm'
        title={labels.copyTitle}
        closeLabel={labels.close}
        description={copyDay != null ? rowDays[copyDay] : undefined}
        footer={(
          <>
            <Button onClick={() => setCopyDay(null)}>{labels.cancel}</Button>
            <Button
              variant='primary'
              onClick={() => {
                handleApplyScheduleCopyTimes(copyDay)
                setCopyDay(null)
              }}
            >
              {labels.apply}
            </Button>
          </>
        )}
      >
        <div className='odc-sched-copy' role='group' aria-label={labels.copyTitle}>
          {copyDays.map((name, index) => {
            const isSource = index === copyDay
            return (
              <Checkbox
                key={index}
                className={cx(isSource && 'odc-sched-copy-source')}
                checked={isSource || selectedCopyDays.includes(index)}
                disabled={isSource}
                data-day={index}
                onCheckedChange={() => handleSelectCopyTimes(index)}
              >
                {name}
              </Checkbox>
            )
          })}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete != null}
        title={labels.deleteQuestion}
        closeLabel={labels.close}
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          handleDeleteSchedule(confirmDelete.day, confirmDelete.index)
          setConfirmDelete(null)
        }}
      >
        {confirmDelete && lapseToDelete && (
          <>
            {rowDays[confirmDelete.day]}
            {' · '}
            <span className='odc-figure'>{formatClock(lapseToDelete.open)} – {formatClock(lapseToDelete.close)}</span>
          </>
        )}
      </ConfirmDialog>

      <AlertDialog
        open={alertOpen}
        title={labels.schedule}
        content={alertContent}
        closeLabel={labels.close}
        confirmLabel={labels.accept}
        onClose={closeAlert}
      />
    </>
  )
}

export const ScheduleEditor = (props) => {
  requireLabels(props.labels, props.useDaysAbbrevation)
  return <ScheduleController {...props} UIComponent={ScheduleEditorUI} />
}
