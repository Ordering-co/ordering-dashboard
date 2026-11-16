import styled from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'
import { TabActionBridge } from './tab-action-bridge'
import './tabs.css'

const variables = (prefix, values) => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-${prefix}-${key}`, String(value)])
)

const commonStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return {
    roles,
    variables: variables('tabs', {
      text: roles.text,
      muted: roles.textMuted,
      border: roles.border,
      focus: roles.focus,
      'focus-width': roles.focusWidth,
      'focus-offset': roles.focusOffset,
      'touch-target': roles.touchTarget,
      font: roles.fontFamily,
      'font-size': roles.fontSize
    })
  }
}

export const Tabs = styled.div.attrs({
  className: 'od-ui od-tabs-generic',
  'data-slot': 'tabs-generic'
})`
  ${props => {
    const { roles, variables: style } = commonStyle(props.theme)
    return {
      ...style,
      '--od-tabs-generic-color': props.variant === 'primary' ? roles.actionContent : 'inherit'
    }
  }}
`

export const Tab = styled(TabActionBridge).attrs({
  className: 'od-ui od-tab-generic',
  'data-slot': 'tab-generic'
})`
  ${props => ({
    ...commonStyle(props.theme).variables,
    '--od-tab-generic-color': props.active ? 'inherit' : commonStyle(props.theme).roles.textMuted
  })}
`

export const SharedTabs = styled.div.attrs({
  className: 'od-ui od-tabs-shared',
  'data-slot': 'tabs-shared'
})`
  ${props => commonStyle(props.theme).variables}
`

export const SharedTab = styled(TabActionBridge).attrs({
  className: 'od-ui od-tab-shared',
  'data-slot': 'tab-shared'
})`
  ${props => {
    const { roles, variables: style } = commonStyle(props.theme)
    return {
      ...style,
      '--od-tab-shared-color': props.active ? roles.text : roles.textMuted,
      '--od-tab-shared-border-width': props.active ? '3px' : '0px'
    }
  }}
  ${props => props.active && 'font-weight: 500;'}
  ${props => props.theme?.rtl ? 'margin-left: 30px;' : 'margin-right: 30px;'}
`
