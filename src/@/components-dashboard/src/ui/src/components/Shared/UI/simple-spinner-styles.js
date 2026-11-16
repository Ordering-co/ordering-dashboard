import styled from 'styled-components'
import { cssVariables, resolveFeedbackTheme } from './feedback-theme'
import './simple-spinner.css'

const simpleSpinnerStyle = (theme, props) => {
  const roles = resolveFeedbackTheme(theme)
  return cssVariables('simple-spinner', {
    width: props.width ?? '50px',
    height: props.height ?? '50px',
    track: roles.border,
    color: props.btc ?? roles.action
  })
}

export const Loading = styled.div.attrs({
  className: 'od-ui od-simple-spinner',
  'data-slot': 'simple-spinner',
  'aria-hidden': 'true'
})`
  ${props => simpleSpinnerStyle(props.theme, props)}
`
