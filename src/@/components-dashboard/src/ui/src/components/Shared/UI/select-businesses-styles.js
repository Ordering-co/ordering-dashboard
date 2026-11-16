import React from 'react'
import styled, { css } from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './select-businesses.css'

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-select-businesses',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'entity-selector',
  'data-entity-selector': 'businesses'
}))`
  ${props => entitySelectorStyle(props.theme)}
`
export const SearchBarWrapper = styled.div.attrs({
  className: 'od-ui od-entity-selector-search',
  'data-slot': 'select-businesses-search'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const ButtonGroup = styled.div.attrs({
  className: 'od-ui od-entity-selector-actions',
  'data-slot': 'entity-selector-actions'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const BusinessesContainer = styled.div.attrs({
  className: 'od-ui od-select-businesses-list',
  'data-slot': 'select-businesses-list'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const BusinessWrapper = styled.div.attrs({
  className: 'od-ui od-entity-selector-row od-select-businesses-row',
  'data-slot': 'entity-selector-row'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const WrapperImage = styled.div.attrs({
  className: 'od-ui od-select-businesses-image-frame',
  'data-slot': 'entity-selector-image'
})`
  ${props => entitySelectorStyle(props.theme)}
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid var(--od-entity-selector-border);
  `}
`

const ImageStyled = styled.div.attrs({
  className: 'od-ui od-select-businesses-image',
  'data-slot': 'select-businesses-image'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const Image = (props) => {
  return (
    <ImageStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </ImageStyled>
  )
}
