import React from 'react'
import { useLanguage, useConfig } from '../../../../../index'
import { DragScroll } from '../../Shared'
import { isDashboardFeatureEnabled } from '../../../utils'

import {
  UserDetailsMenuContainer,
  Tab
} from './styles'

export const UserDetailsMenu = (props) => {
  const {
    currentMenuSelected,
    handleChangeMenu,
    isBusinessOwner,
    isProfessional,
    isCallcenterAgent
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()

  const isEnabledSchoolModule = isDashboardFeatureEnabled({
    featureKey: 'schools',
    configs
  })

  const businessMenuList = [
    { key: 'profile', content: t('PROFILE', 'Profile'), enabled: true },
    { key: 'saved_places', content: t('SAVED_PLACES', 'Saved places'), enabled: true },
    { key: 'businesses', content: t('BUSINESSES', 'Businesses'), enabled: true },
    { key: 'orders', content: t('ORDERS', 'Orders'), enabled: true },
    { key: 'metafields', content: t('METAFIELDS', 'Metafields'), enabled: false },
    { key: 'personalization', content: t('PERSONALIZATION', 'Personalization'), enabled: false }
  ]

  const userMenuList = [
    { key: 'profile', content: t('PROFILE', 'Profile'), enabled: true },
    { key: 'saved_places', content: t('SAVED_PLACES', 'Saved places'), enabled: true },
    { key: 'orders', content: t('ORDERS', 'Orders'), enabled: true },
    { key: 'metafields', content: t('METAFIELDS', 'Metafields'), enabled: false },
    { key: 'businesses', content: t('BUSINESSES', 'Businesses'), enabled: isCallcenterAgent },
    { key: 'personalization', content: t('PERSONALIZATION', 'Personalization'), enabled: false },
    { key: 'push_tokens', content: t('PUSH_TOKENS', 'Push tokens'), enabled: true },
    { key: 'school_students', content: t('SCHOOL_STUDENTS', 'School students'), enabled: isEnabledSchoolModule }
  ]

  const professionalMenuList = [
    { key: 'profile', content: t('PROFILE', 'Profile'), enabled: true },
    { key: 'schedule', content: t('Schedule', 'Schedule'), enabled: true },
    { key: 'business_services', content: t('BUSINESS_AND_SERVICES', 'Business & Services'), enabled: true }
  ]

  const getMenuList = () => {
    if (isBusinessOwner) return businessMenuList
    if (isProfessional) return professionalMenuList
    return userMenuList
  }

  const menuItems = getMenuList()

  return (
    <UserDetailsMenuContainer>
      <DragScroll>
        {menuItems.map(menu => (
          menu.enabled && (
            <Tab
              key={menu.key}
              active={menu.key === currentMenuSelected}
              onClick={() => handleChangeMenu(menu.key)}
            >
              {menu.content}
            </Tab>
          ))
        )}
      </DragScroll>
    </UserDetailsMenuContainer>
  )
}
