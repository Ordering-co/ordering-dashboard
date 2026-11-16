import React, { useId } from 'react'
import { useTheme } from 'styled-components'

import { useLanguage } from '../../../../../index'
import { EmailPreviewFrame } from './EmailPreviewFrame'
import './recovery-rule-panel.css'

// redesign RA-B3 (decision 5; M-RA8): the facsimile of a recovery message. It is a SIMULATION of another surface (the customer's inbox or
// phone), so it keeps the shapes of main (CartRecovery/RecoveryNotificationList): an email in a window with three dots, an SMS or a push
// notification in the silhouette of a phone over `theme.images.general.mobileHalfMask`. Only its values come from tokens (the guard of
// literals), never from the roles of the interface.
// Readable content, never aria-hidden: a `figure` named by a visually hidden «Preview» caption.

/**
 * Props: `channel` ('email', 'sms', 'notification'; any other value reads as text in the phone), `title` (text) and `body`: HTML for an
 * email (painted in a sandboxed iframe, never injected into the app: ), plain text for the others.
 * RuleMessages draws one per message, RulePanel one live in the create form and RuleMessageDialog (RA-B4) one while the message is edited.
 */
export const MessagePreview = ({ channel, title, body }) => {
  const [, t] = useLanguage()
  const theme = useTheme()
  const captionId = useId()
  const mask = theme?.images?.general?.mobileHalfMask

  return (
    <figure className='odc-root odc-ra-preview' data-channel={channel} aria-labelledby={captionId}>
      <figcaption id={captionId} className='odc-sr-only'>{t('PREVIEW', 'Preview')}</figcaption>
      {channel === 'email'
        ? (
          <div className='odc-ra-preview-window'>
            <div className='odc-ra-preview-bar'>
              <span className='odc-ra-preview-dot' />
              <span className='odc-ra-preview-dot' />
              <span className='odc-ra-preview-dot' />
            </div>
            <div className='odc-ra-preview-mail'>
              <h2 className='odc-ra-preview-mail-title'>{title}</h2>
              <div className='odc-ra-preview-mail-body'>
                <EmailPreviewFrame body={body} />
              </div>
            </div>
          </div>
          )
        : (
          <div className='odc-ra-preview-phone'>
            <div className='odc-ra-preview-phone-screen' style={mask ? { backgroundImage: `url(${mask})` } : undefined}>
              <div className='odc-ra-preview-phone-message'>
                <p className='odc-ra-preview-phone-title'>{title}</p>
                <p className='odc-ra-preview-phone-body'>{body}</p>
              </div>
            </div>
          </div>
          )}
    </figure>
  )
}
