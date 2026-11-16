import React from 'react'

import { useConfig, useLanguage } from '../../../../../index'
import { DatePicker, Field, RadioGroup, Switch } from '../../Shared/Product'
import { focusFrameControl } from '../../Shared/Product/Field'
import {
  dateSettings,
  minEndDay,
  minScheduleDay,
  pickerLabels,
  slotLabel,
  splitStamp,
  timeSlots
} from './campaignDraft'
import './campaign-form.css'

// redesign CA-B5 (decision 3, decision 6; M-CA7, M-CA12): the delivery of a campaign.
//  - fixed: «As soon as possible» (no clock time in its label: the time «now» was frozen at render, M-CA7) or «Schedule for later» with a
//    day (from tomorrow, today's `getMinDate`) and a time in steps of 30 minutes (09:00 by default, D-52; main sent 00:00, hidden);
//  - dynamic: the «Active» switch and an optional end date (from today) with the same time.
// It holds NO state: the choice ASAP / later lives in the draft of the form (`draft.when`), so changing the channel, the audience or the
// section never loses it (M-CA12). Every change is reported as ONE patch of `onChange`:
//   { when } · { scheduledDay } · { scheduledTime } · { enabled } · { endDay } · { endTime }   (days are `YYYY-MM-DD`, times `HH:mm`)
//
// @param {string}   props.audienceType  `fixed` or `dynamic`; anything else draws nothing.
// @param {object}   props.draft         `toDraft(...)`: `when`, `scheduledAt`, `scheduledTime`, `enabled`, `endAt`, `endTime`.
// @param {Function} props.onChange      `(patch) => void`.

// A native <select> inside a Product field frame, like the time selects of P/ScheduleEditor (the pattern, not its internals): the frame
// owns the 44px area on a phone and a press on it focuses the select.
const TimeField = ({ label, value, is12Hours, onChange, t }) => {
  const slots = timeSlots()
  // a time that is not on the grid (it came from outside) is kept as an option, so the select never shows a time that is not the value
  const options = slots.includes(value) ? slots : [...slots, value].sort()
  return (
    <Field label={label}>
      <span className='odc-campaign-time' onMouseDown={event => focusFrameControl(event.currentTarget, event, 'select')}>
        <select
          className='odc-campaign-select odc-figure'
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          {options.map(slot => <option key={slot} value={slot}>{slotLabel(slot, is12Hours, t)}</option>)}
        </select>
      </span>
    </Field>
  )
}

export const CampaignDelivery = ({ audienceType, draft, onChange }) => {
  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const { dateFormat, is12Hours } = dateSettings(configs)
  const locale = languageState?.language?.code

  if (audienceType === 'fixed') {
    const { day } = splitStamp(draft.scheduledAt)
    return (
      <div className='odc-campaign-delivery'>
        <RadioGroup
          hideLabel
          label={t('DELIVERY', 'Delivery')}
          value={draft.when}
          onValueChange={(when) => onChange({ when })}
          options={[
            { value: 'asap', label: t('CAMPAIGNS_DELIVERY_ASAP', 'As soon as possible') },
            { value: 'later', label: t('SCHEDULE_FOR_LATER', 'Schedule for later') }
          ]}
        />
        {draft.when === 'later' && (
          <div className='odc-campaign-when'>
            <Field label={t('DATE', 'Date')}>
              <DatePicker
                label={t('DATE', 'Date')}
                labels={pickerLabels(t)}
                dateFormat={dateFormat}
                locale={locale}
                value={day}
                min={minScheduleDay()}
                onChange={(next) => onChange({ scheduledDay: next })}
              />
            </Field>
            <TimeField
              label={t('TIME', 'Time')}
              value={draft.scheduledTime}
              is12Hours={is12Hours}
              t={t}
              onChange={(time) => onChange({ scheduledTime: time })}
            />
          </div>
        )}
      </div>
    )
  }

  if (audienceType === 'dynamic') {
    const { day } = splitStamp(draft.endAt)
    return (
      <div className='odc-campaign-delivery'>
        <Switch checked={draft.enabled !== false} onCheckedChange={(enabled) => onChange({ enabled })}>
          {t('ACTIVE', 'Active')}
        </Switch>
        <div className='odc-campaign-when'>
          <Field label={t('END_DATE', 'End date')} hint={t('CAMPAIGNS_END_DATE_REQUIRED_HINT', 'The campaign stops sending on this date.')}>
            <DatePicker
              label={t('END_DATE', 'End date')}
              labels={pickerLabels(t, { clearable: true })}
              dateFormat={dateFormat}
              locale={locale}
              value={day}
              min={minEndDay()}
              onChange={(next) => onChange({ endDay: next })}
            />
          </Field>
          <TimeField
            label={t('TIME', 'Time')}
            value={draft.endTime}
            is12Hours={is12Hours}
            t={t}
            onChange={(time) => onChange({ endTime: time })}
          />
        </div>
      </div>
    )
  }

  return null
}
