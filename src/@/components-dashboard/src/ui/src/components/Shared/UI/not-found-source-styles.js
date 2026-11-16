import styled from 'styled-components'
import { cssVariables, resolveFeedbackTheme } from './feedback-theme'
import './not-found-source.css'

const notFoundStyle = theme => {
  const roles = resolveFeedbackTheme(theme)
  return cssVariables('not-found', {
    text: roles.text,
    muted: roles.textMuted,
    font: roles.fontFamily
  })
}

export const NotFound = styled.div.attrs({
  className: 'od-ui od-not-found-source',
  'data-slot': 'not-found-source'
})`
  ${props => notFoundStyle(props.theme)}
`

export const NotFoundImage = styled.div.attrs({
  className: 'od-ui od-not-found-source-image',
  'data-slot': 'not-found-source-image'
})`
  ${props => notFoundStyle(props.theme)}
`
