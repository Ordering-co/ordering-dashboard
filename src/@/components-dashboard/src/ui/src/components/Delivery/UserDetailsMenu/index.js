import React from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { DragScroll } from '../../Shared'

import {
  UserDetailsMenuContainer,
  Tab
} from './styles'

export const UserDetailsMenu = (props) => {
  const {
    currentMenuSelected,
    handleChangeMenu,
    isDriverMenu,
    isStripeConnectEnabled
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const menuItems = isDriverMenu
    ? [
        { key: 'profile', content: t('PROFILE', 'Profile'), enabled: true },
        { key: 'driver_group', content: t('DRIVER_GROUP', 'Driver group'), enabled: true },
        { key: 'saved_places', content: t('SAVED_PLACES', 'Saved places'), enabled: true },
        { key: 'schedule', content: t('SCHEDULE', 'Schedule'), enabled: true },
        { key: 'logs', content: t('LOGS', 'Logs'), enabled: true },
        { key: 'advanced_logs', content: t('ADVANCED_LOGS', 'Advanced logs'), enabled: user?.level === 0 },
        { key: 'push_tokens', content: t('PUSH_TOKENS', 'Push tokens'), enabled: true },
        { key: 'stripe_connect', content: t('SETTINGS_SECTION_STRIPE_CONNECT', 'Stripe Connect'), enabled: !!isStripeConnectEnabled },
        { key: 'metafields', content: t('METAFIELDS', 'Metafields'), enabled: false },
        { key: 'personalization', content: t('PERSONALIZATION', 'Personalization'), enabled: false }
      ]
    : [
        { key: 'profile', content: t('PROFILE', 'Profile'), enabled: true },
        { key: 'saved_places', content: t('SAVED_PLACES', 'Saved places'), enabled: true },
        { key: 'driver_group', content: t('DRIVER_GROUP', 'Driver group'), enabled: true },
        { key: 'metafields', content: t('METAFIELDS', 'Metafields'), enabled: false },
        { key: 'personalization', content: t('PERSONALIZATION', 'Personalization'), enabled: false }
      ]

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
          )
        ))}
      </DragScroll>
    </UserDetailsMenuContainer>
  )
}
