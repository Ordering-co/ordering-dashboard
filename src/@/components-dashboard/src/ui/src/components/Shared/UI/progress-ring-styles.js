import styled from 'styled-components'
import { cssVariables, resolveFeedbackTheme } from './feedback-theme'
import './progress-ring.css'

export const progressRingStyle = (theme, { percentColor, fontSize } = {}) => {
  const roles = resolveFeedbackTheme(theme)
  const labelSize = fontSize
    ? typeof fontSize === 'number' ? `${fontSize}px` : fontSize
    : '14px'
  return cssVariables('progress-ring', {
    font: roles.fontFamily,
    'label-color': percentColor || roles.actionContent,
    'label-size': labelSize
  })
}

export const ProgressRingRoot = styled.div.attrs({
  className: 'od-ui od-progress-ring',
  'data-slot': 'progress-ring'
})``
