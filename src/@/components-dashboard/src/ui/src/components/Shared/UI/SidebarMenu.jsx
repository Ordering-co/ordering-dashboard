import React, { useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { getDashboardThemeLogo } from '~/brand/identity'
import { PanelLeftClose, PanelLeftOpen, X as CloseIcon } from '../Icon'
import { useTheme } from 'styled-components'
import { SidebarMenu as SidebarMenuController, useEvent, useLanguage, useSession, useConfig, useApi, useSite, useAssistantDock } from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useLegacyPlanUpgrade } from '../../../contexts/LegacyPlanUpgradeContext'
import { useProjectState } from '../../../contexts/ProjectContext'
import { useUpgradeOffer } from '../../../contexts/UpgradeOfferContext'
import { buildUpgradeCardProps } from '../SideBar/upgradeCard'
import { capitalize, firstLetterCapital, getDashboardLogoUrl } from '../../../utils'
import { buildAiAgentsUrl, buildAiAgentsUpgradeUrl } from '../../../utils/aiAgentsUrl'
import { AiAgentsUpgradeModal } from '../../AiAgentsUpgradeModal'
import { getEnabledProductApps, isProductAppActive } from '../../../../../utils/myProductsNav'
import { isLegacyUpgradeDestination } from '../../../../../utils/legacyPlanUpgradeDestinations'
import { getSidebarGroups } from '../../../../../utils/sidebarGroups'
import { getNewFeatureUrls } from '../../../../../utils/featureAnnouncements'
import { useGoogleActionsVisibility } from '../../../hooks/useGoogleActionsVisibility'
import { focusPageStart, isShown } from '../../../../../utils/focusPageStart' // redesign billing-modal: promoted
import { watchPageStart } from '../../../../../utils/watchPageStart' // promoted, the ⌘K navigation is the second user
import { ASSISTANT_ROUTE } from '../../Assistant/route'
import { getPreferredSiteDestinations } from '../../../utils/getPreferredSiteUrl'
import { useSourceCodeTranslator } from '../../../../../components/SourceCodeDownloads/useSourceCodeTranslator'
import { SidebarNav } from '../SideBar/SidebarNav'

// (#79): the visible element outside the menu that carries the name the remembered opener had. Only when that
// name is unique on the page: a repeated name (a «More actions» per row) cannot say which one it was.
const findOpenerByLabel = (label, nav) => {
  if (!label) return null
  const matches = [...document.querySelectorAll('[aria-label]')].filter(
    element => element.getAttribute('aria-label') === label && !nav?.contains(element) && isShown(element)
  )
  return matches.length === 1 ? matches[0] : null
}

// redesign 5.1: the menu is painted by Shared/SideBar/SidebarNav (C11). This component keeps
// everything the old sidebar did that is not paint: events, billing, the focus it gives back,
// the auto-collapse, the assistant dock, Canny and the mobile notice.
export const SidebarMenuUI = (props) => {
  const { productsState, getBillingToken, getAiAgentsCode, billingUrl, setShowBillingPayment, aiModuleEnabled } = props

  const location = useLocation()
  const history = useHistory()
  const [events] = useEvent()
  // main: the Open Source Code labels come from their own catalog when the API has none.
  const [languageState, apiTranslator] = useLanguage()
  const t = useSourceCodeTranslator(apiTranslator, languageState.language)
  const [sessionState] = useSession()
  const [{ sites, loading: sitesLoading }] = useSite()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const [ordering, { configurations }] = useApi()
  const [projectStatus] = useProjectState()
  const [{ isCollapse, isRail }, { handleMenuCollapse, handleMenuRail }] = useInfoShare()
  const windowSize = useWindowSize()
  const sidebarRef = useRef(null)
  const lastExternalFocusRef = useRef(null)
  const lastExternalFocusLabelRef = useRef(null)
  const wasCollapsedRef = useRef(isCollapse)
  const collapsedByWidthRef = useRef(false)
  // (row 20a): set when a page was chosen in the phone drawer; the next collapse sends the focus to the new page
  const focusAfterNavRef = useRef(false)
  const assistant = useAssistantDock()
  const { upgradeRequired, requestUpgrade } = useLegacyPlanUpgrade()
  // (sidebar follow-up): one shared fetch (UpgradeOfferProvider, mounted in App.js)
  // feeds both this card and UpgradeOfferModal; `onOpen` opens that same modal.
  const { offer: upgradeOfferData, openModal: openUpgradeOffer } = useUpgradeOffer()
  const upgradeOfferCard = buildUpgradeCardProps(upgradeOfferData)
  const upgradeOffer = upgradeOfferCard && { ...upgradeOfferCard, onOpen: openUpgradeOffer }
  // (#5): AssistantPanel never draws the panel on /assistant (the page is the conversation), so there the entry
  // does not report it as pressed and does not flip a panel nobody sees. The entry stays; it just has nothing to open.
  const onAssistantPage = location.pathname === ASSISTANT_ROUTE
  const isAssistantOpen = !upgradeRequired && !onAssistantPage && assistant.isOpen
  const isAssistantActive = isAssistantOpen

  const [isAiAgentsUpgradeOpen, setIsAiAgentsUpgradeOpen] = useState(false) // (main)
  const [authenticateCannyLink, setAuthenticateCannyLink] = useState('')
  const enabledProductApps = getEnabledProductApps(productsState.apps)
  const isCannyActivated = false
  const user = sessionState?.user

  const websiteDestinations = getPreferredSiteDestinations({
    sites,
    configurations,
    ordering,
    websiteProduct: projectStatus?.websiteProduct
  })

  // Order with Google is listed while the project shows it; a running «What's new» tags its page «New»
  const { visible: googleActionsVisible, status: googleActions } = useGoogleActionsVisibility()
  const newFeatureUrls = getNewFeatureUrls({ context: { googleActions } })

  // The sections, their order and every visibility / read-only / addon rule live in getSidebarGroups
  const sidebar = getSidebarGroups({
    t,
    user,
    configs,
    location,
    productApps: enabledProductApps,
    website: {
      loading: sitesLoading,
      hasProduct: !!projectStatus?.websiteProduct,
      destinations: websiteDestinations
    },
    plan: projectStatus?.plan,
    sites,
    googleActionsVisible,
    newFeatureUrls
  })
  // The old sidebar passed these sections' submenu titles through firstLetterCapital (which also lowercases the rest); Stores,
  // Connect, Users and My products rendered them as given. English keeps that sentence case (the live catalog still
  // has «Delivery Groups»); any other language only gets its first letter raised, because lowercasing the rest broke German nouns
  // and names («Zeitanzeige des fahrers»).
  const CAPITALISED_SECTIONS = ['orders', 'delivery', 'marketing', 'intelligence', 'logs']
  const toMenuCase = (languageState?.language?.code ?? 'en') === 'en' ? firstLetterCapital : capitalize
  const groups = sidebar.groups.map(group => ({
    ...group,
    items: group.items.map(item => item.kind === 'section' && CAPITALISED_SECTIONS.includes(item.key)
      ? { ...item, items: item.items.map(child => ({ ...child, label: typeof child.label === 'string' ? toMenuCase(child.label) : child.label })) }
      // (main), without the AI module, AI agents opens the upgrade form here, not a new tab
      : item.key === 'aiAgents' && aiModuleEnabled === false ? { ...item, external: false } : item)
  }))
  const { account, showLanguage } = sidebar

  // Close the phone drawer before showing another modal. Its opener can be
  // repainted on close, so resolve the return target after the upgrade dialog.
  const requestSidebarUpgrade = (fallbackFocus, proceed) => {
    const mobile = windowSize.width < 768
    const opener = lastExternalFocusRef.current
    const label = lastExternalFocusLabelRef.current
    const returnFocus = mobile
      ? () => {
          if (opener?.isConnected && opener.getClientRects().length) return opener
          // The page's replacement menu trigger can still be inert while the
          // modal is closing. Match its visible box, not its current tab order.
          const matches = [...document.querySelectorAll('[aria-label]')].filter(element =>
            element.getAttribute('aria-label') === label &&
            !sidebarRef.current?.contains(element) && element.getClientRects().length > 0)
          return matches.length === 1 ? matches[0] : null
        }
      : fallbackFocus
    if (!requestUpgrade(returnFocus, proceed)) return false
    if (mobile) handleMenuCollapse(true)
    return true
  }

  const requestNavigationUpgrade = (path, event, fallbackFocus, proceed) => {
    const accountFocus = path === '/open-source-code' ? () => sidebarRef.current?.querySelector('.odc-account-trigger') : undefined
    if (!isLegacyUpgradeDestination(path) || !requestSidebarUpgrade(fallbackFocus || accountFocus || event?.currentTarget, proceed)) return false
    event?.preventDefault()
    return true
  }

  const handleGoToPage = (e, data) => {
    e?.preventDefault?.()
    if (windowSize.width < 768) {
      focusAfterNavRef.current = true
      handleMenuCollapse(true)
    }
    events.emit('go_to_page', data)
  }

  // A product app that is already open stays put: no go_to_page, no collapse
  const handleNavigate = (e, data) => {
    // main: a `route` link goes straight to the router; nothing about it reaches the event bus.
    if (data?.route) {
      e?.preventDefault?.()
      if (windowSize.width < 768) {
        focusAfterNavRef.current = true
        handleMenuCollapse(true)
      }
      history.push(data.route)
      return
    }
    if (data?.page === 'products' && data.state?.productId != null) {
      const app = enabledProductApps.find(item => item.id === data.state.productId)
      if (app && isProductAppActive({ app, search: location.search, state: location.state })) {
        e?.preventDefault?.()
        return
      }
    }
    handleGoToPage(e, data)
  }

  // redesign F6d (Q3-07): below 1024px the menu is hidden because of the width, not because the user closed it, so
  // it comes back when the width does. A menu that was already closed when the width went narrow stays closed.
  // main (SidebarMenu/index.js:115-118) collapses and never reopens, so it has the same bug.
  useEffect(() => {
    if (windowSize.width < 1024) {
      if (!isCollapse) {
        collapsedByWidthRef.current = true
        handleMenuCollapse(true)
      }
      return
    }
    if (collapsedByWidthRef.current) {
      collapsedByWidthRef.current = false
      handleMenuCollapse(false)
    }
  }, [windowSize.width])

  useEffect(() => {
    const rememberExternalFocus = (event) => {
      // redesign 5.1: the account popover and the rail menus render in a portal, outside the nav,
      // but they belong to it: focus inside them is not an external opener to give focus back to.
      if (event.target.closest?.('[role="menu"], [data-slot="sidebar-account-popup"]')) return
      if (!sidebarRef.current?.contains(event.target)) {
        lastExternalFocusRef.current = event.target
        // (#79): also how to find it again, because the page repaints its «Open menu» button when the menu closes
        lastExternalFocusLabelRef.current = event.target.getAttribute?.('aria-label') || null
      }
    }
    document.addEventListener('focusin', rememberExternalFocus)
    return () => document.removeEventListener('focusin', rememberExternalFocus)
  }, [])

  useEffect(() => {
    if (isCollapse && !wasCollapsedRef.current && focusAfterNavRef.current) {
      // (row 20a): a page was chosen in the phone drawer. The opener is about to be repainted with the new route (and
      // <body> would get the focus), so skip it and wait for the route to paint before moving to the start of the new page.
      focusAfterNavRef.current = false
      let second = 0
      const watch = watchPageStart(sidebarRef.current)
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(watch.arm)
      })
      wasCollapsedRef.current = isCollapse
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
        watch.stop()
      }
    }
    if (!isCollapse) focusAfterNavRef.current = false
    if (isCollapse && !wasCollapsedRef.current && lastExternalFocusRef.current) {
      // Only when an opener was remembered: the auto-collapse of a first load has none and must not take focus.
      if (lastExternalFocusRef.current.isConnected) lastExternalFocusRef.current.focus()
      else {
        // (#79): the page repainted its opener (same name) in this commit; use it before falling back to the page start.
        const opener = findOpenerByLabel(lastExternalFocusLabelRef.current, sidebarRef.current)
        if (opener) opener.focus()
        else focusPageStart(sidebarRef.current)
      }
    }
    wasCollapsedRef.current = isCollapse
  }, [isCollapse])

  const handleClickBilling = async () => {
    const billingState = await getBillingToken()
    if (!billingState?.error && billingState?.result?.access_token) {
      window.location.assign(
        `${billingState?.result?.referer_url
          ? `https://${billingState?.result?.referer_url}`
          : billingUrl}?token=${billingState?.result?.access_token}`
      )
    }
  }

  useEffect(() => {
    if (window.Canny && isCannyActivated && sessionState?.user?.user_system_id) {
      const authenticateCallback = () => {
        const _authenticatedLink = window.Canny('authenticateCannyLink', 'ordering.canny.io')
        setAuthenticateCannyLink(`https://${_authenticatedLink}`)
      }
      window.Canny('identify', {
        appID: '66a7d2eae6f021c079288dc9',
        user: {
          email: sessionState?.user?.email,
          name: `${sessionState?.user?.name} ${sessionState?.user?.lastname}`,
          id: sessionState?.user?.user_system_id,
          avatarURL: sessionState?.user?.photo
        }
      }, authenticateCallback)
    }
  }, [sessionState?.user?.user_system_id, isCannyActivated])

  // Below 1024px the menu is not a rail: the header button closes it (the drawer below 768px)
  const wide = windowSize.width >= 1024
  const mode = isCollapse
    ? 'collapsed'
    : windowSize.width < 768
      ? 'drawer'
      : wide && isRail ? 'rail' : 'expanded'
  const toggle = !wide
    ? { label: t('CLOSE', 'Close'), icon: CloseIcon, flip: false, onClick: () => handleMenuCollapse(true) }
    : isRail
      ? { label: t('EXPAND_SIDEBAR', 'Expand sidebar'), icon: PanelLeftOpen, flip: true, onClick: () => handleMenuRail?.(false) }
      : { label: t('COLLAPSE_SIDEBAR', 'Collapse sidebar'), icon: PanelLeftClose, flip: true, onClick: () => handleMenuRail?.(true) }

  const handleAiAgents = async () => {
    // (main): a project without the AI module gets the upgrade form instead of AI Agents
    if (aiModuleEnabled === false) {
      setIsAiAgentsUpgradeOpen(true)
      return
    }
    if (!sessionState?.token || !ordering?.project) return
    // The tab opens in the click, before the code request: one opened after an await is a blocked popup.
    // Without noopener window.open returns the tab, so the opener link is cut by hand.
    const tab = window.open('', '_blank')
    if (!tab) return
    tab.opener = null
    const url = buildAiAgentsUrl({ code: await getAiAgentsCode?.(), project: ordering.project })
    if (url) tab.location.replace(url)
    else tab.close()
  }

  return (
    <>
      {/* redesign fix-qa E8: the first Tab stop of the shell. It shows on focus and takes the focus to the page's own
          start (its first visible h1, else the main container) past the sidebar's navigation. The href is the shell's
          <main id='main-content'> (src/components/ShellMain); the click does the same jump the menu uses when it hands the focus back. */}
      <a
        className='odc-root odc-skip-link'
        href='#main-content'
        onClick={(event) => {
          event.preventDefault()
          focusPageStart(sidebarRef.current)
        }}
      >
        {t('SKIP_TO_CONTENT', 'Skip to content')}
      </a>
      <SidebarNav
        t={t}
        navRef={sidebarRef}
        mode={mode}
        groups={groups}
        account={account}
        showLanguage={showLanguage}
        logoSrc={getDashboardLogoUrl(configs, getDashboardThemeLogo(theme))}
        onHome={(e) => handleGoToPage(e, { page: 'home' })}
        toggleLabel={toggle.label}
        toggleIcon={toggle.icon}
        toggleFlip={toggle.flip}
        onToggle={toggle.onClick}
        onNavigate={handleNavigate}
        onRequestUpgrade={requestNavigationUpgrade}
        onBilling={handleClickBilling}
        onUpgrade={() => setShowBillingPayment((prevState) => ({ ...prevState, open: true, from: 'upgrade_pro' }))}
        onAiAgents={handleAiAgents}
        assistant={{
          isAvailable: assistant.isAvailable,
          isOpen: isAssistantOpen,
          isActive: isAssistantActive,
          toggle: () => {
            const openAssistant = () => { if (!onAssistantPage) assistant.setOpen(prev => !prev) }
            if (!requestSidebarUpgrade(undefined, openAssistant)) openAssistant()
          }
        }}
        focusToggleOnOpen={!wide}
        closeOnEscape={!wide}
        user={{
          name: user?.name,
          lastname: user?.lastname,
          email: user?.email,
          photo: user?.photo
        }}
        project={ordering?.project}
        cannyLink={user?.level === 0 && user?.user_system_id ? authenticateCannyLink : ''}
        upgradeOffer={upgradeOffer}
        onCloseDrawer={() => handleMenuCollapse(true)}
      />
      <AiAgentsUpgradeModal
        open={isAiAgentsUpgradeOpen}
        onClose={() => setIsAiAgentsUpgradeOpen(false)}
        formUrl={buildAiAgentsUpgradeUrl({
          email: sessionState?.user?.email,
          project: ordering?.project
        })}
      />
    </>
  )
}

export const SidebarMenu = (props) => {
  const sidebarMenu = {
    ...props,
    UIComponent: SidebarMenuUI
  }
  return <SidebarMenuController {...sidebarMenu} />
}
