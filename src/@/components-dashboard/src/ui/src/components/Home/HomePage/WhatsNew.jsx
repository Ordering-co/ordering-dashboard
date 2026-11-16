import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { useFeatureAnnouncements } from '../../../hooks/useFeatureAnnouncements'
import { IconButton } from '../../Shared/Product'
import { ChevronLeft, ChevronRight, Megaphone, X } from '../../Shared/Icon'
import './whats-new.css'

// · «What's new» on the Home: the announcements of utils/featureAnnouncements.js that run for this project and person,
// one card at a time. ‹ › and the dots move between them, and a swipe on a touch screen; it never moves on its own (the person is
// reading their figures). ✕ hides the card shown for this project and person; with none left the block is not drawn. Sits after
// the trial card and the setup guide, before Today. Prefix: odc-news-*.

const SWIPE_PX = 40

export const WhatsNew = ({ onNavigate }) => {
  const [, t] = useLanguage()
  const { announcements, dismiss } = useFeatureAnnouncements()
  const [index, setIndex] = useState(0)
  const headingId = useId()
  const touchStart = useRef(null)

  const count = announcements.length
  useEffect(() => {
    if (index > 0 && index >= count) setIndex(Math.max(0, count - 1))
  }, [count, index])
  if (!count) return null

  const current = announcements[Math.min(index, count - 1)]
  const texts = current.texts(t)
  const position = Math.min(index, count - 1)
  const go = (next) => setIndex(Math.max(0, Math.min(count - 1, next)))
  const open = (event) => {
    if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(current.url)
  }
  const positionText = t('HOME_WHATS_NEW_POSITION', '_current_ of _total_')
    .replace('_current_', String(position + 1))
    .replace('_total_', String(count))

  return (
    <section
      className='odc-home-block odc-news'
      data-slot='home-whats-new'
      aria-labelledby={headingId}
      aria-roledescription={count > 1 ? t('HOME_WHATS_NEW_CAROUSEL', 'carousel') : undefined}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }}
      onTouchEnd={(event) => {
        const start = touchStart.current
        touchStart.current = null
        const end = event.changedTouches[0]?.clientX
        if (start == null || end == null || Math.abs(end - start) < SWIPE_PX) return
        const forward = end < start
        const rtl = typeof document !== 'undefined' && document.dir === 'rtl'
        go(position + ((forward !== rtl) ? 1 : -1))
      }}
    >
      <h2 className='odc-sr-only' id={headingId}>{t('HOME_WHATS_NEW', "What's new")}</h2>
      <div
        className='odc-news-card'
        role={count > 1 ? 'group' : undefined}
        aria-roledescription={count > 1 ? t('HOME_WHATS_NEW_SLIDE', 'slide') : undefined}
        aria-label={count > 1 ? positionText : undefined}
      >
        <span className='odc-news-icon' aria-hidden='true'><Megaphone className='odc-icon' /></span>
        <div className='odc-news-text'>
          <p className='odc-news-title'>
            <span className='odc-news-tag'>{t('NEW', 'New')}</span>
            <span>{texts.title}</span>
          </p>
          <p className='odc-news-description'>{texts.description}</p>
        </div>
        <a className='odc-btn' data-variant='primary' data-size='md' href={current.url} onClick={open}>
          {texts.action}
        </a>
        <IconButton
          icon={X}
          size='sm'
          label={t('HOME_WHATS_NEW_DISMISS', 'Hide _title_').replace('_title_', texts.title)}
          onClick={() => dismiss(current.id)}
        />
      </div>
      {count > 1 && (
        <div className='odc-news-nav'>
          <span className='odc-news-position' aria-live='polite'>{positionText}</span>
          <span className='odc-news-dots'>
            {announcements.map((announcement, dot) => (
              <button
                key={announcement.id}
                type='button'
                className='odc-news-dot'
                aria-current={dot === position ? 'true' : undefined}
                aria-label={t('HOME_WHATS_NEW_SHOW', 'Show _title_').replace('_title_', announcement.texts(t).title)}
                onClick={() => go(dot)}
              />
            ))}
          </span>
          <span className='odc-news-arrows'>
            <IconButton icon={ChevronLeft} flipInRtl size='sm' label={t('PREVIOUS', 'Previous')} disabled={position === 0} onClick={() => go(position - 1)} />
            <IconButton icon={ChevronRight} flipInRtl size='sm' label={t('NEXT', 'Next')} disabled={position === count - 1} onClick={() => go(position + 1)} />
          </span>
        </div>
      )}
    </section>
  )
}
