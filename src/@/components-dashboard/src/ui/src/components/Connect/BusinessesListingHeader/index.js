import React, { useState } from 'react'
import { List as MenuIcon, ArrowRepeat, InfoCircle } from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { SearchBar } from '../../Shared'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { InfoHelpBox } from '../InfoHelpBox'

import { Button, IconButton } from '../../../styles'
import {
  HeaderContainer,
  HeaderTitleContainer,
  ActionsWrapper,
  InfoWrapper
} from './styles'

export const BusinessesListingHeader = (props) => {
  const {
    title,
    searchValue,
    onSearch,
    handleRefreshBusinesses,
    loading,
    noBusinesses
  } = props
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [showModalInfo, setShowModalInfo] = useState({ open: false, content: null })

  const infoHelpBoxData = {
    name: title || t('POS_MENU_SYNC', 'POS & Menu Sync'),
    description: t('INTEGRATION_DESCRIPTION', 'Connect with any of our available integrations with a few steps. Open the store where you want to connect your POS to our system. Configure the integration settings with your own keys and sync your products and stores to your POS or to our dashboard. For more info, please contact our Support team'),
    more_info: 'https://help.orderingplus.com/en/articles/10056965-create-support-ticket'
  }

  return (
    <HeaderContainer>
      <HeaderTitleContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{title || t('POS_MENU_SYNC', 'POS & Menu Sync')}</h1>
        <InfoWrapper>
          <IconButton
            color='primary'
            onClick={() => setShowModalInfo({
              open: true,
              content: infoHelpBoxData
            })}
          >
            <InfoCircle />
          </IconButton>
        </InfoWrapper>
      </HeaderTitleContainer>
        <ActionsWrapper>
          {!noBusinesses && (
            <Button
              color='lightPrimary'
              borderRadius='8px'
              onClick={() => handleRefreshBusinesses()}
              className={loading ? 'loading' : ''}
            >
              {t('REFRESH', 'Refresh')}
              <ArrowRepeat size={16} style={{ marginLeft: 5 }} />
            </Button>
          )}
          <SearchBar
            isCustomLayout
            lazyLoad
            onSearch={onSearch}
            search={searchValue}
            placeholder={t('SEARCH', 'Search')}
            customClass='searchBar'
          />
        </ActionsWrapper>
      {showModalInfo.open && (
        <InfoHelpBox
          open={showModalInfo.open}
          data={showModalInfo.content}
          handleOnClose={() => setShowModalInfo({ open: false, content: null })}
        />
      )}
    </HeaderContainer>
  )
}
