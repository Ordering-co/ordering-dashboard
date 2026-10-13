import React, { useEffect, useState, useMemo } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage, SitesAuthSettings as SitesAuthSettingsController } from '../../../../../index'
import { Alert } from '../../Shared'
import { Select } from '../../../styles/Select'
import { SiteSettingDetails } from '../SiteSettingDetails'
import { useWindowSize } from '../../../hooks/useWindowSize'

import {
  SitesListContainer,
  SitesWrapper,
  SiteItem,
  Header,
  SelectContent,
  Option
} from './styles'
import { IconButton } from '../../../styles'
import { ArrowsAngleContract, ArrowsAngleExpand } from 'react-bootstrap-icons'

const SitesAuthSettingsUI = (props) => {
  const {
    sitesState,
    actionState,
    siteConfigsState,
    siteGroupConfigsState,
    handleGetSiteConfigs,
    handleChangeConfig,
    avoidExpand
  } = props

  const history = useHistory()
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()

  const [selectedSiteId, setSelectedSiteId] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isExpand, setIsExpand] = useState(false)

  const siteOptions = useMemo(() => {
    const siteOptionValues = sitesState?.sites?.map((option) => {
      const _option = {
        value: option.id,
        content: <Option>{option.name}</Option>
      }
      return _option
    })
    return siteOptionValues
  }, [sitesState?.sites])

  const handleOpenSiteSettingDetails = (siteId, isInitialRender) => {
    handleGetSiteConfigs(siteId)
    setSelectedSiteId(siteId)
    if (!isInitialRender) {
      const category = query.get('category')
      history.replace(`${location.pathname}?category=${category}&site=${siteId}`)
    }
  }

  const expandSideBar = () => {
    const element = document.getElementById('sideSlider')
    if (isExpand) element.style.width = '500px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  useEffect(() => {
    if (actionState.error) {
      setAlertState({
        open: true,
        content: actionState.error
      })
    }
  }, [actionState.error])

  useEffect(() => {
    if (sitesState.loading) return
    const site = query.get('site')
    if (site) {
      handleOpenSiteSettingDetails(Number(site), true)
    }
  }, [sitesState.loading])

  return (
    <>
      <SitesListContainer>
        <Header>
          <h1>{t('SITES_LOGIN_SIGNUP_SETTINGS', 'Sites Login/Signup Settings')}</h1>
          {width > 576 && !selectedSiteId && !avoidExpand && (
            <IconButton
              color='black'
              onClick={expandSideBar}
            >
              {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
            </IconButton>
          )}
        </Header>
        {sitesState.loading
          ? (
              <SitesWrapper>
                {[...Array(5).keys()].map(i => (
                  <SiteItem key={i}>
                    <Skeleton width={100} height={14} />
                  </SiteItem>
                ))}
              </SitesWrapper>
            )
          : (
              <SitesWrapper>
                <SelectContent>
                  <Select
                    defaultValue={selectedSiteId}
                    options={siteOptions}
                    onChange={(typeValue) => handleOpenSiteSettingDetails(typeValue)}
                    placeholder={t('SELECT_SITE', 'Select a site')}
                    optionInnerMaxHeight='min(320px, calc(100vh - 220px))'
                  />
                </SelectContent>
                {selectedSiteId && siteOptions?.find((option) => (option.value === selectedSiteId)) && (
                  <SiteSettingDetails
                    selectedSiteId={selectedSiteId}
                    siteConfigsState={siteConfigsState}
                    siteGroupConfigsState={siteGroupConfigsState}
                    handleChangeConfig={handleChangeConfig}
                  />
                )}
              </SitesWrapper>
            )
        }
      </SitesListContainer>
      <Alert
        title={t('SETTINGS', 'Settings')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const SitesAuthSettings = (props) => {
  const sitesAuthSettinsProps = {
    ...props,
    UIComponent: SitesAuthSettingsUI
  }
  return <SitesAuthSettingsController {...sitesAuthSettinsProps} />
}
