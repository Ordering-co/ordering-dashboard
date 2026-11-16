import React, { useId, useState } from 'react'
import { useLanguage } from '../../../../../../index'
import { Button } from '../../../../styles/Buttons'
import { Input } from '../../../../styles/Inputs'

import {
  InsertLinkContainer,
  WrapperInput
} from './insert-video-styles'
import { formatUrlVideo } from '../../../../utils/formatUrlVideo'

export const InsertVideo = (props) => {
  const {
    editorContext,
    onClose,
    handleRestoreEditor
  } = props
  const [, t] = useLanguage()
  const [videoUrl, setVideoUrl] = useState(null)
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const urlId = `${dialogId}-url`

  const getVideoEmbedded = (video) => {
    if (video.indexOf('youtube')) {
      return '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/' + formatUrlVideo(video) + '" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>'
    }
  }

  const handleInsertClick = () => {
    const HTMLstring = getVideoEmbedded(videoUrl)
    handleRestoreEditor()
    editorContext.invoke('editor.pasteHTML', HTMLstring)
    onClose()
  }
  return (
    <InsertLinkContainer role='group' aria-labelledby={titleId}>
      <h1 id={titleId}>{t('INSERT_VIDEO', 'Insert video')}</h1>
      <WrapperInput>
        <label htmlFor={urlId}>{t('VIDEO_URL', 'Video url')}</label>
        <Input
          id={urlId}
          data-editor-input='video-url'
          name='text'
          onChange={e => setVideoUrl(e.target.value)}
        />
      </WrapperInput>
      <Button
        type='button'
        data-editor-action='insert-video'
        borderRadius='8px'
        color='primary'
        onClick={() => handleInsertClick()}
      >
        {t('INSERT', 'Insert')}
      </Button>
    </InsertLinkContainer>
  )
}
