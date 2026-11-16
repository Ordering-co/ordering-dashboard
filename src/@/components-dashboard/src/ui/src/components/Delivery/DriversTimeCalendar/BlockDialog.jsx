import React, { useId, useState } from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { describeDateFormat, formatDay, formatVisibleDay, makeDayLabelers } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { Button, Checkbox, DatePicker, Dialog, Field, RadioGroup, Switch, TextArea, TextField } from '../../Shared/Product'
import { TimeSelect } from './TimeSelect'
import { defaultUntil, describeRule, emptyForm, formFromBlock, timeErrors, timeOf, timeOptions, todayDay, untilBounds } from './blockData'
import './block-dialog.css'

// redesign DT-B2 (decisions 11, 12, 13 | DT-01, DT-03, DT-12, DT-14, DT-19, DT-22): the dialog of one block, to add it or to edit it. It keeps the
// form (blockData.BlockForm) and hands it over whole in onSubmit(form); the page builds the body (addBody / editBody) and asks the
// propagation of an edit (BlockConfirmDialog). The driver is named in the description (DT-12). The hours are native selects of quarters
// (TimeSelect) and their errors sit in their own field; changing the start never moves the end (DT-22). What the repetition does is
// said in a status line (DT-03). The days of the week wrap (DT-14).

// «Sun … Sat» as main shows them, over the rrule index (0 Monday … 6 Sunday) that the form stores: Sunday is 6, Monday 0, …
const WEEK = [0, 1, 2, 3, 4, 5, 6].map(position => ({ position, rruleIndex: (position + 6) % 7 }))

const ERROR_TEXT = {
  END_TIME_LATER: 'Choose an end time later than the start time.',
  BREAK_START_TIME_LATER: 'Choose a break start time later than the start times and earlier than end/break end times.',
  BREAK_END_TIME_EARLY: 'Choose a break end time later than the start/break start time and earlier than end time.'
}

const fullName = (user) => [user?.name, user?.lastname].filter(Boolean).join(' ')

// The seven days as checkboxes in a group that wraps (DT-14). Sunday first, as main; the form stores the rrule index.
const WeekDays = ({ label, selected, nameOf, onToggle }) => {
  const labelId = useId()
  return (
    <div className='odc-bd-group'>
      <span id={labelId} className='odc-bd-group-label'>{label}</span>
      <div className='odc-bd-days' role='group' aria-labelledby={labelId}>
        {WEEK.map(({ position, rruleIndex }) => (
          <Checkbox
            key={rruleIndex}
            checked={selected.includes(rruleIndex)}
            onCheckedChange={(checked) => onToggle(rruleIndex, checked)}
          >
            {nameOf(position)}
          </Checkbox>
        ))}
      </div>
    </div>
  )
}

// `zone` is the time zone of the hours (the chosen group's), the browser's by default
export const BlockDialog = ({ open, mode = 'add', driver, block, day, startTime, zone, onSubmit, onDelete, onClose, busy = false }) => {
  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const [{ parseDate } = {}] = useUtils() || []
  const reasonId = useId()
  const locale = languageState?.language?.code
  const is12 = String(configs?.general_hour_format?.value ?? '').includes('hh:mm')
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat

  // The form starts again from the props each time the dialog opens (render-time reset: no frame with the old form). After it closes the
  // last form and view stay, so the dialog does not repaint as «Add new block» while it plays its exit.
  const [state, setState] = useState({ armed: false, form: null, view: null })
  if (!open && state.armed) setState(current => ({ ...current, armed: false }))
  if (open && !state.armed) {
    setState({
      armed: true,
      form: mode === 'edit' && block ? formFromBlock(block, day) : emptyForm({ day, startTime, zone }),
      view: { mode, driver, block, day }
    })
  }
  const { form, view } = state
  if (!form) return null // never opened

  const patch = (changes) => setState(current => ({ ...current, form: { ...current.form, ...changes } }))

  const editing = view.mode === 'edit'
  const labelers = makeDayLabelers(locale)
  const spec = describeDateFormat(dateFormat, locale)
  const shownDay = (value) => (parseDate ? formatVisibleDay(value, parseDate) : formatDay(value, spec))

  const extra = editing && view.block
    ? [timeOf(view.block.start), timeOf(view.block.end), timeOf(view.block.break_start), timeOf(view.block.break_end)].filter(Boolean)
    : []
  const options = timeOptions({ day: form.day, now: new Date(), extra, zone })
  const errors = timeErrors(form)
  const hasErrors = Object.keys(errors).length > 0
  const errorText = (key) => (key ? t(key, ERROR_TEXT[key]) : undefined)
  const clock = { is12, am: t('AM', 'AM'), pm: t('PM', 'PM') }

  const pickerLabels = {
    title: t('SELECT_DATE', 'Select a date'),
    close: t('CLOSE', 'Close'),
    today: t('TODAY', 'Today'),
    goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
    previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
    nextMonth: t('NEXT_MONTH', 'Next month'),
    invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
    outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.')
  }

  // A later block date carries the until date with it (main, CalendarDriversList:466-472)
  const changeDay = (next) => {
    if (!next) return
    patch({ day: next, untilDay: next > form.untilDay ? next : form.untilDay })
  }

  // a new repetition starts with «Until» a month out, not on the block's day, so it repeats
  const changeFreq = (freq) => {
    const needsUntil = freq && !editing && form.untilDay <= form.day
    patch(needsUntil ? { freq, untilDay: defaultUntil(form.day) } : { freq })
  }

  const toggleWeekday = (rruleIndex, checked) => {
    const others = form.byweekday.filter(index => index !== rruleIndex)
    patch({ byweekday: (checked ? [...others, rruleIndex] : others).sort((a, b) => a - b) })
  }

  const ruleText = describeRule(form, {
    t,
    dayName: (index) => labelers.weekday((index + 1) % 7),
    untilText: shownDay(form.untilDay),
    locale
  })

  // review r1 R-03 (DT-03): with «Until» on the block's own day a repetition saves one block that never repeats (main's default, P-2):
  // the line says so before saving, instead of promising a series
  const ruleLine = form.freq && form.untilDay <= form.day
    ? t('DRIVER_BLOCKS_REPEATS_NOT', "With «Until» on the shift's day, it will not repeat.")
    : ruleText

  const close = () => {
    if (!busy) onClose?.()
  }
  const submit = () => {
    if (hasErrors || busy) return
    onSubmit?.(form)
  }

  const bounds = untilBounds(form.day)
  const breakLocked = editing && Boolean(view.block?.break_start)
  const driverLine = (
    <>
      {fullName(view.driver)}
      {view.driver?.id != null && <> · <span className='odc-figure'>#{view.driver.id}</span></>}
    </>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) close() }}
      title={editing ? t('EDIT_BLOCK', 'Edit shift') : t('ADD_NEW_BLOCK', 'Add new shift')}
      description={driverLine}
      closeLabel={t('CLOSE', 'Close')}
      size='md'
      footer={(
        <>
          {editing && (
            <Button variant='danger' className='odc-bd-delete' disabled={busy} onClick={() => onDelete?.()}>
              {t('DELETE_BLOCK', 'Delete shift')}
            </Button>
          )}
          <Button disabled={busy} onClick={close}>{t('CANCEL', 'Cancel')}</Button>
          <Button
            variant='primary'
            busy={busy}
            disabled={hasErrors}
            aria-describedby={hasErrors ? reasonId : undefined}
            onClick={submit}
          >
            {editing ? t('SAVE', 'Save') : t('ADD', 'Add')}
          </Button>
        </>
      )}
    >
      <div className='odc-bd-form'>
        <TextField
          label={t('BLOCK_NAME', 'Shift Name')}
          placeholder={t('BLOCK_NAME_OPTIONAL', 'Shift name (Optional)')}
          value={form.name}
          onChange={(value) => patch({ name: value })}
        />
        <TextArea
          label={t('BLOCK_DESCRIPTION', 'Shift Description')}
          placeholder={t('BLOCK_DESCRIPTION_OPTIONAL', 'Shift description (Optional)')}
          rows={2}
          value={form.description}
          onChange={(value) => patch({ description: value })}
        />

        {/* redesign DT-B2 (decision 13): the date in the project's format, never ISO; from today on */}
        <Field label={t('BLOCK_DATE', 'Shift date')}>
          <DatePicker
            label={t('BLOCK_DATE', 'Shift date')}
            labels={pickerLabels}
            value={form.day}
            min={todayDay(zone)}
            dateFormat={dateFormat}
            locale={locale}
            onChange={changeDay}
          />
        </Field>

        <div className='odc-bd-times'>
          <TimeSelect
            label={t('DRIVER_BLOCKS_START_TIME', 'Start time')}
            value={form.start}
            options={options}
            error={errorText(errors.start)}
            onChange={(value) => patch({ start: value })}
            {...clock}
          />
          <TimeSelect
            label={t('DRIVER_BLOCKS_END_TIME', 'End time')}
            value={form.end}
            options={options}
            error={errorText(errors.end)}
            onChange={(value) => patch({ end: value })}
            {...clock}
          />
        </div>

        <Switch
          checked={form.showBreak}
          disabled={breakLocked}
          onCheckedChange={(checked) => patch({ showBreak: checked })}
        >
          {t('DRIVER_BLOCKS_BREAK', 'Break')}
        </Switch>
        {form.showBreak && (
          <div className='odc-bd-times'>
            <TimeSelect
              label={t('DRIVER_BLOCKS_BREAK_START', 'Break start')}
              value={form.breakStart}
              options={options}
              error={errorText(errors.breakStart)}
              onChange={(value) => patch({ breakStart: value })}
              {...clock}
            />
            <TimeSelect
              label={t('DRIVER_BLOCKS_BREAK_END', 'Break end')}
              value={form.breakEnd}
              options={options}
              error={errorText(errors.breakEnd)}
              onChange={(value) => patch({ breakEnd: value })}
              {...clock}
            />
          </div>
        )}

        <RadioGroup
          label={t('FREQUENCY', 'Frequency')}
          orientation='horizontal'
          value={form.freq ?? 'none'}
          onValueChange={(value) => changeFreq(value === 'none' ? null : value)}
          options={[
            { value: 'none', label: t('NONE', 'None') },
            { value: 'weekly', label: t('WEEKLY', 'Weekly') },
            { value: 'daily', label: t('DAILY', 'Daily') }
          ]}
        />

        {form.freq && (
          <WeekDays
            label={t('BY_WEEK_DAY', 'By week day')}
            selected={form.byweekday}
            nameOf={(position) => labelers.weekday(position)}
            onToggle={toggleWeekday}
          />
        )}

        {form.freq && !editing && (
          <Field label={t('UNTIL_DATE', 'Until date')}>
            <DatePicker
              label={t('UNTIL_DATE', 'Until date')}
              labels={pickerLabels}
              value={form.untilDay}
              min={bounds.min}
              max={bounds.max}
              dateFormat={dateFormat}
              locale={locale}
              onChange={(next) => { if (next) patch({ untilDay: next }) }}
            />
          </Field>
        )}

        {/* redesign DT-B2 (DT-03): what the repetition does, in a sentence; always in the page so a change is announced */}
        <p role='status' className='odc-bd-rule'>{ruleLine}</p>

        {hasErrors && (
          <p id={reasonId} className='odc-bd-reason'>{t('DRIVER_BLOCKS_FIX_HOURS', 'Fix the hours marked above to continue.')}</p>
        )}
      </div>
    </Dialog>
  )
}
