import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './schedule.css'

export const ScheduleContainer = styled.div.attrs(props => ({
  className: 'od-ui od-schedule',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'schedule'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const TimeScheduleItemContainer = styled.div.attrs(props => ({
  className: 'od-ui od-schedule-day',
  'data-slot': 'schedule-day',
  'data-day': props.dayIndex
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const LapseRow = styled.div.attrs(props => ({
  className: 'od-ui od-schedule-lapse',
  'data-slot': 'schedule-lapse',
  'data-lapse': props.lapseIndex,
  'data-manual': props.manual ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const SelectWrapper = styled.div.attrs(props => ({
  className: 'od-ui od-schedule-time-field',
  'data-slot': 'schedule-time-field',
  'data-boundary': props.boundary,
  'data-unit': props.unit,
  'data-lapse': props.lapseIndex
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const Option = styled.div.attrs({
  className: 'od-ui od-schedule-time-option',
  'data-slot': 'schedule-time-option'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const SplitLine = styled.div.attrs({
  className: 'od-ui od-schedule-split',
  'data-slot': 'schedule-split'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const IconWrapper = styled.span.attrs(props => ({
  className: 'od-ui od-schedule-icon-wrapper',
  'data-slot': 'schedule-add-wrapper',
  'data-hidden': props.isHide ? '' : undefined,
  'aria-hidden': props.isHide || undefined,
  inert: props.isHide ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const TrashIconWrapper = styled.div.attrs(props => ({
  className: 'od-ui od-schedule-trash-wrapper',
  'data-slot': 'schedule-delete-wrapper',
  'data-hidden': props.isHide ? '' : undefined,
  'aria-hidden': props.isHide || undefined,
  inert: props.isHide ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const AddScheduleIconWrapper = styled.div.attrs({
  className: 'od-ui od-schedule-add-actions',
  'data-slot': 'schedule-manual-actions'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const DateWrapper = styled.div.attrs({
  className: 'od-ui od-schedule-date',
  'data-slot': 'schedule-date'
})`
  ${props => entitySelectorStyle(props.theme)}
`
