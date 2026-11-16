import styled from 'styled-components'
import { cssVariables, resolveFeedbackTheme } from './feedback-theme'
import './disabled-feature-alert.css'

const disabledFeatureStyle = theme => {
  const roles = resolveFeedbackTheme(theme)
  return cssVariables('disabled-feature', {
    action: roles.actionContent,
    soft: roles.actionSoft,
    text: roles.text,
    font: roles.fontFamily,
    radius: roles.radiusControl,
    shadow: roles.shadowRaised,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset
  })
}

export const DisabledFeatureAlertContainer = styled.div.attrs({
  className: 'od-ui od-disabled-feature-alert',
  'data-slot': 'disabled-feature-alert'
})`
  ${props => disabledFeatureStyle(props.theme)}
  left: ${props => (props?.containerWidth ? `calc(50vw - ${props?.containerWidth / 2}px)` : '50vw')};
`
export const Wrapper = styled.div.attrs({
  className: 'od-ui od-disabled-feature-wrapper',
  'data-slot': 'disabled-feature-wrapper'
})`
  ${props => disabledFeatureStyle(props.theme)}
`
export const CommentContainer = styled.div.attrs({
  className: 'od-ui od-disabled-feature-copy',
  'data-slot': 'disabled-feature-copy'
})`
  ${props => disabledFeatureStyle(props.theme)}
`
export const Comment = styled.div.attrs({
  className: 'od-ui od-disabled-feature-comment',
  'data-slot': 'disabled-feature-comment'
})`
  ${props => disabledFeatureStyle(props.theme)}
`
export const MoreInfo = styled.a.attrs({
  className: 'od-ui od-disabled-feature-link',
  'data-slot': 'disabled-feature-link'
})`
  ${props => disabledFeatureStyle(props.theme)}
`
