import React, { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { AutoscrollContainer, AutoScrollArrow } from './auto-scroll-styles'
import { ChevronLeft as MdKeyboardArrowLeft, ChevronRight as MdKeyboardArrowRight } from '../Icon'
import { useLanguage } from '../../../../../index'
import { useTheme } from '../../../contexts/ThemeContext'

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const AutoScroll = ({ children, modal, special, innerScroll, scrollId }) => {
  const { width } = useWindowSize()
  const generatedId = useId().replace(/:/g, '')
  const autoScrollId = scrollId || `autoscroll-${generatedId}`
  const rootRef = useRef()
  const parentRef = useRef()
  const scrollportRef = useRef()
  const [theme] = useTheme()
  const [, t] = useLanguage()
  const [metrics, setMetrics] = useState({
    parentWidth: 0,
    scrollportWidth: 0,
    showLeft: false,
    showRight: false
  })

  const syncScrollState = useCallback(() => {
    const parentElement = parentRef.current
    const scrollport = scrollportRef.current
    if (!parentElement || !scrollport) return
    const parentWidth = parentElement.offsetWidth || 0
    const scrollportWidth = scrollport.offsetWidth || 0
    const maxScroll = Math.max(0, parentElement.scrollWidth - scrollportWidth)
    if (theme?.rtl) {
      const position = scrollport.scrollLeft * -1
      setMetrics({
        parentWidth,
        scrollportWidth,
        showLeft: position <= maxScroll - 20,
        showRight: position >= 40
      })
      return
    }
    setMetrics({
      parentWidth,
      scrollportWidth,
      showLeft: scrollport.scrollLeft >= 40,
      showRight: scrollport.scrollLeft <= maxScroll - 40
    })
  }, [theme?.rtl])

  useLayoutEffect(() => {
    const parentElement = rootRef.current?.parentElement
    const scrollport = parentElement?.parentElement
    parentRef.current = parentElement
    scrollportRef.current = scrollport
    if (!scrollport) return undefined

    scrollport.addEventListener('scroll', syncScrollState, { passive: true })
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(syncScrollState)
      : null
    if (resizeObserver) {
      parentElement && resizeObserver.observe(parentElement)
      resizeObserver.observe(scrollport)
    }
    syncScrollState()

    return () => {
      scrollport.removeEventListener('scroll', syncScrollState)
      resizeObserver?.disconnect()
      parentRef.current = undefined
      scrollportRef.current = undefined
    }
  }, [autoScrollId, syncScrollState])

  useLayoutEffect(() => {
    syncScrollState()
  }, [children, innerScroll, special, syncScrollState, width])

  const scrolling = left => {
    const parentElement = parentRef.current
    const scrollport = scrollportRef.current
    if (!parentElement || !scrollport) return
    const distance = Math.max(200, parentElement.offsetWidth / 10)
    scrollport.scrollBy({
      top: 0,
      left: left ? -distance : distance,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    })
  }

  const { parentWidth, scrollportWidth, showLeft, showRight } = metrics
  const hasOverflow = (
    (!special ? width < parentWidth + 50 : width < parentWidth) ||
    ((!special && innerScroll) ? scrollportWidth < parentWidth + 50 : scrollportWidth < parentWidth)
  )
  const hideModalArrows = Boolean(modal && width >= 768)
  const hideLeft = !showLeft || hideModalArrows
  const hideRight = !showRight || hideModalArrows

  return (
    <AutoscrollContainer
      ref={rootRef}
      modal={modal}
      special={special}
      innerScroll={innerScroll}
      id={autoScrollId}
    >
      {hasOverflow && (
        <AutoScrollArrow
          type='button'
          aria-label={t('SCROLL_LEFT', 'Scroll left')}
          aria-controls={autoScrollId}
          aria-hidden={hideLeft || undefined}
          data-scroll-action='left'
          data-hidden={hideLeft ? '' : undefined}
          disabled={hideLeft}
          tabIndex={hideLeft ? -1 : undefined}
          onClick={() => scrolling(true)}
        >
          <MdKeyboardArrowLeft aria-hidden='true' />
        </AutoScrollArrow>
      )}
      {children}
      {hasOverflow && (
        <AutoScrollArrow
          type='button'
          aria-label={t('SCROLL_RIGHT', 'Scroll right')}
          aria-controls={autoScrollId}
          aria-hidden={hideRight || undefined}
          data-scroll-action='right'
          data-hidden={hideRight ? '' : undefined}
          disabled={hideRight}
          tabIndex={hideRight ? -1 : undefined}
          onClick={() => scrolling(false)}
        >
          <MdKeyboardArrowRight aria-hidden='true' />
        </AutoScrollArrow>
      )}
    </AutoscrollContainer>
  )
}
