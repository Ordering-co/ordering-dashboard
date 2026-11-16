import React, { useEffect, useState } from 'react'
import { useLanguage, ContentForm as ContentFormController } from '../../../../../index'
import { Button } from '../../../styles'

import { Alert } from '../../Shared'
import { RichHtmlEditor } from '../../Shared/RichHtmlEditor'

import {
  PageContainer,
  Header,
  WrapperEditor,
  ButtonGroupWrapper
} from './styles'

const ContentFormUI = (props) => {
  const {
    formState,
    handleChangeFormState,
    handleSave,
    handleDelete,
    title,
    content,
    hideTitle
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // The editor is controlled by this value: the saved content (HTML or the plain text of before) and what is typed, code view included.
  const [body, setBody] = useState(content ?? '')

  const handleChangeBody = (html) => {
    setBody(html)
    handleChangeFormState('body', html)
  }

  const handleSubmit = () => handleSave(body)

  useEffect(() => {
    if (!formState?.error) return
    setAlertState({
      open: true,
      content: formState?.error
    })
  }, [formState?.error])

  useEffect(() => {
    setBody(content ?? '')
  }, [content])

  return (
    <>
      <PageContainer>
        {/* redesign ordering-website B3b (D7): opt-in `hideTitle`, for a host that already names the form (a dialog) */}
        {!hideTitle && (
          <Header>
            <h1>{title}</h1>
          </Header>
        )}
        <WrapperEditor>
          <RichHtmlEditor
            label={title || t('CONTENT', 'Content')}
            placeholder={t('START_NEW_PAGE', 'Start writing your page…')}
            codeTabs
            value={body}
            onChange={handleChangeBody}
          />
        </WrapperEditor>
        <ButtonGroupWrapper>
          <Button
            borderRadius='8px'
            color='primary'
            onClick={() => handleSubmit()}
          >
            {t('ACCEPT', 'Accept')}
          </Button>
          <Button
            borderRadius='8px'
            color='secundaryDark'
            onClick={() => handleDelete()}
          >
            {t('DELETE', 'Delete')}
          </Button>
        </ButtonGroupWrapper>
      </PageContainer>
      <Alert
        title={t('BUSINESS', 'Business')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const ContentForm = (props) => {
  const contentFormProps = {
    ...props,
    UIComponent: ContentFormUI
  }
  return <ContentFormController {...contentFormProps} />
}
