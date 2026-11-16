import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { ArrowUp, ChevronDown, ExternalLink, MessageSquare, PanelLeftClose, Search } from '../Icon'
import { Button, IconButton } from '../Product/Button'
import { Menu } from '../Product/Menu'
import { cx } from '../Product/classNames'
import { useProductDir } from '../Product/useProductDir'
import { ProgressRing } from '../ProgressRing'
import { useCommandPalette } from '../../../contexts/CommandPaletteContext'
import { ASSISTANT_NAME, ASSISTANT_STAGE } from '../../../../../contexts/AssistantContext/name'
import { getCurrentSectionKey } from '../../../../../utils/sidebarGroups'
import { AccountMenu, NAV_ICONS, NavIcon, OpensInNewTab, RailItem } from './AccountMenu'
import '../Product/product.css'
import './sidebar.css'

const payloadOf = item => (item.route ? { route: item.route } : item.state ? { page: item.page, search: item.search, state: item.state } : { page: item.page })

/**
 * One row. In the rail it is icon-only and keeps its name in `aria-label`; the label that
 * shows on hover and focus is `RailItem`'s (it replaces `title`, which never shows on focus).
 * `external` and `action` rows that leave the dashboard say so as a description, so the
 * accessible name stays the label.
 */
const rowProps = (label, rail) => (rail ? { 'aria-label': label } : {})
const inRail = (rail, label, node) => (rail ? <RailItem label={label}>{node}</RailItem> : node)

const NavLink = ({ item, rail, onNavigate, onTopLevel, onRequestUpgrade }) => {
  return inRail(rail, item.label, (
    <a
      className='odc-nav-item'
      href={item.url}
      aria-current={item.current ? 'page' : undefined}
      {...rowProps(item.label, rail)}
      onClick={event => {
        const navigate = () => {
          onTopLevel?.()
          onNavigate(event, payloadOf(item))
        }
        if (!onRequestUpgrade?.(item.url, event, undefined, navigate)) navigate()
      }}
    >
      <NavIcon name={item.icon} />
      {!rail && <span className='odc-nav-text'>{item.label}</span>}
      {/* main: a short tag after the label («New» on Builder), drawn like the assistant's stage tag. */}
      {!rail && item.badge && <span className='odc-nav-stage odc-nav-badge'>{item.badge}</span>}
    </a>
  ))
}

const NavExternal = ({ item, t, rail }) => {
  const describedBy = useId()
  return inRail(rail, item.label, (
    <a
      className='odc-nav-item'
      href={item.href}
      target='_blank'
      rel='noopener noreferrer'
      aria-describedby={describedBy}
      {...rowProps(item.label, rail)}
    >
      <NavIcon name={item.icon} />
      {!rail && <span className='odc-nav-text'>{item.label}</span>}
      {!rail && <ExternalLink className='odc-icon odc-icon-flip odc-nav-ext' />}
      <OpensInNewTab id={describedBy} t={t} />
    </a>
  ))
}

const NavAction = ({ item, t, rail, handlers }) => {
  const describedBy = useId()
  return inRail(rail, item.label, (
    <button
      type='button'
      className='odc-nav-item'
      data-action={item.action}
      aria-describedby={item.external ? describedBy : undefined}
      onClick={() => handlers[item.action]?.()}
      {...rowProps(item.label, rail)}
    >
      <NavIcon name={item.icon} />
      {!rail && <span className='odc-nav-text'>{item.label}</span>}
      {!rail && item.external && <ExternalLink className='odc-icon odc-icon-flip odc-nav-ext' />}
      {item.external && <OpensInNewTab id={describedBy} t={t} />}
    </button>
  ))
}

const NavSection = ({ item, open, onToggle, t, onNavigate, onRequestUpgrade }) => {
  const panelId = useId()
  const expanded = open && !item.disabled
  // (T10, decision X-3): the current page belongs to this section but has no visible entry in it (an entry the project's
  // configs hide, reached by its address): the header carries the one active state, so the menu still says where you are
  const currentHere = item.containsCurrent && !item.items.some(child => child.current)
  return (
    <div>
      <button
        type='button'
        className='odc-nav-item'
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-current={currentHere ? 'page' : undefined}
        disabled={item.disabled}
        data-contains-current={item.containsCurrent ? '' : undefined}
        onClick={onToggle}
      >
        <NavIcon name={item.icon} />
        <span className='odc-nav-text'>{item.label}</span>
        <ChevronDown className='odc-icon odc-nav-chevron' />
      </button>
      <div id={panelId} className='odc-nav-sub' hidden={!expanded} inert={expanded ? undefined : ''}>
        {item.items.map(child => child.kind === 'external'
          ? <NavExternal key={child.key} item={child} t={t} />
          : <NavLink key={child.key} item={child} onNavigate={onNavigate} onRequestUpgrade={onRequestUpgrade} />)}
      </div>
    </div>
  )
}

/** The visual mark of the current page inside a rail menu; the item itself has aria-current. */
const CurrentMark = ({ className }) => (
  <span className={cx(className, 'odc-menu-current')} data-current='' aria-hidden='true' />
)

/**
 * Rail: a section is a menu of its children; nothing is hidden by collapsing.
 *
 * The Product `Menu` owns its trigger and takes no props for it, so the trigger of the section
 * that holds the current page gets its state here, from the wrapper: `data-contains-current`,
 * `aria-describedby` to a hidden "Current page: _page_", and no `title` (the visible tip
 * replaces it). Inside the menu the current child carries `CurrentMark`.
 */
const RailSection = ({ item, t, onNavigate, onRequestUpgrade }) => {
  const Icon = item.icon ? NAV_ICONS[item.icon] : ChevronDown
  const wrapRef = useRef(null)
  const describedBy = useId()
  const currentLabel = item.containsCurrent ? item.items.find(child => child.current)?.label : undefined
  const className = cx('odc-nav-rail-btn', item.containsCurrent && 'odc-nav-rail-current')
  // (T10, review): as in NavSection, a section that holds the current page with no visible entry for it carries the one
  // active state on its own button
  const currentHere = item.containsCurrent && !currentLabel
  const triggerProps = {
    title: undefined,
    'aria-describedby': currentLabel ? describedBy : undefined,
    'aria-current': currentHere ? 'page' : undefined,
    'data-contains-current': item.containsCurrent ? '' : undefined
  }
  const description = currentLabel && (
    <span id={describedBy} className='odc-sr-only' aria-hidden='true'>
      {t('SIDEBAR_CURRENT_PAGE', 'Current page: _page_').replace('_page_', currentLabel)}
    </span>
  )
  if (item.disabled || !item.items.length) {
    return (
      <RailItem label={item.label} itemRef={wrapRef}>
        <IconButton icon={Icon} label={item.label} className={className} title={undefined} disabled />
      </RailItem>
    )
  }
  const items = item.items.map(child => ({
    key: child.key,
    label: child.label,
    icon: child.current ? CurrentMark : undefined,
    current: child.current,
    onSelect: child.kind === 'external'
      ? () => window.open(child.href, '_blank', 'noopener,noreferrer')
      : () => {
          const returnFocus = () => wrapRef.current?.querySelector('button')
          const navigate = () => onNavigate(null, payloadOf(child))
          if (!onRequestUpgrade?.(child.url, null, returnFocus, navigate)) navigate()
        }
  }))
  return (
    <RailItem label={item.label} itemRef={wrapRef}>
      {/* redesign fix-qa E8: the popover names its section (the rail only shows the icon), drawn by `data-title`. */}
      <Menu label={item.label} icon={Icon} items={items} side='inline-end' align='start' className={className} triggerProps={triggerProps} data-title={item.label} />
      {description}
    </RailItem>
  )
}

const SearchButton = ({ t, rail }) => {
  const { isAvailable, open, shortcut } = useCommandPalette()
  if (!isAvailable) return null
  const label = t('COMMAND_PALETTE_TRIGGER', 'Search')
  return inRail(rail, label, (
    <button
      type='button'
      className='odc-nav-search'
      onClick={open}
      aria-haspopup='dialog'
      aria-keyshortcuts={shortcut.ariaKeyShortcuts}
      data-testid='command-palette-trigger'
      {...rowProps(label, rail)}
    >
      <Search className='odc-icon' />
      {!rail && <span className='odc-nav-text'>{label}</span>}
      {!rail && (
        <span aria-hidden='true'>
          {shortcut.keys.map(key => <kbd key={key} className='odc-kbd'>{key}</kbd>)}
        </span>
      )}
    </button>
  ))
}

const AssistantRow = ({ assistant, rail }) => {
  const hint = `${ASSISTANT_NAME} (⌘J / Ctrl+J)`
  return inRail(rail, hint, (
    <button
      type='button'
      className='odc-nav-item'
      aria-pressed={!!assistant.isOpen}
      aria-keyshortcuts='Meta+J Control+J'
      data-active={assistant.isActive ? '' : undefined}
      onClick={assistant.toggle}
      {...rowProps(ASSISTANT_NAME, rail)}
      title={rail ? undefined : hint}
    >
      <MessageSquare className='odc-icon' />
      {!rail && <span className='odc-nav-text'>{ASSISTANT_NAME}</span>}
      {!rail && <span className='odc-nav-stage' aria-hidden='true'>{ASSISTANT_STAGE}</span>}
    </button>
  ))
}

/**
 * (sidebar follow-up): the legacy-upgrade offer card, fixed above the account row.
 * `upgradeOffer` is pre-built by SidebarMenu (`buildUpgradeCardProps` + `onOpen`); `null` while
 * there is no offer, so this renders nothing and takes no space.
 */
const UpgradeCard = ({ upgradeOffer }) => {
  if (!upgradeOffer) return null
  return (
    <div className='odc-upgrade-card'>
      <div className='odc-upgrade-card-row'>
        <ProgressRing
          percent={upgradeOffer.fraction * 100}
          size={32}
          lineWidth={3}
          progressColor='var(--od-action)'
          trackColor='var(--od-border)'
          caps='round'
        />
        <div className='odc-upgrade-card-text'>
          <p className='odc-upgrade-card-title'>{upgradeOffer.title}</p>
          <p className='odc-upgrade-card-subtitle'>{upgradeOffer.subtitle}</p>
        </div>
      </div>
      <Button variant='primary' size='lg' className='odc-upgrade-card-cta' onClick={upgradeOffer.onOpen}>
        {upgradeOffer.ctaLabel}
      </Button>
    </div>
  )
}

/** Rail equivalent of UpgradeCard: one icon button, same place in the foot, named by `railLabel`. */
const UpgradeRailButton = ({ upgradeOffer }) => {
  if (!upgradeOffer) return null
  return (
    <RailItem label={upgradeOffer.railLabel}>
      <IconButton
        icon={ArrowUp}
        label={upgradeOffer.railLabel}
        size='lg'
        className='odc-upgrade-rail-btn'
        onClick={upgradeOffer.onOpen}
      />
    </RailItem>
  )
}

// redesign fix-qa E8: Chromium takes the element that was scrolled into view as the starting point of the next Tab, so on
// arrival the first Tab landed after the current menu item, past the Skip to content link and the top of the menu (measured:
// «Delivery» was the first stop on /orders). With nothing focused, the starting point goes back to the start of the document.
// Focus that is somewhere on purpose is left alone.
const resetTabStart = () => {
  const { body } = document
  if (document.activeElement && document.activeElement !== body) return
  const had = body.hasAttribute('tabindex')
  if (!had) body.setAttribute('tabindex', '-1')
  body.focus({ preventScroll: true })
  if (!had) body.removeAttribute('tabindex')
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]'
const tabbables = root => [...root.querySelectorAll(FOCUSABLE)].filter(
  element => !element.disabled && element.tabIndex >= 0 && !element.closest('[inert], [hidden]')
)

/** Key of the entry that is `aria-current`, whether first-level or inside a section. */
const getCurrentEntryKey = groups => {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.current) return item.key
      const child = item.kind === 'section' ? item.items.find(entry => entry.current) : null
      if (child) return child.key
    }
  }
  return null
}

const EDITABLE = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
const ESCAPE_LAYER = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]'

// True when Escape belongs to something in the page rather than to the sidebar: the target is outside it and is a field being
// edited, or sits inside a dialog, menu, listbox or popover. <body>, the sidebar and its toggle do not count.
const ownsEscapeElsewhere = (target, panel) => {
  if (!(target instanceof Element) || target === document.body || panel?.contains(target)) return false
  return Boolean(target.closest(EDITABLE) || target.closest(ESCAPE_LAYER))
}

/**
 * Product sidebar (C11): grouped navigation, an icon rail, a mobile drawer and a one-row
 * account menu. Presentation only: it receives the groups (`getSidebarGroups`), the current
 * state and the handlers, and calls them. It knows no route, role or API.
 *
 * `mode`: `expanded` (248px), `rail` (56px, from 1024px), `drawer` (below 768px, over a
 * scrim; Escape and the scrim close it) or `collapsed` (hidden: inert and aria-hidden).
 * One entry is `aria-current="page"`; the parent of that entry never is.
 *
 * Props beyond the 5.1 contract: `toggleFlip` (mirror the header glyph in RTL), `dir` and `focusToggleOnOpen` (focus the
 * header toggle when the menu opens from `collapsed` without being a drawer; the drawer always does) and `closeOnEscape`
 * (row 17: Escape also closes the `expanded` menu, which below 1024px covers the page like a drawer).
 */
export const SidebarNav = ({
  t,
  groups = [],
  account = [],
  showLanguage = false,
  mode = 'expanded',
  logoSrc,
  onHome,
  onToggle,
  toggleLabel,
  toggleIcon = PanelLeftClose,
  toggleFlip = false,
  onNavigate,
  onRequestUpgrade,
  onBilling,
  onUpgrade,
  onAiAgents,
  assistant = { isAvailable: false },
  user = {},
  project,
  cannyLink,
  upgradeOffer,
  onCloseDrawer,
  focusToggleOnOpen = false,
  closeOnEscape = false,
  navRef,
  dir
}) => {
  const direction = useProductDir(dir)
  const rail = mode === 'rail'
  const drawer = mode === 'drawer'
  const collapsed = mode === 'collapsed'
  const handlers = { billing: onBilling, upgrade: onUpgrade, aiAgents: onAiAgents }

  // One panel open at a time among the dependent sections; independent ones (Logs Audit) keep their own.
  const currentSectionKey = getCurrentSectionKey(groups)
  const [openKey, setOpenKey] = useState(currentSectionKey)
  const [independentOpen, setIndependentOpen] = useState({})
  useEffect(() => {
    if (currentSectionKey) setOpenKey(currentSectionKey)
  }, [currentSectionKey])
  const isOpen = item => (item.independent ? !!independentOpen[item.key] : openKey === item.key)
  const toggleSection = item => {
    if (item.independent) setIndependentOpen(state => ({ ...state, [item.key]: !state[item.key] }))
    else setOpenKey(key => (key === item.key ? null : item.key))
  }

  // Escape closes the drawer (and, with closeOnEscape, the expanded menu), unless it is closing the account popover.
  const accountOpenRef = useRef(false)
  const panelRef = useRef(null)
  const closesOnEscape = drawer || (closeOnEscape && mode === 'expanded')
  useEffect(() => {
    if (!closesOnEscape) return undefined
    const onKeyDown = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || accountOpenRef.current) return
      // The expanded menu that is not a drawer does not own Escape while the user works in the page: a field being edited, or a
      // dialog, menu, listbox or popover, takes it first. Focus on the sidebar itself, its toggle or <body> still closes it.
      if (!drawer && ownsEscapeElsewhere(event.target, panelRef.current)) return
      onCloseDrawer?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closesOnEscape, drawer, onCloseDrawer])

  // The drawer is modal: the rest of the page is inert, the body does not scroll and Tab cycles
  // inside the panel. Everything is undone on close. (The account popover is a portal outside the
  // panel and handles its own focus.)
  useEffect(() => {
    const panel = panelRef.current
    const root = panel?.parentElement
    if (!drawer || !root) return undefined
    const made = []
    for (let node = root; node.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.hasAttribute('inert') || ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue
        sibling.setAttribute('inert', '')
        made.push(sibling)
      }
      if (node.parentElement === document.body) break
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = event => {
      if (event.key !== 'Tab' || event.defaultPrevented) return
      if (event.target.closest?.('[data-slot="sidebar-account-popup"]')) return
      const items = tabbables(panel)
      const first = items[0]
      const last = items[items.length - 1]
      const outside = !panel.contains(event.target)
      if (!first || outside || (event.shiftKey && event.target === first) || (!event.shiftKey && event.target === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      made.forEach(sibling => sibling.removeAttribute('inert'))
    }
  }, [drawer])

  // Opening the drawer moves the focus into it (its close button); closing gives it back
  // through SidebarMenu's external-opener effect.
  const toggleRef = useRef(null)
  useEffect(() => {
    if (drawer) toggleRef.current?.focus()
  }, [drawer])

  // (#68 b): below 1024px, but from 768px, the open menu is `expanded` (not a drawer) and still replaces the page's
  // «Open menu» button, which unmounts when it opens: the focus went to <body>. When the parent says the toggle is the way out
  // (`focusToggleOnOpen`), the focus goes to it on the change from collapsed to open, like the drawer. Escape is untouched.
  const previousModeRef = useRef(mode)
  useEffect(() => {
    const openedFromCollapsed = previousModeRef.current === 'collapsed' && mode !== 'collapsed'
    previousModeRef.current = mode
    if (openedFromCollapsed && focusToggleOnOpen && !rail) toggleRef.current?.focus()
  }, [mode, focusToggleOnOpen])

  // A fade shows while there is more navigation below. Content never goes under it.
  const scrollRef = useRef(null)
  const [more, setMore] = useState(false)
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined
    const update = () => setMore(element.scrollTop + element.clientHeight < element.scrollHeight - 1)
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    if (element.firstElementChild) observer?.observe(element.firstElementChild)
    return () => {
      element.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [mode])

  // a shell notice that sits in the page flow (the trial offer) or sticks to the top (past due, connection) takes room
  // above the layout. The menu is the rest of the window: it publishes what is above its layout on itself, and sidebar.css makes
  // its block size `100dvh` minus that, so the account row stays inside the window (the navigation list scrolls on its own).
  // Measured, not computed from the banners: whatever sits above the layout counts, and the body resizes when it changes.
  useLayoutEffect(() => {
    const nav = panelRef.current?.parentElement
    const layout = nav?.parentElement
    if (!nav || !layout) return undefined
    const measure = () => {
      const above = Math.max(0, Math.round(layout.getBoundingClientRect().top + window.scrollY))
      nav.style.setProperty('--odc-shell-notice-block', `${above}px`)
      // Also on the layout, so a page that fills the window (the Settings hub) can take the same offset.
      layout.style.setProperty('--odc-shell-notice-block', `${above}px`)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(document.body)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      nav.style.removeProperty('--odc-shell-notice-block')
      layout.style.removeProperty('--odc-shell-notice-block')
    }
  }, [])

  // On arrival and on a route change (not on every render) the current entry is brought into
  // view, so a short window never hides where you are. A closed panel waits until it opens.
  const currentEntryKey = getCurrentEntryKey(groups)
  const scrolledFor = useRef(null)
  useEffect(() => {
    const target = scrollRef.current?.querySelector('[aria-current="page"], .odc-nav-rail-current')
    const signature = `${currentEntryKey}|${mode}`
    if (collapsed || !target || scrolledFor.current === signature || target.closest('[hidden], [inert]')) return
    scrolledFor.current = signature
    target.scrollIntoView?.({ block: 'nearest' })
    resetTabStart()
  }, [currentEntryKey, mode, openKey, collapsed])

  const renderItem = item => {
    if (item.kind === 'section') {
      return rail
        ? <RailSection key={item.key} item={item} t={t} onNavigate={onNavigate} onRequestUpgrade={onRequestUpgrade} />
        : (
          <NavSection
            key={item.key}
            item={item}
            open={isOpen(item)}
            onToggle={() => toggleSection(item)}
            t={t}
            onNavigate={onNavigate}
            onRequestUpgrade={onRequestUpgrade}
          />
          )
    }
    if (item.kind === 'action') return <NavAction key={item.key} item={item} t={t} rail={rail} handlers={handlers} />
    if (item.kind === 'external') return <NavExternal key={item.key} item={item} t={t} rail={rail} />
    return <NavLink key={item.key} item={item} rail={rail} onNavigate={onNavigate} onRequestUpgrade={onRequestUpgrade} onTopLevel={() => setOpenKey(null)} />
  }

  return (
    <nav
      ref={navRef}
      id='side_bar'
      className='odc-root odc-sidebar'
      aria-label={t('MENU', 'Menu')}
      data-slot='sidebar-navigation'
      data-collapsed={collapsed ? '' : undefined}
      data-rail={rail ? '' : undefined}
      data-drawer={drawer ? '' : undefined}
      inert={collapsed ? '' : undefined}
      aria-hidden={collapsed ? true : undefined}
      dir={direction}
    >
      {drawer && <div className='odc-sidebar-scrim' data-slot='sidebar-scrim' onClick={onCloseDrawer} />}
      <div
        ref={panelRef}
        className='odc-sidebar-panel'
        role={drawer ? 'dialog' : undefined}
        aria-modal={drawer ? 'true' : undefined}
        aria-label={drawer ? t('MENU', 'Menu') : undefined}
      >
        <div className='odc-sidebar-head'>
          {!rail && (
            <button type='button' className='odc-sidebar-logo' aria-label={t('HOME', 'Home')} onClick={onHome}>
              <img src={logoSrc} alt='' />
            </button>
          )}
          {/* always inside the same RailItem (bare outside the rail), so folding or unfolding the menu does not
              remount the button and the focus stays on it. */}
          <RailItem label={toggleLabel} bare={!rail}>
            <IconButton
              icon={toggleIcon}
              label={toggleLabel}
              flipInRtl={toggleFlip}
              onClick={onToggle}
              ref={toggleRef}
              className='odc-sidebar-toggle'
              title={rail ? undefined : toggleLabel}
            />
          </RailItem>
        </div>
        <div className='odc-nav-tools'>
          <SearchButton t={t} rail={rail} />
          {assistant.isAvailable && <AssistantRow assistant={assistant} rail={rail} />}
        </div>
        <div className='odc-nav-scroll' data-testid='sidebar-scroll-content' data-more={more ? '' : undefined} ref={scrollRef}>
          <div>
            {groups.map(group => (
              <NavGroup key={group.key} group={group}>
                {group.items.map(renderItem)}
              </NavGroup>
            ))}
          </div>
        </div>
        <div className='odc-sidebar-foot' id='user_info'>
          {rail ? <UpgradeRailButton upgradeOffer={upgradeOffer} /> : <UpgradeCard upgradeOffer={upgradeOffer} />}
          <AccountMenu
            t={t}
            user={user}
            project={project}
            items={account}
            showLanguage={showLanguage}
            cannyLink={cannyLink}
            compact={rail}
            onNavigate={onNavigate}
            onRequestUpgrade={onRequestUpgrade}
            onOpenChange={open => { accountOpenRef.current = open }}
            dir={direction}
          />
        </div>
      </div>
    </nav>
  )
}

const NavGroup = ({ group, children }) => {
  const labelId = useId()
  return (
    <div role='group' aria-labelledby={labelId} className='odc-nav-group'>
      <div id={labelId} className='odc-nav-label'>{group.label}</div>
      {children}
    </div>
  )
}
