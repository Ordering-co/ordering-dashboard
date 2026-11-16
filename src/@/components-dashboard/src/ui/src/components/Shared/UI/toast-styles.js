import styled from 'styled-components'
import { cssVariables, resolveFeedbackTheme } from './feedback-theme'
import './toast.css'

export const toastStyle = (theme, tone = 'info') => {
  const roles = resolveFeedbackTheme(theme)
  const palette = tone === 'error'
    ? { background: roles.dangerSoft, foreground: roles.dangerFunctional, border: roles.dangerSignal }
    : tone === 'success'
      ? { background: roles.successSoft, foreground: roles.successFunctional, border: roles.successSignal }
      : { background: roles.actionSoft, foreground: roles.actionContent, border: roles.action }

  return cssVariables('toast', {
    ...palette,
    font: roles.fontFamily,
    radius: roles.radiusComponent,
    shadow: roles.shadowRaised
  })
}

export const ToastContainer = styled.div.attrs(props => ({
  className: 'od-ui od-toast-container',
  'data-slot': 'toast-container',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr')
}))`
  ${props => toastStyle(props.theme, props.tone)}
`
