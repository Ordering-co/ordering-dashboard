import React from 'react'

import { useLanguage } from '../../../../../index'
import { Field } from '../../Shared/Product'
import { focusFrameControl } from '../../Shared/Product/Field'
import { formatClock } from './blockData'
import '../../Shared/Product/time-field.css'
import './block-dialog.css'

// redesign DT-B2 (auditor 8, DT-19): a time of day in ONE native <select> of the quarters the block asks for (blockData.timeOptions),
// framed by P/Field like TimeField's selects (the same classes: the 32px control, the ring, the 44px phone area). P/TimeField gives
// minute by minute, which is not what a block takes. The value is `HH:mm`; an empty value (a break that was not chosen yet) shows a
// «Choose a time» option that cannot be picked back. A value that is not among the options is added in its place so it shows chosen.
export const TimeSelect = ({ label, value, options = [], onChange, error, is12 = false, am, pm, disabled = false, name }) => {
  const [, t] = useLanguage()
  const clock = (hhmm) => formatClock(hhmm, { is12, am: am ?? t('AM', 'AM'), pm: pm ?? t('PM', 'PM') })
  const list = value && !options.includes(value) ? [...options, value].sort() : options

  return (
    <Field label={label} error={error || undefined} disabled={disabled} name={name}>
      <span className='odc-time-field-part odc-bd-part' onMouseDown={event => focusFrameControl(event.currentTarget, event, 'select')}>
        <select
          className='odc-time-field-select odc-bd-select odc-figure'
          name={name}
          value={value ?? ''}
          disabled={disabled}
          onChange={event => onChange?.(event.target.value)}
        >
          {!value && <option value='' disabled>{t('DRIVER_BLOCKS_CHOOSE_TIME', 'Choose a time')}</option>}
          {list.map(option => <option key={option} value={option}>{clock(option)}</option>)}
        </select>
      </span>
    </Field>
  )
}
