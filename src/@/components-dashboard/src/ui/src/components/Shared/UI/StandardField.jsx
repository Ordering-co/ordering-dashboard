import styled from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'
import './standard-field.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-standard-field-${key}`, String(value)])
)

export const standardFieldStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget
  })
}

// StandardField is a layout scope for one or more independent controls. It is
// intentionally a styled div instead of Base Field.Root, which would impose a
// single validation and labeling contract on all descendants.
export const StandardField = styled.div.attrs({
  className: 'od-ui od-standard-field',
  'data-slot': 'standard-field'
})`
  ${props => standardFieldStyle(props.theme)}

  .select,
  .multi-select {
    width: 100%;
    font-family: ${props => resolveSelectTheme(props.theme).fontFamily};
    font-size: ${props => resolveSelectTheme(props.theme).fontSize};
  }

  .select > div:first-child,
  .multi-select > div:first-child {
    width: 100%;
    min-height: ${props => resolveSelectTheme(props.theme).compactHeight};
  }

  @media (pointer: coarse) {
    .select > div:first-child,
    .multi-select > div:first-child {
      min-height: ${props => resolveSelectTheme(props.theme).touchTarget};
    }
  }
`
