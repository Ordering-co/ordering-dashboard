import React, { useState } from 'react'
import { List as MenuIcon } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'

import { Button } from '~ui'

import { InfoHelpBox } from '../InfoHelpBox'
import { getOptions } from './utils'

import { IconButton } from '../../../styles'

import {
  ConnectOverviewContainer,
  HeaderTitleContainer,
  OptionsContainer
} from './styles'

export const ConnectOverview = () => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const [showModalInfo, setShowModalInfo] = useState({ open: false, content: null })

  const options = getOptions()

  return (
    <ConnectOverviewContainer>
      <HeaderTitleContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('CONNECT_OVERVIEW', 'Overview')}</h1>
      </HeaderTitleContainer>

      <OptionsContainer>
        {options.map(option => (
          option.enabled && (
            <div className='option' key={option.name}>
              <div className='option-wrapper'>
                <h2>{option.name}</h2>
                <p>{option.description}</p>
                <Button
                  color='lightPrimary'
                  onClick={() => setShowModalInfo({ open: true, content: option })}
                >
                  {t('VIEW_VIDEO', 'View video')}
                </Button>
              </div>
            </div>
          )
        ))}
      </OptionsContainer>

      {showModalInfo.open && (
        <InfoHelpBox
          open={showModalInfo.open}
          data={showModalInfo.content}
          handleOnClose={() => setShowModalInfo({ open: false, content: null })}
        />
      )}
    </ConnectOverviewContainer>
  )
}
