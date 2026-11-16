import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './language-selector.css'

export const SelectWrapper = styled.div.attrs(props => ({
  className: 'od-ui od-language-selector',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'language-selector'
}))`${props => entitySelectorStyle(props.theme)}`

export const LanguageItem = styled.div.attrs(props => ({
  className: 'od-ui od-language-single',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'language-single'
}))`${props => entitySelectorStyle(props.theme)}`

export const LanguageText = styled.span.attrs({ className: 'od-language-text' })`${props => entitySelectorStyle(props.theme)}`
