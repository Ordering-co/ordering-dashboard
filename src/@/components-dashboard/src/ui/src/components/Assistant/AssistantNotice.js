import React from 'react'
import { useLanguage, useAssistant } from '../../../../index'
import { ASSISTANT_NOTICE_VERSION, getAssistantNotice } from '../../../../contexts/AssistantContext/notice'
import { Button, InlineNotice } from '../Shared/Product'
import { Check, MessageSquare, TriangleAlert } from '../Shared/Icon'
import './assistant.css'

/**
 * The data notice, accepted once per version before the first message
 */
export const AssistantNotice = ({ page }) => {
  const [languageState] = useLanguage()
  const { status, noticeState, noticeOutdated, acceptNotice } = useAssistant()
  // All the text is fixed in code, not in translations; see notice.js
  const notice = getAssistantNotice(languageState?.language?.code)
  // The title of the page is the h1 and the one of the panel an h2, so the notice goes one level under
  const Heading = page ? 'h2' : 'h3'
  const pageProp = page ? '' : undefined

  // redesign AS-B (D3, M-AS7): the notice on Product: icon in a soft box, check points, muted paragraphs, a full-width primary
  return (
    <>
      <div className='odc-root odc-as-body' data-page={pageProp}>
        <div className='odc-as-center'>
          <span className='odc-as-legal-icon'><MessageSquare className='odc-icon' /></span>
          <Heading className='odc-as-heading'>{notice.title}</Heading>
          {notice.points.map(point => (
            <div key={point} className='odc-as-point'>
              <Check className='odc-icon' />
              <span>{point}</span>
            </div>
          ))}
          {notice.paragraphs.map(paragraph => (
            <p key={paragraph} className='odc-as-legal-text'>{paragraph}</p>
          ))}
          <p className='odc-as-legal-text'>{notice.version.replace('_version_', ASSISTANT_NOTICE_VERSION)}</p>
        </div>
      </div>
      <div className='odc-root odc-as-composer' data-page={pageProp}>
        {noticeOutdated && (
          <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{notice.outdated}</InlineNotice>
        )}
        {noticeState.error && (
          <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{notice.error}</InlineNotice>
        )}
        {!noticeOutdated && (
          <Button
            variant='primary'
            size='lg'
            className='odc-as-accept'
            busy={noticeState.loading}
            disabled={!status.noticeVersion}
            onClick={acceptNotice}
          >
            {notice.accept}
          </Button>
        )}
      </div>
    </>
  )
}
