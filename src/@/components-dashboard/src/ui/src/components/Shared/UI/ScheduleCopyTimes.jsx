import React, { useId, useLayoutEffect, useRef, useEffect } from 'react'
import { Copy as MdcContentCopy, Square as RiCheckboxBlankLine, SquareCheck as RiCheckboxFill } from '../Icon'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles/Buttons'

import {
  CopyTimesContainer,
  HeaderItem,
  PopoverBody,
  Title,
  PopoverList,
  CopyItem
} from './schedule-copy-times-styles'

export const ScheduleCopyTimes = (props) => {
  const {
    disabled,
    label,
    open,
    daysOfWeekIndex,
    selectedCopyDays,
    handleSelectDays,
    cleanSelectedCopyDays,
    handleApplyScheduleCopyTimes
  } = props
  const [, t] = useLanguage()
  const referenceElement = useRef()
  const popperElement = useRef()
  const popupId = useId()
  const titleId = `${popupId}-title`

  const daysOptions = [
    { value: 0, content: t('DAY7', 'Sunday') },
    { value: 1, content: t('DAY1', 'Monday') },
    { value: 2, content: t('DAY2', 'Tuesday') },
    { value: 3, content: t('DAY3', 'Wednesday') },
    { value: 4, content: t('DAY4', 'Thursday') },
    { value: 5, content: t('DAY5', 'Friday') },
    { value: 6, content: t('DAY6', 'Saturday') }
  ]

  const handleClickOutside = (e) => {
    if (!open) return
    const outsidePopover = !popperElement.current?.contains(e.target)
    const outsidePopoverMenu = !referenceElement.current?.contains(e.target)
    if (outsidePopover && outsidePopoverMenu) {
      props.onClose && props.onClose()
    }
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Escape' || e.keyCode === 27) && open) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation?.()
      props.onClose && props.onClose()
      referenceElement.current?.focus()
    }
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('mouseup', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    cleanSelectedCopyDays()
  }, [open])

  useLayoutEffect(() => {
    if (!open || !popperElement.current) return undefined
    const keepPopoverInViewport = () => {
      const panel = popperElement.current
      if (!panel) return
      panel.style.removeProperty('left')
      panel.style.removeProperty('right')
      const bounds = panel.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      let ancestor = panel.parentElement
      let usesViewportCoordinates = false
      while (ancestor && ancestor !== document.documentElement) {
        if (window.getComputedStyle(ancestor).position === 'fixed') {
          usesViewportCoordinates = true
          break
        }
        ancestor = ancestor.parentElement
      }
      const scrollX = usesViewportCoordinates ? 0 : Math.min(window.scrollX ?? window.pageXOffset ?? 0, 0)
      const measuredLeft = bounds.left + scrollX
      const measuredRight = bounds.right + scrollX
      if (measuredLeft >= 0 && measuredRight <= viewportWidth) return
      const targetLeft = Math.max(0, Math.min(measuredLeft, viewportWidth - bounds.width))
      const scale = panel.offsetWidth ? bounds.width / panel.offsetWidth : 1
      const layoutLeft = panel.offsetLeft + ((targetLeft - measuredLeft) / scale)
      panel.style.left = `${layoutLeft}px`
      panel.style.right = 'auto'
    }
    keepPopoverInViewport()
    window.addEventListener('resize', keepPopoverInViewport)
    return () => window.removeEventListener('resize', keepPopoverInViewport)
  }, [open])

  return (
    <CopyTimesContainer>
      <HeaderItem
        ref={referenceElement}
        type='button'
        aria-controls={open ? popupId : undefined}
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-label={label || t('COPY_TIMES_TO', 'Copy times to')}
        disabled={disabled}
        onClick={() => props.onClick(daysOfWeekIndex)}
      >
        <MdcContentCopy aria-hidden='true' />
      </HeaderItem>
      {open && (
        <PopoverBody
          id={popupId}
          ref={popperElement}
          role='dialog'
          aria-labelledby={titleId}
        >
          <Title id={titleId}>{t('COPY_TIMES_TO', 'Copy times to')}</Title>
          <PopoverList>
            {daysOptions.map(option => {
              const isSource = option.value === daysOfWeekIndex
              const isChecked = isSource || selectedCopyDays.includes(option.value)
              return (
                <CopyItem
                  key={option.value}
                  type='button'
                  aria-label={option.content}
                  aria-pressed={isChecked}
                  data-day={option.value}
                  disabled={isSource}
                  isChecked={isChecked}
                  onClick={() => handleSelectDays(option.value)}
                >
                  {isChecked
                    ? (
                    <RiCheckboxFill aria-hidden='true' />
                      )
                    : (
                    <RiCheckboxBlankLine aria-hidden='true' />
                      )}
                  <span>
                    {option.content}
                  </span>
                </CopyItem>
              )
            })}
          </PopoverList>
          <Button
            type='button'
            color='primary'
            onClick={() => {
              handleApplyScheduleCopyTimes(daysOfWeekIndex)
              props.onClose && props.onClose()
            }}
          >
            {t('APPLY', 'Apply')}
          </Button>
        </PopoverBody>
      )}
    </CopyTimesContainer>
  )
}
