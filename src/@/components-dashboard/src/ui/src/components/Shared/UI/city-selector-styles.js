import styled, { css } from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './city-selector.css'

export const Option = styled.div.attrs({
  className: 'od-ui od-city-selector-option',
  'data-slot': 'city-selector-option'
})`
  ${props => entitySelectorStyle(props.theme)}
  ${({ isDefault }) => isDefault
? css`
    padding: 5px 15px;
  `
: css`
    padding: 10px;
  `}

  ${({ noPadding }) => noPadding && css`
    padding: 0px;
  `}

  svg {
    ${props => props.theme?.rtl ? css`margin-left: 5px;` : css`margin-right: 5px;`}
  }
`

export const PlaceholderTitle = styled(Option).attrs({
  className: 'od-ui od-city-selector-option od-city-selector-placeholder',
  'data-slot': 'city-selector-placeholder'
})`
  ${({ isDefault }) => isDefault
? css`
    padding: 5px 15px;
    `
: css`
    padding: 10px;
    margin-right: 0px;
    margin-left: 0px;
  `}
`

export const LoadingContainer = styled.div.attrs({
  className: 'od-ui od-city-selector-loading',
  'data-slot': 'city-selector-loading'
})`
  ${props => entitySelectorStyle(props.theme)}
`
