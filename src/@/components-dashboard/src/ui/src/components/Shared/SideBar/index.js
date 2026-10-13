import React, { useState, useEffect, useRef } from 'react'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { XLg, ArrowsAngleExpand, ArrowsAngleContract } from 'react-bootstrap-icons'
import { IconButton } from '../../../styles'
import {
  BarContainer,
  IconButtonWrapper
} from './styles'

export const SideBar = (props) => {
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

  const sideBarRef = useRef(null)
  const { width } = useWindowSize()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isExpand, setIsExpand] = useState(false)
  const sideBarWidth = defaultSideBarWidth || 500

  const actionSidebar = (value) => {
    if (!value) {
      props.onClose()
    }
    setIsMenuOpen(value)
  }

  useEffect(() => {
    if (isMenuOpen) {
      if (width <= 768 || width <= sideBarWidth) {
        sideBarRef.current.style.width = 'var(--app-width, 100vw)'
      } else {
        sideBarRef.current.style.width = `${sideBarWidth}px`
      }
    }
  }, [width, sideBarWidth, isMenuOpen])

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open, defaultSideBarWidth])

  const onCloseSidebar = (e) => {
    if (e.code === 'Escape' && width >= 1000) {
      props.onClose && props.onClose()
      handleCloseWizard && handleCloseWizard()
    }
  }

  const onClick = (e) => {
    if (open && isCloseOutsideClick) {
      const outsideSideBar = !sideBarRef?.current?.contains(e.target) && !containerRef?.current?.contains(e.target) && !sidebarSettingContainer?.current?.contains(e.target)
      if (outsideSideBar) {
        props.onClose && props.onClose()
      }
    }
  }

  const expandSideBar = () => {
    if (isExpand) sideBarRef.current.style.width = `${sideBarWidth}px`
    else sideBarRef.current.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onCloseSidebar)
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onCloseSidebar)
    }
  }, [open])

  return (
    <>
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
              onClick={() => expandSideBar()}
            >
              {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
            </IconButton>
          )}
          <IconButton
            color='black'
            onClick={() => props.onClose()}
          >
            <XLg />
          </IconButton>
        </IconButtonWrapper>
        {props.children}
      </BarContainer>
    </>
  )
}
