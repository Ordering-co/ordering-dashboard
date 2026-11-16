import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './image-crop.css'

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-image-crop',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'image-crop'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const ImageCropWrapper = styled.div.attrs({
  className: 'od-ui od-image-crop-canvas',
  'data-slot': 'image-crop-canvas'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const ImageCropActionWrapper = styled.div.attrs({
  className: 'od-ui od-image-crop-actions',
  'data-slot': 'image-crop-actions'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const RangeWrapper = styled.div.attrs({
  className: 'od-ui od-image-crop-range',
  'data-slot': 'image-crop-range'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const ActionContentWrapper = styled.div.attrs({
  className: 'od-ui od-image-crop-rotate',
  'data-slot': 'image-crop-rotate'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const ButtonWrapper = styled.div.attrs({
  className: 'od-ui od-image-crop-submit',
  'data-slot': 'image-crop-submit'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const ActionAspectRatioBox = styled.div.attrs({
  className: 'od-ui od-image-crop-aspect',
  'data-slot': 'image-crop-aspect'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const CropLoadingOverlay = styled.div.attrs({
  className: 'od-ui od-image-crop-loading',
  'data-slot': 'image-crop-loading',
  role: 'status'
})`
  ${props => entitySelectorStyle(props.theme)}
`
