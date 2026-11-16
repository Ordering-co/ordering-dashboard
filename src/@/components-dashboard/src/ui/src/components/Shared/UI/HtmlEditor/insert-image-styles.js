import styled from 'styled-components'

import { Button, IconButton } from '../../../../styles/Buttons'
import { resolveFeedbackTheme } from '../feedback-theme'
import { entitySelectorStyle } from '../entity-selector-theme'
import './insert-image.css'

const imageDialogStyle = theme => ({
  ...entitySelectorStyle(theme),
  '--od-editor-danger': resolveFeedbackTheme(theme).dangerFunctional
})

export const InsertImageContainer = styled.div.attrs(props => ({
  className: 'od-ui od-editor-dialog od-editor-insert-image',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'editor-insert-image'
}))`
  ${props => imageDialogStyle(props.theme)}
`

export const ImageListContainer = styled.div.attrs({
  className: 'od-ui od-editor-image-list',
  'data-slot': 'editor-image-list'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const WrapperImage = styled.div.attrs(props => ({
  className: 'od-ui od-editor-image-item',
  'data-slot': 'editor-image-item',
  'data-selected': props.isSelected ? '' : undefined
}))`
  ${props => imageDialogStyle(props.theme)}
`

export const ImageChoiceButton = styled(Button).attrs({
  className: 'od-editor-image-choice',
  'data-editor-action': 'select-image'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const CloseButton = styled(IconButton).attrs({
  className: 'od-editor-image-delete',
  'data-editor-action': 'delete-image'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const WrapperInput = styled.div.attrs({
  className: 'od-ui od-editor-field',
  'data-slot': 'editor-field'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const NewImage = styled.div.attrs({
  className: 'od-ui od-editor-new-image',
  'data-slot': 'editor-new-image'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const Image = styled.div.attrs(props => ({
  className: 'od-ui od-editor-image-upload',
  'data-slot': 'editor-image-upload',
  'data-has-preview': props.isImage ? '' : undefined
}))`
  ${props => imageDialogStyle(props.theme)}
`

export const Camera = styled.div.attrs({
  className: 'od-ui od-editor-camera',
  'data-slot': 'editor-camera'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const UploadImageIconContainer = styled.div.attrs({
  className: 'od-ui od-editor-upload-overlay',
  'data-slot': 'editor-upload-overlay'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const UploadImageIcon = styled.div.attrs({
  className: 'od-ui od-editor-upload-prompt',
  'data-slot': 'editor-upload-prompt'
})`
  ${props => imageDialogStyle(props.theme)}
`

export const SkeletonWrapper = styled.div.attrs({
  className: 'od-ui od-editor-image-skeleton',
  'data-slot': 'editor-image-skeleton'
})`
  ${props => imageDialogStyle(props.theme)}
`
