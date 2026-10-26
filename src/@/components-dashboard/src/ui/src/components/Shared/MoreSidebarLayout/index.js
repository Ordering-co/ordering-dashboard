import React, { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { XLg } from 'react-bootstrap-icons'
import { IconButton } from '../../../styles/Buttons'
import { MORE_SIDEBAR_MODAL_MAX_WIDTH } from './constants'

import {
  MainContainer,
  CloseButtonWrapper
} from './styles'
export const MoreSidebarLayout = (props) => {
  const {
    isExtendExtraOpen,
    closeButtonAlignToEdge
  } = props
  const { width } = useWindowSize()
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (width > MORE_SIDEBAR_MODAL_MAX_WIDTH) setIsModalOpen(false)
    else setIsModalOpen(true)
  }, [width])
  return (
    <>
      {width > MORE_SIDEBAR_MODAL_MAX_WIDTH
        ? (<MainContainer>
            <CloseButtonWrapper
              isExtendExtraOpen={isExtendExtraOpen}
              alignToEdge={closeButtonAlignToEdge}
            >
              <IconButton
                color='black'
                onClick={() => props.onClose()}
              >
                <XLg />
              </IconButton>
            </CloseButtonWrapper>
            {props.children}
          </MainContainer>)
        : (isModalOpen
            ? <Modal
              width='80%'
              open={isModalOpen}
              onClose={() => props.onClose()}
            >
              {props.children}
            </Modal>
            : null)}
    </>
  )
}
