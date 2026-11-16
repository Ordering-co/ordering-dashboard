import React from 'react'
import styled from 'styled-components'
import { Accordion } from '@base-ui/react/accordion'

import { Button } from './Button'
import { entitySelectorStyle } from './entity-selector-theme'
import './integration-log.css'

const themed = props => entitySelectorStyle(props.theme)

export const LogsContainer = styled.div.attrs(props => ({
  className: 'od-ui od-integration-logs',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'integration-logs'
}))`${themed}`

export const LogContainer = styled.div.attrs({
  className: 'od-ui od-integration-log-detail',
  'data-slot': 'integration-log-detail'
})`${themed}`

export const TableWrapper = styled.div.attrs(props => ({
  className: 'od-ui od-integration-log-scrollport',
  'data-slot': 'integration-log-scrollport',
  'data-related-group': props.hasGroupRelated ? '' : undefined
}))`${themed}`

export const Table = styled.table.attrs({
  className: 'od-ui od-integration-log-table',
  'data-slot': 'integration-log-table'
})`${themed}`

export const UserInfoContainer = styled.div.attrs({ className: 'od-integration-log-user' })`${themed}`
export const DateTimeWrapper = styled.div.attrs({ className: 'od-integration-log-date' })`${themed}`
export const NoData = styled.div.attrs({ className: 'od-integration-log-empty', 'data-slot': 'integration-log-empty' })`${themed}`
export const WrapperPagination = styled.div.attrs({ className: 'od-integration-log-pagination' })`${themed}`
export const DataListTable = styled.table.attrs({ className: 'od-integration-log-loading-table' })`${themed}`

export const EventTypeContainer = styled.div.attrs(props => ({
  className: 'od-integration-log-event',
  'data-first-column': props.isFirst ? '' : undefined
}))`${themed}`

export const RelatedEvents = styled.div.attrs({ className: 'od-integration-log-related' })`${themed}`

export const Option = styled.div.attrs(props => ({
  className: 'od-integration-log-option',
  'data-no-padding': props.noPadding ? '' : undefined
}))`${themed}`

export const Timestatus = styled.div.attrs(props => ({
  className: 'od-integration-log-severity',
  'data-severity': props.timeState
}))`${themed}`

export const AccordionRoot = styled(Accordion.Root).attrs({
  className: 'od-ui od-integration-log-accordion',
  'data-slot': 'integration-log-accordion'
})`${themed}`

export const ToggleItemWrapper = styled(Accordion.Item).attrs({
  className: 'od-ui od-integration-log-accordion-item',
  'data-slot': 'integration-log-section'
})`${themed}`
export const LogAccordionItem = ToggleItemWrapper

export const AccordionHeader = styled(Accordion.Header).attrs({ className: 'od-integration-log-heading' })`${themed}`
export const ContextAwareToggle = styled(Accordion.Trigger).attrs({
  className: 'od-ui od-integration-log-disclosure',
  'data-slot': 'integration-log-disclosure',
  type: 'button'
})`${themed}`
export const AccordionPanel = styled(Accordion.Panel).attrs({
  className: 'od-integration-log-panel',
  'data-slot': 'integration-log-panel',
  keepMounted: true,
  render: (props, state) => (
    <div
      {...props}
      inert={state.open ? undefined : ''}
      aria-hidden={state.open ? undefined : true}
    />
  )
})`${themed}`

export const ContextAwareWrapper = styled.span.attrs({ className: 'od-integration-log-disclosure-content' })`${themed}`
export const ActionIconWrapper = styled.span.attrs({ className: 'od-integration-log-disclosure-icon', 'aria-hidden': true })`${themed}`

export const ViewContainer = styled.div.attrs(props => ({
  className: 'od-integration-log-legend',
  'data-align-end': props.flexEnd ? '' : undefined
}))`${themed}`

export const BoxColor = styled.span.attrs(props => ({
  className: 'od-integration-log-legend-color',
  'data-severity': props.severity,
  'aria-hidden': true
}))`${themed}`

export const GroupFilterButton = styled(Button).attrs({
  className: 'od-integration-log-group-action',
  'data-slot': 'integration-log-group-action'
})`${themed}`

export const LogRowButton = styled(Button).attrs({
  bgtransparent: true,
  className: 'od-integration-log-row-action',
  'data-slot': 'integration-log-row-action'
})`${themed}`

export const CodeToggleButton = styled(Button).attrs({
  bgtransparent: true,
  className: 'od-integration-log-text-action'
})`${themed}`
