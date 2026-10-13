import React, { useState } from 'react'
import { useTheme } from 'styled-components'
import { useLanguage, BusinessQRCodeOptions as BusinessQRCodeOptionsController } from '../../../../../index'
import BsChevronRight from '@meronex/icons/bs/BsChevronRight'
import { Modal } from '../../Shared'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { BusinessQRCodeOption } from '../BusinessQRCodeOption'
import { publishingItemsValues } from './utils'

import {
  MainContainer,
  PublishingContainer,
  PublishingListWrapper,
  PublishingOptionContainer,
  PublishingOption,
  PublishingName
} from './styles'

const BusinessQRCodeOptionsUI = (props) => {
  const {
    setIsExtendExtraOpen,
    siteState
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const { width } = useWindowSize()
  const [isOpen, setIsOpen] = useState(false)
  const [itemSelected, setItemSelected] = useState(null)

  const publishingItems = publishingItemsValues({ t })

  const handleAction = (value, item = null) => {
    setItemSelected(item)
    setIsExtendExtraOpen(value)
    setIsOpen(value)
  }

  return (
    <MainContainer>
      <PublishingContainer>
        <h1>{t('PUBLISHING', 'Publishing')}</h1>

        <PublishingListWrapper>
          {publishingItems.map((item, i) => (
            <PublishingOptionContainer key={i} onClick={() => handleAction(true, item)} active={item.key === itemSelected?.key}>
              <PublishingOption>
                <PublishingName>{item?.title}</PublishingName>
              </PublishingOption>
              <BsChevronRight style={{ color: theme.colors.lightGray }} />
            </PublishingOptionContainer>
          ))}
        </PublishingListWrapper>
      </PublishingContainer>

      {width >= 1000
        ? (
            isOpen && (
          <BusinessQRCodeOption
            business={props.business}
            siteState={siteState}
            open={isOpen}
            item={itemSelected}
            onClose={() => handleAction(false)}
          />
            )
          )
        : (
            isOpen && (
          <Modal
            width='80%'
            open={isOpen}
            onClose={() => handleAction(false)}
          >
            <BusinessQRCodeOption
              business={props.business}
              siteState={siteState}
              open={isOpen}
              item={itemSelected}
              onClose={() => handleAction(false)}
            />
          </Modal>
            )
          )}
    </MainContainer>
  )
}

export const BusinessQRCodeOptions = (props) => {
  const businessQRcodeOptionsProps = {
    ...props,
    UIComponent: BusinessQRCodeOptionsUI
  }
  return <BusinessQRCodeOptionsController {...businessQRcodeOptionsProps} />
}
