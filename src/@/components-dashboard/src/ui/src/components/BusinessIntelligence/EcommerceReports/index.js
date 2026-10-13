import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { useWindowSize } from '../../../hooks/useWindowSize'
import {
  List as MenuIcon,
  Rulers,
  Map,
  MapFill,
  ClockHistory
} from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { SideBar } from '../../Shared'
import { SettingItemUI } from '../SettingItemUI'
import { ReportsBusinessDistance } from '../ReportsBusinessDistance'
import { ReportsOrderDistance } from '../ReportsOrderDistance'
import { ReportsBusinessSpend } from '../ReportsBusinessSpend'
import { RealTime } from '../RealTime'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

import {
  ReportsContainer,
  HeaderTitleContainer,
  ReportsList
} from './styles'

export const EcommerceReports = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState(0)
  const { width } = useWindowSize()
  const sidebarWidth = 240

  const advancedReportsList = [
    { id: 1, name: t('USERS', 'Users'), description: t('USERS_DESC', 'Users description'), icon: <Rulers /> },
    { id: 2, name: t('DISCOUNT_DASHBOARD', 'Discount dashboard'), description: t('DISCOUNT_DASHBOARD_DESC', 'Discount dashboard description'), icon: <Map /> },
    { id: 3, name: t('DASHBOARD_WITH_STORE_MAP', 'Dashboard with store map'), description: t('DASHBOARD_WITH_STORE_MAP_DESC', 'Dashboard with store map description'), icon: <MapFill /> },
    { id: 4, name: t('REAL_TIME', 'Real time'), description: t('REAL_TIME_DESC', 'Real time description'), icon: <ClockHistory /> }
  ]

  const handleCloseSidebar = () => {
    setIsOpen(false)
    setSelectedReport(0)
    removeQueryToUrl(['id'])
  }

  const handleOpenSlider = (index, isInitialRender) => {
    setSelectedReport(index)
    setIsOpen(true)
    if (!isInitialRender) {
      addQueryToUrl({ id: index })
    }
  }

  useEffect(() => {
    const id = query.get('id')
    if (id) {
      handleOpenSlider(Number(id), true)
    }
  }, [])

  return (
    <ReportsContainer>
      <HeaderTitleContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('ENTERPRISE_REPORTS', 'Enterprise reports')}</h1>
      </HeaderTitleContainer>
      <ReportsList className='row'>
        {advancedReportsList && advancedReportsList.map((report, i) => (
          <div
            key={i}
            className='col-md-6 col-lg-4'
            onClick={() => handleOpenSlider(report.id)}
          >
            <SettingItemUI
              title={report.name}
              // description={t('DISTANCE_DESC')}
              description={report.description}
              icon={report.icon}
              active={selectedReport === report.id}
            />
          </div>
        ))}
      </ReportsList>
      {isOpen && (
        <SideBar
          sidebarId='brand-details'
          defaultSideBarWidth={width - sidebarWidth}
          open={isOpen}
          onClose={() => handleCloseSidebar()}
        >
          {selectedReport === 1 && <ReportsBusinessDistance />} {/** change */}
          {selectedReport === 2 && <ReportsOrderDistance />} {/** change */}
          {selectedReport === 3 && <ReportsBusinessSpend />} {/** change */}
          {selectedReport === 4 && <RealTime />}
        </SideBar>
      )}
    </ReportsContainer>
  )
}
