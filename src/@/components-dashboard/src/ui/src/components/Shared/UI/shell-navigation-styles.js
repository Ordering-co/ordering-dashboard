import styled from 'styled-components'

import { Button, IconButton } from './Button'
import { resolveButtonTheme } from '../../../styles/Buttons/theme'
import { entitySelectorStyle } from './entity-selector-theme'
import './shell-navigation.css'
import { ASSISTANT_STAGE_COLOR } from '../../../../../contexts/AssistantContext/name'

const themed = props => ({
  ...entitySelectorStyle(props.theme),
  '--od-shell-action-foreground': resolveButtonTheme(props.theme).actionForeground
})

export const SidebarContainer = styled.nav.attrs(props => ({
  className: 'od-ui od-shell-sidebar',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'sidebar-navigation',
  'data-collapsed': props.isCollapse ? '' : undefined,
  inert: props.isCollapse ? '' : undefined,
  'aria-hidden': props.isCollapse ? true : undefined
}))`${themed}`

export const SidebarInnerContainer = styled.div.attrs({ className: 'od-shell-sidebar-inner' })`${themed}`
export const SidebarHeader = styled.div.attrs({ className: 'od-shell-sidebar-header' })`${themed}`
export const LogoWrapper = styled.div.attrs({ className: 'od-shell-logo-wrapper' })`${themed}`

export const BurgerButton = styled(IconButton).attrs({
  className: 'od-shell-collapse-action',
  'data-slot': 'sidebar-collapse-action',
  type: 'button'
})`${themed}`

export const SidebarMainContent = styled.div.attrs({ className: 'od-shell-main' })`${themed}`
export const SidebarContent = styled.div.attrs({ className: 'od-shell-content' })`${themed}`
export const UserInfo = styled.div.attrs({ className: 'od-shell-user-info' })`${themed}`

export const MenuContainer = styled.div.attrs(props => ({
  className: 'od-ui od-shell-menu-item',
  'data-slot': 'shell-menu-item',
  'data-disabled-feature': props.disabledFeature ? '' : undefined
}))`${themed}`

export const MenuContent = styled.div.attrs({ className: 'od-shell-menu-content' })`${themed}`

export const SubMenu = styled.a.attrs(props => ({
  className: 'od-ui od-shell-submenu-link',
  'data-slot': 'shell-submenu-link',
  'data-active': props.active ? '' : undefined,
  'aria-current': props.active ? 'page' : undefined,
  'data-disabled-feature': props.disabledFeature ? '' : undefined
}))`${themed}`

export const LanguageSelectorContainer = styled.div.attrs({ className: 'od-shell-language' })`${themed}`

export const AiBadge = styled.small.attrs(props => ({
  className: 'od-shell-ai-badge',
  'data-active': props.$active ? '' : undefined
}))`${themed}`

export const StageBadge = styled(AiBadge).attrs({ className: 'od-shell-ai-badge od-shell-stage-badge' })`
  --od-shell-stage-color: ${ASSISTANT_STAGE_COLOR};
`

export const LayoutContainer = styled.div.attrs({
  className: 'od-ui od-shell-layout d-flex',
  'data-slot': 'shell-layout'
})`
  /* --app-width leaves room for the docked assistant (utils/assistantDock).
     Without it the layout is as wide as the page, not 100vw: 100vw counts the window's vertical scrollbar where scrollbars take
     room, so a page that scrolls got a horizontal scrollbar too, and the sticky sidebar slid with both. */
  max-width: var(--app-width, 100%);
  width: var(--app-width, 100%);
`

export const LogoutActionButton = styled(Button).attrs({
  className: 'od-shell-logout d-flex align-items-center m-1',
  'data-slot': 'logout-action',
  type: 'button'
})`${themed}`

export const LogoActionButton = styled(IconButton).attrs({
  className: 'od-shell-logo-action',
  type: 'button'
})`${themed}`
