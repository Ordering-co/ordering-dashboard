import React, { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import * as Icon from 'react-bootstrap-icons'
import Skeleton from 'react-loading-skeleton'
import { useLanguage, PurchaseAddons as PurchaseAddonsController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { Modal } from '../../Shared'
import { PurchaseAddonDetails } from '../PurchaseAddonDetails'

import {
  Container,
  CategoryContainer,
  HeaderTitleContainer,
  ItemWrapper,
  IconWrapper,
  ItemContent,
  InfoWrapper,
  InfoContent
} from './styles'

const PurchaseAddonsUI = (props) => {
  const {
    title,
    description,
    publicAddons,
    purchasedAddons
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const isLoadingAddons = publicAddons?.loading || purchasedAddons?.loading
  const history = useHistory()
  const query = new URLSearchParams(useLocation().search)

  const [selectedAddon, setSelectedAddon] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  const handleBackRedirect = () => {
    setShowDetail(false)
    setSelectedAddon(null)
    history.replace(`${location.pathname}`)
  }

  const handleOpenSetting = (addon, initialRender) => {
    setSelectedAddon(addon)
    setShowDetail(true)
    if (!initialRender) {
      history.replace(`${location.pathname}?id=${addon?.id}`)
    }
  }

  const IconBootstrap = (props) => {
    const IconComponent = Icon?.[props.name] || Icon.BagPlusFill
    return (
      <IconComponent color={props.color} />
    )
  }

  useEffect(() => {
    if (publicAddons?.loading || purchasedAddons?.loading) return
    const addonId = query.get('id')
    if (addonId) {
      const addonSelected = publicAddons?.result
        ?.filter(option => option?.prices?.monthly?.type === 'recurring' && !purchasedAddons?.result?.includes(option?.id))
        ?.find(item => item?.id === parseInt(addonId))
      if (addonSelected) {
        handleOpenSetting(addonSelected, true)
      }
    }
  }, [publicAddons?.loading, purchasedAddons?.loading])

  return (
    <>
      <Container>
        <HeaderTitleContainer>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <IconBootstrap
                name='MenuIcon'
              />
            </IconButton>
          )}
          <h1>{title ?? t('CONFIG', 'Config')}
          </h1>
          <InfoWrapper>
            <IconButton
              color='primary'
            >
              <IconBootstrap
                name='InfoCircle'
              />
            </IconButton>
            <InfoContent>
              {description ?? t('CONFIG_DESCRIPTION', 'Config Description')}
            </InfoContent>
          </InfoWrapper>
        </HeaderTitleContainer>
        <CategoryContainer>
          {(publicAddons?.error || publicAddons?.result?.length === 0) && !isLoadingAddons && (
            <ItemContent>
              {
                publicAddons?.result?.length > 0
                  ? publicAddons?.result?.map((error, i) => <h5 key={i}>{error}</h5>)
                  : <h5>{t('NO_AVAILABLE_APPS_AND_ADDONS', 'No available apps and addons')}</h5>
              }
            </ItemContent>
          )}
          {publicAddons?.result && !isLoadingAddons && !publicAddons?.error && (
            <>
              {publicAddons?.result?.filter(option => ((option?.prices?.monthly?.type === 'recurring' && !purchasedAddons?.result?.includes(option?.id)) || (option?.prices?.monthly?.type === 'per_unit' && !purchasedAddons?.result?.includes(option?.id))))?.map(option => (
                <ItemWrapper
                  key={option?.id}
                  onClick={() => handleOpenSetting(option)}
                >
                  <IconWrapper>
                    <IconBootstrap
                      name={option?.frontend_icon_class}
                    />
                  </IconWrapper>
                  <ItemContent>
                    <h5>{option?.name}</h5>
                    <p>{option?.description}</p>
                  </ItemContent>
                </ItemWrapper>
              ))}
            </>
          )}
        </CategoryContainer>
        {!isLoadingAddons && publicAddons?.result?.filter((option) => purchasedAddons?.result?.includes(option?.id)).length > 0 && (
          <>
            <span className='comming-soon'>{t('PURCHASED_ADDONS', 'Purchased Addons')}</span>
            <CategoryContainer>
              {publicAddons?.result?.filter((option) => purchasedAddons?.result?.includes(option?.id))?.map(option => (
                (!option.enabled && !option.hide) && (
                  <ItemWrapper
                    key={option?.id}
                  >
                    <IconWrapper>
                      <IconBootstrap
                        name={option?.frontend_icon_class}
                      />
                    </IconWrapper>
                    <ItemContent>
                      <h5>{option?.name}</h5>
                      <p>{option?.description}</p>
                    </ItemContent>
                  </ItemWrapper>
                )
              ))}
            </CategoryContainer>
          </>
        )}
        {isLoadingAddons && (
          <CategoryContainer>
            {[...Array(6).keys()].map(i => (
              <ItemWrapper key={i}>
                <IconWrapper>
                  <Skeleton width={64} height={64} />
                </IconWrapper>
                <ItemContent>
                  <Skeleton width={300} />
                  <Skeleton width={200} />
                </ItemContent>
              </ItemWrapper>
            ))}
          </CategoryContainer>
        )}
      </Container>

      {showDetail && (
        <Modal
          width='60%'
          padding='30px'
          open={showDetail}
          onClose={handleBackRedirect}
        >
          <PurchaseAddonDetails selectedAddon={selectedAddon} onClose={handleBackRedirect} />
        </Modal>
      )}
    </>
  )
}

export const PurchaseAddons = (props) => {
  const purchaseAddonsProps = {
    ...props,
    UIComponent: PurchaseAddonsUI
  }

  return <PurchaseAddonsController {...purchaseAddonsProps} />
}
