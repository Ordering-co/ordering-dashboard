import React, { useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'

import { LogoutAction } from '../../../../../index'
import {
  Banknote,
  ChartColumn,
  ChevronsUpDown,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  House,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  LogOut,
  Megaphone,
  Phone,
  Plug,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Truck,
  UserRound,
  Users,
  Workflow
} from '../Icon'
import { LanguageSelector } from '../UI/LanguageSelector'
import { Avatar } from '../Product/Avatar'
import { SegmentedControl } from '../Product/SegmentedControl'
import { useColorMode } from '../../../contexts/ColorModeContext'
import { cx } from '../Product/classNames'
import { tokenOffset } from '../Product/positioning'
import { useProductDir } from '../Product/useProductDir'
import '../Product/product.css'
import './sidebar.css'

const SIDE_OFFSET = tokenOffset('--od-space-1')

/** ExternalLink points up and to the inline end: it mirrors in RTL (C17). */
const ExternalLinkIcon = ({ className, ...props }) => (
  <ExternalLink {...props} className={cx(className, 'odc-icon-flip')} />
)

/** Lucide glyphs `getSidebarGroups` names by string (`icon: 'House'`). */
export const NAV_ICONS = {
  House,
  ListChecks,
  Truck,
  GraduationCap,
  Store,
  ShoppingBag,
  ExternalLink: ExternalLinkIcon,
  Megaphone,
  Users,
  ChartColumn,
  Workflow,
  Phone,
  Plug,
  LayoutGrid,
  Banknote,
  Star,
  Settings,
  FileText,
  UserRound,
  Download,
  Lightbulb,
  CircleHelp
}

export const NavIcon = ({ name }) => {
  const Icon = name ? NAV_ICONS[name] : null
  return Icon ? <Icon className='odc-icon' /> : null
}

/**
 * A rail control with its name drawn beside it on hover and keyboard focus (C3: `title`
 * never shows on focus). The tip is `aria-hidden`: the control already carries the name in
 * `aria-label`. Only the rail uses it.
 */
/**
 * A rail control with its visible label (C11). The label is fixed-positioned next to
 * the control, at the control's real centre (measured when the pointer or the focus
 * arrives, so a scrolled rail never shows it next to another icon), and Esc dismisses
 * it until the pointer or the focus leaves (WCAG 1.4.13).
 */
export const RailItem = ({ label, itemRef, bare = false, children }) => {
  const localRef = React.useRef(null)
  const [tip, setTip] = React.useState({ y: null, dismissed: false })
  const setRef = node => {
    localRef.current = node
    if (typeof itemRef === 'function') itemRef(node)
    else if (itemRef) itemRef.current = node
  }
  const place = () => {
    const box = localRef.current?.getBoundingClientRect()
    if (box) setTip({ y: box.top + box.height / 2, dismissed: false })
  }
  const reset = () => setTip(state => ({ ...state, dismissed: false }))
  // (review): a control that keeps its focus while the menu becomes the rail gets no pointer or focus event to place its
  // label, which then showed at the top of the rail, off the control. Entering the rail with the focus inside places it.
  React.useLayoutEffect(() => {
    if (!bare && localRef.current?.contains(document.activeElement)) place()
  }, [bare])
  // `bare` keeps the wrapper (so a control that is in the rail in one mode and not in the other is the same node in
  // both and does not lose its focus when the mode changes) but draws no label and listens to nothing: `display: contents`.
  return (
    <span
      ref={setRef}
      className={bare ? 'odc-rail-item odc-rail-item-bare' : 'odc-rail-item'}
      data-tip-dismissed={tip.dismissed && !bare ? '' : undefined}
      style={tip.y == null || bare ? undefined : { '--odc-tip-y': `${tip.y}px` }}
      onPointerEnter={bare ? undefined : place}
      onFocus={bare ? undefined : place}
      onPointerLeave={bare ? undefined : reset}
      onBlur={bare ? undefined : reset}
      onKeyDown={bare ? undefined : event => { if (event.key === 'Escape') setTip(state => ({ ...state, dismissed: true })) }}
    >
      {children}
      {!bare && <span className='odc-rail-tip' aria-hidden='true'>{label}</span>}
    </span>
  )
}

export const getFullName = (user = {}) => [user.name, user.lastname].filter(Boolean).join(' ')

/** Hidden "opens in a new tab", read as the description so the link's name stays its label. */
export const OpensInNewTab = ({ id, t }) => (
  <span id={id} className='odc-sr-only' aria-hidden='true'>
    {t('OPENS_IN_NEW_TAB', 'opens in a new tab')}
  </span>
)

const CONTROLS = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

const inRail = (compact, label, node) => (compact ? <RailItem label={label}>{node}</RailItem> : node)

const navigatePayload = item => (item.route ? { route: item.route } : item.state ? { page: item.page, state: item.state } : { page: item.page })

const LogoutItem = ({ handleLogoutClick, label }) => (
  <button type='button' className='odc-account-item' onClick={handleLogoutClick}>
    <LogOut className='odc-icon' />
    <span>{label}</span>
  </button>
)

const AccountItem = ({ item, t, onNavigate, onRequestUpgrade, close }) => {
  const describedBy = React.useId()
  if (item.kind === 'external') {
    return (
      <a
        className='odc-account-item'
        href={item.href}
        target='_blank'
        rel='noopener noreferrer'
        aria-describedby={describedBy}
        onClick={close}
      >
        <NavIcon name={item.icon} />
        <span className='odc-account-item-text'>{item.label}</span>
        <ExternalLink className='odc-icon odc-icon-flip odc-nav-ext' />
        <OpensInNewTab id={describedBy} t={t} />
      </a>
    )
  }
  return (
    <a
      className='odc-account-item'
      href={item.url}
      aria-current={item.current ? 'page' : undefined}
      onClick={event => {
        const navigate = () => onNavigate(event, navigatePayload(item))
        if (!onRequestUpgrade?.(item.url, event, undefined, navigate)) navigate()
        close()
      }}
    >
      <NavIcon name={item.icon} />
      <span className='odc-account-item-text'>{item.label}</span>
    </a>
  )
}

/**
 * Account row (C11): one row with the person and the project that opens a popover with
 * profile, language, downloads, ideas, help and logout. A popover, not a menu: it holds a
 * language selector, so it is a dialog of links and buttons in tab order.
 *
 * `compact` (the rail) shows only the avatar, still named by the same label. Every text
 * arrives translated; `ACCOUNT_MENU` is `Account: _name_`.
 */
export const AccountMenu = ({
  t,
  user = {},
  project,
  items = [],
  showLanguage = false,
  cannyLink,
  compact = false,
  onNavigate,
  onRequestUpgrade,
  onOpenChange,
  dir
}) => {
  const direction = useProductDir(dir)
  const [open, setOpen] = useState(false)
  const fullName = getFullName(user)
  const label = t('ACCOUNT_MENU', 'Account: _name_').replace('_name_', fullName || user.email || '').trim()
  const subtitle = [project, user.email].filter(Boolean).join(' · ')
  const cannyId = React.useId()
  const popupRef = useRef(null)
  // First focus goes to the first control that is ready (the language select mounts a moment later), not to the heading.
  const firstControl = () => [...(popupRef.current?.querySelectorAll(CONTROLS) ?? [])].find(element => !element.disabled) ?? true

  const handleOpenChange = next => {
    setOpen(next)
    onOpenChange?.(next)
  }
  const close = () => handleOpenChange(false)
  const colorMode = useColorMode()

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      {inRail(compact, label, (
        <Popover.Trigger
          className='odc-account-trigger'
          aria-label={label}
        >
          <Avatar name={fullName} src={user.photo} />
          {!compact && (
            <>
              <span className='odc-account-text'>
                <span className='odc-account-name'>{fullName}</span>
                {subtitle && (
                  // two pieces, so the ellipsis can only cut the email: the project code never shrinks. The text is the
                  // same «project · email». The email is its own LTR run, so in RTL it is cut at its end, not at its start.
                  <span className='odc-account-sub'>
                    {project && <bdi className='odc-account-project'>{project}</bdi>}
                    {project && user.email && <span>{' · '}</span>}
                    {user.email && <bdi className='odc-account-mail' dir='ltr'>{user.email}</bdi>}
                  </span>
                )}
              </span>
              <ChevronsUpDown className='odc-icon odc-account-chevron' />
            </>
          )}
        </Popover.Trigger>
      ))}
      <Popover.Portal dir={direction}>
        <Popover.Positioner side='top' align='start' sideOffset={SIDE_OFFSET} className='odc-account-positioner'>
          <Popover.Popup
            ref={popupRef}
            className='odc-root odc-account-popup'
            data-slot='sidebar-account-popup'
            dir={direction}
            initialFocus={firstControl}
          >
            <div className='odc-account-head'>
              <Popover.Title className='odc-account-title'>{fullName || user.email}</Popover.Title>
              {fullName && user.email && <span className='odc-account-email'><bdi>{user.email}</bdi></span>}
            </div>
            {showLanguage && (
              <div className='odc-account-section'>
                {/* LanguageSelector takes no label: the group names it for assistive tech. redesign fix-qa E8: `variant='menu'` is the
                    Product single-choice menu (below its trigger, inside the viewport) instead of the legacy select that covered this popup's header. */}
                <div className='odc-account-language' role='group' aria-label={t('LANGUAGE', 'Language')}>
                  <LanguageSelector variant='menu' />
                </div>
              </div>
            )}
            {colorMode.enabled && (
              // (decision 28): only with `dashboard_dark_mode` on. The control names its group for assistive tech.
              <div className='odc-account-section'>
                <SegmentedControl
                  label={t('APPEARANCE', 'Appearance')}
                  value={colorMode.preference}
                  onValueChange={colorMode.setPreference}
                  options={[
                    { value: 'system', label: t('COLOR_MODE_SYSTEM', 'System') },
                    { value: 'light', label: t('COLOR_MODE_LIGHT', 'Light') },
                    { value: 'dark', label: t('COLOR_MODE_DARK', 'Dark') }
                  ]}
                />
              </div>
            )}
            <div className='odc-account-section'>
              {items.map(item => (
                <AccountItem key={item.key} item={item} t={t} onNavigate={onNavigate} onRequestUpgrade={onRequestUpgrade} close={close} />
              ))}
              {cannyLink && (
                <a
                  className='odc-account-item'
                  href={cannyLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  data-canny-link
                  aria-describedby={cannyId}
                  onClick={close}
                >
                  <span className='odc-account-item-text'>{t('REQUEST_FEATURES', 'Request features')}</span>
                  <ExternalLink className='odc-icon odc-icon-flip odc-nav-ext' />
                  <OpensInNewTab id={cannyId} t={t} />
                </a>
              )}
            </div>
            <div className='odc-account-section'>
              <LogoutAction UIComponent={LogoutItem} label={t('LOG_OUT', 'Log out')} />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
