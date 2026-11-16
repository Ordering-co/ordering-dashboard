import React, { useId, useState } from 'react'
import { useLanguage } from '../../../../../../index'
import { Checkbox } from '../../../../styles/Checkbox'

import {
  InsertLinkContainer,
  WrapperInput,
  CheckboxWrapper
} from './insert-link-styles'
import { Button } from '../../../../styles/Buttons'
import { Input } from '../../../../styles/Inputs'

export const InsertLink = (props) => {
  const {
    editorContext,
    onClose,
    handleRestoreEditor,
    isLinkButton
  } = props
  const [, t] = useLanguage()
  const [changesState, setChangesState] = useState({})
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const textId = `${dialogId}-text`
  const urlId = `${dialogId}-url`
  const newWindowId = `${dialogId}-new-window`

  const handleChangeInput = (e) => {
    setChangesState({
      ...changesState,
      [e.target.name]: e.target.value
    })
  }

  const handleInsertClick = () => {
    handleRestoreEditor()
    editorContext.invoke('editor.createLink', {
      text: changesState?.text || (isLinkButton ? 'button' : ''),
      url: changesState?.url || '',
      isNewWindow: changesState?.isNewWindow ?? true,
      isButton: !!isLinkButton
    })
    onClose()
  }

  return (
    <InsertLinkContainer role='group' aria-labelledby={titleId}>
      <h1 id={titleId}>{t('INSERT_LINK', 'Insert link')}</h1>
      <WrapperInput>
        <label htmlFor={textId}>{t('LINK_TEXT', 'Text to display')}</label>
        <Input
          id={textId}
          data-editor-input='link-text'
          name='text'
          onChange={e => handleChangeInput(e)}
        />
      </WrapperInput>
      <WrapperInput>
        <label htmlFor={urlId}>{t('LINK_URL', 'Url')}</label>
        <Input
          id={urlId}
          data-editor-input='link-url'
          name='url'
          onChange={e => handleChangeInput(e)}
        />
      </WrapperInput>
      <CheckboxWrapper as='label' htmlFor={newWindowId}>
        <Checkbox
          id={newWindowId}
          defaultChecked
          onClick={e => setChangesState({ ...changesState, isNewWindow: e.target.checked })}
        />
        <span>{t('IS_NEW_WINDOW', 'Open in a new window')}</span>
      </CheckboxWrapper>
      <Button
        type='button'
        data-editor-action='insert-link'
        borderRadius='8px'
        color='primary'
        onClick={() => handleInsertClick()}
      >
        {t('INSERT', 'Insert')}
      </Button>
    </InsertLinkContainer>
  )
}
