import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTheme } from 'styled-components'
import { ChevronLeft as MdKeyboardArrowLeft, ChevronRight as MdKeyboardArrowRight } from '../Icon'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useLanguage } from '../../../../../index'

import {
  ScrollBox,
  ScrollBoxWrapper,
  ScrollBoxContainer,
  ArrowButton
} from './drag-scroll-styles'

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const DragScroll = ({ children }) => {
  const { width } = useWindowSize()
  const theme = useTheme()
  const [, t] = useLanguage()
  const scrollWrapperRef = useRef()
  const scrollContainerRef = useRef()
  const dragRef = useRef({ active: false, clickStartX: 0, scrollStartX: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [metrics, setMetrics] = useState({ scrollLeft: 0, wrapperWidth: 0, containerWidth: 0 })

  const measure = useCallback(() => {
    const wrapper = scrollWrapperRef.current
    const container = scrollContainerRef.current
    if (!wrapper || !container) return
    setMetrics({
      scrollLeft: wrapper.scrollLeft || 0,
      wrapperWidth: wrapper.offsetWidth || 0,
      containerWidth: container.offsetWidth || 0
    })
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [children, measure, width])

  useEffect(() => {
    const timeout = window.setTimeout(measure, 300)
    return () => window.clearTimeout(timeout)
  }, [measure])

  const handleDragStart = event => {
    if (event.currentTarget.ontouchstart !== undefined) return
    dragRef.current = {
      active: true,
      clickStartX: event.screenX,
      scrollStartX: event.currentTarget.scrollLeft
    }
    setIsDragging(true)
  }

  const handleDragMove = event => {
    if (!dragRef.current.active) return
    const touchDelta = dragRef.current.clickStartX - event.screenX
    event.currentTarget.scrollLeft = dragRef.current.scrollStartX + touchDelta
    const scrollLeft = event.currentTarget.scrollLeft
    setMetrics(current => ({ ...current, scrollLeft }))
  }

  const handleDragEnd = () => {
    if (!dragRef.current.active) return
    dragRef.current = { active: false, clickStartX: 0, scrollStartX: 0 }
    setIsDragging(false)
  }

  const handleScrolling = left => {
    const wrapper = scrollWrapperRef.current
    const container = scrollContainerRef.current
    if (!wrapper || !container) return
    const distance = Math.max(200, container.offsetWidth / 10)
    wrapper.scrollBy({
      top: 0,
      left: left ? -distance : distance,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    })
  }

  const { scrollLeft, wrapperWidth, containerWidth } = metrics
  const rtlPosition = scrollLeft * -1
  const showLeft = theme?.rtl
    ? rtlPosition + wrapperWidth + 10 < containerWidth
    : scrollLeft > 10
  const showRight = theme?.rtl
    ? rtlPosition > 10
    : scrollLeft + wrapperWidth + 10 < containerWidth

  return (
    <ScrollBox isDragging={isDragging}>
      <ScrollBoxWrapper
        ref={scrollWrapperRef}
        isDragging={isDragging}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onScroll={measure}
      >
        {showLeft && (
          <ArrowButton
            type='button'
            className='left-autoscroll'
            aria-label={t('SCROLL_LEFT', 'Scroll left')}
            data-scroll-action='left'
            onClick={() => handleScrolling(true)}
          >
            <MdKeyboardArrowLeft aria-hidden='true' />
          </ArrowButton>
        )}
        <ScrollBoxContainer role='list' ref={scrollContainerRef}>
          {children}
        </ScrollBoxContainer>
        {showRight && (
          <ArrowButton
            type='button'
            className='right-autoscroll'
            aria-label={t('SCROLL_RIGHT', 'Scroll right')}
            data-scroll-action='right'
            onClick={() => handleScrolling(false)}
          >
            <MdKeyboardArrowRight aria-hidden='true' />
          </ArrowButton>
        )}
      </ScrollBoxWrapper>
    </ScrollBox>
  )
}
