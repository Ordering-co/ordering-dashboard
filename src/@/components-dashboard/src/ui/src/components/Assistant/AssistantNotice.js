import React from 'react'
import { Check2, Stars } from 'react-bootstrap-icons'
import { useLanguage, useAssistant } from '../../../../index'
import { ASSISTANT_NOTICE_VERSION, getAssistantNotice } from '../../../../contexts/AssistantContext/notice'
import { ActionButton, Body, Callout, Centered, Composer, NoticeIcon, NoticePoint, NoticeText } from './styles'

/**
 * The data notice, accepted once per version before the first message
 */
export const AssistantNotice = ({ page }) => {
  const [languageState] = useLanguage()
  const { status, noticeState, noticeOutdated, acceptNotice } = useAssistant()
  // All the text is fixed in code, not in translations; see notice.js
  const notice = getAssistantNotice(languageState?.language?.code)

  return (
    <>
      <Body page={page}>
        <Centered>
          <NoticeIcon><Stars size={22} aria-hidden /></NoticeIcon>
          <h3>{notice.title}</h3>
          {notice.points.map(point => (
            <NoticePoint key={point}>
              <Check2 size={16} aria-hidden />
              <span>{point}</span>
            </NoticePoint>
          ))}
          {notice.paragraphs.map(paragraph => (
            <NoticeText key={paragraph}>{paragraph}</NoticeText>
          ))}
          <NoticeText>{notice.version.replace('_version_', ASSISTANT_NOTICE_VERSION)}</NoticeText>
        </Centered>
      </Body>
      <Composer page={page}>
        {noticeOutdated && (
          <Callout tone='danger' role='alert'>
            {notice.outdated}
          </Callout>
        )}
        {noticeState.error && (
          <Callout tone='danger' role='alert'>
            {notice.error}
          </Callout>
        )}
        {!noticeOutdated && (
          <ActionButton type='button' primary disabled={noticeState.loading || !status.noticeVersion} onClick={acceptNotice}>
            {notice.accept}
          </ActionButton>
        )}
      </Composer>
    </>
  )
}
