import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Video } from '../../Shared/Icon'
import { Button } from '../../Shared/Product'
import './business-sync.css'

/**
 * Click-to-play facade for a provider video (redesign stores 3.D, ). `loading='lazy'` does not stop Chromium from asking
 * YouTube when the frame is within ~1250px of the viewport, so the page makes no request to YouTube until the user asks for it:
 * before pressing there is no iframe and no thumbnail (nothing from youtube.com / ytimg.com), only a neutral 16:9 frame with one
 * native button. Pressing mounts the iframe with the same `src` plus `autoplay=1`.
 * The focus then goes to the frame around the player (a named group), not into the iframe: keys typed in a cross-origin
 * iframe never reach the page, so Escape would no longer close the Sheet (review r1 #1). The next Tab enters the player.
 */
export const SyncVideo = ({ src, title }) => {
  const [, t] = useLanguage()
  const [playing, setPlaying] = useState(false)
  const groupRef = useRef(null)

  useEffect(() => {
    if (playing) groupRef.current?.focus()
  }, [playing])

  const playSrc = `${src}${src.includes('?') ? '&' : '?'}autoplay=1`

  return (
    <div
      ref={groupRef}
      className='stores-sync-video'
      role={playing ? 'group' : undefined}
      aria-label={playing ? title : undefined}
      tabIndex={playing ? -1 : undefined}
    >
      {playing
        ? (
          <iframe
            title={title}
            src={playSrc}
            loading='lazy'
            allow='autoplay; encrypted-media; picture-in-picture'
            allowFullScreen
          />
          )
        : (
          <Button
            variant='ghost'
            className='stores-sync-video-play'
            icon={Video}
            aria-label={t('PLAY_VIDEO_OF', 'Play video: _title_').replace('_title_', title)}
            onClick={() => setPlaying(true)}
          >
            {title}
          </Button>
          )}
    </div>
  )
}
