import styled from 'styled-components'
import { cssVariables, resolveFeedbackTheme } from './feedback-theme'
import './spinner-loader.css'

const spinnerLoaderStyle = theme => {
  const roles = resolveFeedbackTheme(theme)
  return cssVariables('spinner-loader', {
    surface: roles.surface,
    text: roles.text,
    action: roles.action,
    font: roles.fontFamily
  })
}

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-spinner-loader',
  'data-slot': 'spinner-loader',
  'data-primary': props.primary ? 'true' : undefined,
  role: 'status',
  'aria-busy': 'true',
  'aria-live': 'polite'
}))`
  ${props => spinnerLoaderStyle(props.theme)}
`

export const Logo = styled.div.attrs({
  className: 'od-ui od-spinner-loader-logo',
  'data-slot': 'spinner-loader-logo'
})`
  ${props => spinnerLoaderStyle(props.theme)}
`

export const Content = styled.h1.attrs({
  className: 'od-ui od-spinner-loader-content',
  'data-slot': 'spinner-loader-content'
})`
  ${props => spinnerLoaderStyle(props.theme)}
`

export const Spinner = styled.div.attrs({
  className: 'od-ui od-spinner-loader-spinner spinner',
  'data-slot': 'spinner-loader-spinner',
  'aria-hidden': 'true'
})`
  ${props => spinnerLoaderStyle(props.theme)}
`
