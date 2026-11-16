import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { IconButton } from '../../../styles/Buttons'
import { X, Maximize2, Minimize2 } from '../Icon'
import { hasActiveDialogLayer } from './dialog-layer'
import { captureSidebarDismissal, ownsCapturedSidebarDismissal, registerSidebar } from './sidebar-layer'
import { BarContainer, IconButtonWrapper } from './sidebar-styles'

export const SideBar = props => {
  const {
    open,
    defaultSideBarWidth,
    moveDistance,
    isBorderShow,
    isCloseOutsideClick,
    containerRef,
    noAnimation,
    handleCloseWizard,
    IconTop,
    showExpandIcon,
    sidebarId,
    sidebarSettingContainer
  } = props
  const [, t] = useLanguage()
  const sideBarRef = useRef(null)
  const { width } = useWindowSize()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const sideBarWidth = defaultSideBarWidth || 500

  // (main): `open` drives the width both ways, so a panel that stays mounted (the WhatsApp bot panel after a reload)
  // hides when it turns false, and opens again without the earlier expansion
  useEffect(() => {
    if (!sideBarRef.current) return
    if (!isMenuOpen) {
      sideBarRef.current.style.width = '0px'
      return
    }
    if (width <= 768 || width <= sideBarWidth) {
      sideBarRef.current.style.width = 'var(--app-width, 100vw)'
    } else {
      sideBarRef.current.style.width = `${sideBarWidth}px`
    }
  }, [width, sideBarWidth, isMenuOpen])

  useEffect(() => {
    if (!open) setIsExpand(false)
    setIsMenuOpen(Boolean(open))
  }, [open])

  const expandSideBar = () => {
    if (isExpand) sideBarRef.current.style.width = `${sideBarWidth}px`
    else sideBarRef.current.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  useEffect(() => {
    if (!open) return
    const dismissWidth = width ?? window.innerWidth
    const unregister = registerSidebar(sideBarRef)
    const captureDismissal = event => captureSidebarDismissal(event, hasActiveDialogLayer())
    const onCloseSidebar = event => {
      if (!ownsCapturedSidebarDismissal(event, sideBarRef)) return
      if (event.code === 'Escape' && dismissWidth >= 1000) {
        props.onClose && props.onClose()
        handleCloseWizard && handleCloseWizard()
      }
    }
    const onClick = event => {
      if (!ownsCapturedSidebarDismissal(event, sideBarRef)) return
      if (open && isCloseOutsideClick) {
        const outsideSideBar = !sideBarRef?.current?.contains(event.target) && !containerRef?.current?.contains(event.target) && !sidebarSettingContainer?.current?.contains(event.target)
        if (outsideSideBar) {
          props.onClose && props.onClose()
        }
      }
    }
    document.addEventListener('keydown', captureDismissal, true)
    document.addEventListener('click', captureDismissal, true)
    document.addEventListener('keydown', onCloseSidebar)
    document.addEventListener('click', onClick)

    return () => {
      unregister()
      document.removeEventListener('click', captureDismissal, true)
      document.removeEventListener('keydown', captureDismissal, true)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onCloseSidebar)
    }
  }, [open])

  return (
    <BarContainer
      ref={sideBarRef}
      isBorderShow={isBorderShow}
      moveDistance={moveDistance}
      noAnimation={noAnimation}
      id={sidebarId ?? 'sideSlider'}
    >
      <IconButtonWrapper IconTop={IconTop}>
        {width > 576 && showExpandIcon && (
          <IconButton
            color='black'
            aria-label={isExpand ? t('COLLAPSE', 'Collapse') : t('CLICK_TO_EXPAND', 'Click to expand')}
            aria-expanded={isExpand}
            onClick={() => expandSideBar()}
          >
            {isExpand ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
        )}
        <IconButton
          color='black'
          aria-label={t('CLOSE', 'Close')}
          onClick={() => props.onClose()}
        >
          <X />
        </IconButton>
      </IconButtonWrapper>
      {props.children}
    </BarContainer>
  )
}
