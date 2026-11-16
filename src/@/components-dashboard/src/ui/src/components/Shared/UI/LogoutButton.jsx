import React from 'react'

import { LogoutAction, useLanguage } from '../../../../../index'
import { LogOut } from '../Icon'
import { LogoutActionButton } from './shell-navigation-styles'

export const LogoutButtonUI = (props) => {
  const [, t] = useLanguage()

  return (
    <LogoutActionButton onClick={props.handleLogoutClick}>
      <LogOut size={20} />
      <span>
        {t('LOG_OUT', 'Log out')}
      </span>
    </LogoutActionButton>
  )
}

export const LogoutButton = (props) => {
  const logoutButtonProps = {
    ...props,
    UIComponent: LogoutButtonUI
  }
  return (
    <LogoutAction {...logoutButtonProps} />
  )
}
