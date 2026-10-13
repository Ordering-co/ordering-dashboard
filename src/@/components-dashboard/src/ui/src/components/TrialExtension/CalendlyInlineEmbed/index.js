import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { parseCalendlyMessage } from '../../../utils/trialExtension'
import {
  BookedElsewhere,
  BookedElsewhereButton,
  FailedNotice,
  IframeContainer,
  ProminentLink,
  SecondaryLink,
  StatusText,
  StyledIframe,
  Wrapper
} from './styles'

const LOAD_TIMEOUT_MS = 12000

/**
 * Renders the Calendly event type directly as an <iframe> (no widget.js). Listens for
 * Calendly's own postMessage events to auto-size the container and detect a completed booking.
 * Falls back to a prominent "open in a new tab" link if nothing loads within 12s.
 *
 * A booking made in a new tab can't be observed (no postMessage reaches this page), so once
 * the visitor opens the calendar in a new tab we offer an "I've booked my call" action that
 * calls the same `onScheduled` handler as an in-embed booking. "Opened" covers a left click, a
 * middle click (auxclick) and opening the link's context menu ("Open link in new tab").
 */
export const CalendlyInlineEmbed = (props) => {
  const { embedUrl, fallbackUrl, onScheduled } = props

  const [, t] = useLanguage()
  const iframeRef = useRef(null)
  const scheduledRef = useRef(false)
  const timeoutRef = useRef(null)

  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [height, setHeight] = useState(null)
  const [openedInNewTab, setOpenedInNewTab] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    setHeight(null)
    setOpenedInNewTab(false)
    scheduledRef.current = false

    timeoutRef.current = window.setTimeout(() => {
      setFailed(true)
    }, LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutRef.current)
  }, [embedUrl])

  useEffect(() => {
    const handleMessage = (event) => {
      const iframeWindow = iframeRef.current?.contentWindow
      const message = parseCalendlyMessage(event, iframeWindow)
      if (!message) return

      if (message.type === 'calendly.page_height' || message.type === 'calendly.event_type_viewed') {
        if (message.height) setHeight(message.height)
        setLoaded(true)
        // Calendly may answer after the 12s timeout: drop the error notice once it does.
        setFailed(false)
        window.clearTimeout(timeoutRef.current)
      }

      if (message.type === 'calendly.event_scheduled' && !scheduledRef.current) {
        scheduledRef.current = true
        onScheduled && onScheduled(message.payload)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onScheduled])

  const sized = height != null

  // Idempotent: any number of clicks/menus only reveals the action once.
  const handleOpenedInNewTab = () => setOpenedInNewTab(true)
  const newTabLinkHandlers = {
    onClick: handleOpenedInNewTab,
    onAuxClick: handleOpenedInNewTab,
    onContextMenu: handleOpenedInNewTab
  }

  const handleBookedElsewhere = () => {
    if (scheduledRef.current) return
    scheduledRef.current = true
    onScheduled && onScheduled()
  }

  return (
    <Wrapper>
      <IframeContainer $height={height}>
        <StyledIframe
          ref={iframeRef}
          $sized={sized}
          title={t('TRIAL_EXTENSION_CALENDAR_IFRAME_TITLE', 'Book a call with our team')}
          src={embedUrl}
        />
      </IframeContainer>
      {!loaded && !failed && (
        <StatusText role='status'>
          {t('TRIAL_EXTENSION_CALENDAR_LOADING', 'Loading the calendar…')}
        </StatusText>
      )}
      {failed && (
        <FailedNotice role='alert'>
          <p>{t('TRIAL_EXTENSION_CALENDAR_FAILED', 'The calendar could not load here. Open it in a new tab instead.')}</p>
          <ProminentLink href={fallbackUrl} target='_blank' rel='noopener noreferrer' {...newTabLinkHandlers}>
            {t('TRIAL_EXTENSION_OPEN_NEW_TAB_PROMINENT', 'Open the calendar in a new tab')}
          </ProminentLink>
        </FailedNotice>
      )}
      {openedInNewTab && (
        <BookedElsewhere>
          <BookedElsewhereButton type='button' onClick={handleBookedElsewhere}>
            {t('TRIAL_EXTENSION_ALREADY_BOOKED', "I've booked my call")}
          </BookedElsewhereButton>
        </BookedElsewhere>
      )}
      <SecondaryLink href={fallbackUrl} target='_blank' rel='noopener noreferrer' {...newTabLinkHandlers}>
        {t('TRIAL_EXTENSION_OPEN_NEW_TAB', 'Open in a new tab')}
      </SecondaryLink>
    </Wrapper>
  )
}
