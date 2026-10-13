import React, { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { List as MenuIcon, BarChartSteps, Wallet as Cash } from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { LearnDropDown, SideBar } from '../../Shared'
import { Wallet } from '../Wallet'
import { PointsWalletLevels } from '../PointsWalletLevels'

import {
  Container,
  HeaderTitleContainer,
  LoyaltyListContainer,
  LoyaltyItemWrapper,
  IconWrapper,
  LoyaltyItemContent,
  InfoWrapper,
  InfoContent
} from './styles'
import { learnOptionsValues } from '../../../utils'

export const RewardsPrograms = (props) => {
  const {
    isPointsWallets,
    isWalletRefunds
  } = props

  const history = useHistory()
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const [showOption, setShowOption] = useState(null)
  const [moveDistance, setMoveDistance] = useState(0)
  const [levelMoveDistance, setLevelMoveDistance] = useState(0)

  const walletList = [
    { enabled: isPointsWallets, key: 'credit_point', name: t('POINTS_WALLET', 'Points wallet'), description: t('POINTS_WALLET_DESCRIPTION', 'Points wallet general and per business setup.'), icon: <Cash /> },
    { enabled: isPointsWallets, key: 'levels', name: t('LEVELS', 'Levels'), description: t('LEVELS_DESCRIPTION', 'Setup different loyalty levels for your users.'), icon: <BarChartSteps /> },
    { enabled: isWalletRefunds, key: 'cashback', name: t('CASH_WALLET', 'Cash wallet'), description: t('CASH_WALLET_DESCRIPTION', 'Cash wallet general and per business setup.'), icon: <Cash /> }
  ]

  const learnOptions = learnOptionsValues(
    isPointsWallets
      ? 'points_wallets_and_levels'
      : isWalletRefunds
        ? 'cash_wallets_and_refunds'
        : [],
    t)

  const hanldeClosePointsWallet = () => {
    setMoveDistance(0)
    setShowOption(null)
    history.replace(`${location.pathname}`)
  }

  const handleCloseLevel = () => {
    setLevelMoveDistance(0)
    setShowOption(null)
    history.replace(`${location.pathname}`)
  }

  const handleOptionClick = (key, isInitialRender) => {
    setShowOption(key)
    if (!isInitialRender) {
      history.replace(`${location.pathname}?id=${key}`)
    }
  }

  useEffect(() => {
    const id = query.get('id')
    if (id) {
      handleOptionClick(id, true)
    }
  }, [])

  return (
    <>
      <Container>
        <HeaderTitleContainer>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{isPointsWallets
            ? t('POINT_WALLET_AND_LEVELS', 'Points Wallet and Levels')
            : isWalletRefunds
              ? t('CASH_WALLET_AND_REFUNDS', 'Cash Wallet and Refunds')
              : t('LOYALTY_AUTOMATION', 'Loyalty automation')}
          </h1>
          <InfoWrapper>
            <LearnDropDown
              learnOptions={learnOptions}
            />
            <InfoContent>
              {isPointsWallets
                ? t('POINT_WALLET_AND_LEVELS_DESCRIPTION', 'Points Wallet and Levels')
                : isWalletRefunds
                  ? t('CASH_WALLET_AND_REFUNDS_DESCRIPTION', 'Cash Wallet and Refunds')
                  : t('LOYALTY_AUTOMATION_DESCRIPTION', 'Configure the available loyalty plans to allow your users to receive rewards per order in your website and app. This can be done in general and customized per business.')
              }
            </InfoContent>
          </InfoWrapper>
        </HeaderTitleContainer>

        <LoyaltyListContainer>
          {walletList.map(item => (
            item.enabled && (
              <LoyaltyItemWrapper
                key={item.key}
                onClick={() => handleOptionClick(item.key)}
              >
                <IconWrapper>
                  {item.icon}
                </IconWrapper>

                <LoyaltyItemContent>
                  <h5>{item.name}</h5>
                  <p>{item.description}</p>
                </LoyaltyItemContent>
              </LoyaltyItemWrapper>
            )
          ))}
        </LoyaltyListContainer>
      </Container>

      {(showOption === 'credit_point' || showOption === 'cashback') && (
        <SideBar
          sidebarId='loyaltyWallet'
          open={(showOption === 'credit_point' || showOption === 'cashback')}
          onClose={hanldeClosePointsWallet}
          defaultSideBarWidth={550 + moveDistance}
          moveDistance={moveDistance}
        >
          <Wallet
            type={showOption}
            title={walletList.find(item => item.key === showOption)?.name}
            moveDistance={moveDistance}
            handleParentSidebarMove={val => setMoveDistance(val)}
          />
        </SideBar>
      )}

      {showOption === 'levels' && (
        <SideBar
          sidebarId='loyaltyLevels'
          open={showOption === 'levels'}
          onClose={() => handleCloseLevel()}
          defaultSideBarWidth={550 + levelMoveDistance}
          moveDistance={levelMoveDistance}
          showExpandIcon
        >
          <PointsWalletLevels
            handleParentSidebarMove={val => setLevelMoveDistance(val)}
          />
        </SideBar>
      )}
    </>
  )
}
