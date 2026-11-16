import React from 'react'
import styled from 'styled-components'

import { IconButton } from '../../../styles/Buttons'
import { entitySelectorStyle } from './entity-selector-theme'
import './select-business-categories.css'

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-select-business-categories',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'entity-selector',
  'data-entity-selector': 'business-categories'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const AccordionSection = styled.div.attrs({
  className: 'od-ui od-selection-tree-section',
  'data-slot': 'selection-tree-section'
})`
  ${props => entitySelectorStyle(props.theme)}
`

const AccordionStyled = styled.div.attrs({
  className: 'od-ui od-selection-tree-header',
  'data-slot': 'selection-tree-header'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const Accordion = (props) => {
  const style = {}
  return (
    <AccordionStyled
      {...props}
      style={style}
    >
      {props.children}
    </AccordionStyled>
  )
}

export const AccordionToggle = styled(IconButton).attrs({
  className: 'od-selection-tree-disclosure',
  'data-selection-tree-slot': 'disclosure'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const AccordionItem = styled.div.attrs(props => ({
  className: 'od-ui od-selection-tree-row',
  'data-slot': 'selection-tree-row',
  'data-depth': Number(props.margin || 0) / 20
}))`
  ${props => ({
    ...entitySelectorStyle(props.theme),
    '--od-selection-tree-offset': `${Number(props.margin) || 0}px`
  })}
`

export const AccordionContent = styled.div.attrs({
  className: 'od-ui od-selection-tree-content',
  'data-slot': 'selection-tree-content'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const SkeletonWrapper = styled.div.attrs({
  className: 'od-ui od-selection-tree-skeleton',
  'data-slot': 'entity-selector-skeleton'
})`
  ${props => entitySelectorStyle(props.theme)}
`
