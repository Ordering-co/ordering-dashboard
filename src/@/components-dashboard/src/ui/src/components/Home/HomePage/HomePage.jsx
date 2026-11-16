import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useHistory } from 'react-router-dom'

import { useLanguage, useSession, useApi, useSite, Home as HomeController, useConfig } from '../../../../../index'
import { canOpenDashboardRoute, getDashboardNavSections } from '../../../../../utils/dashboardNavigation'
import { canRegisterStores } from '../../../../../utils/storeAdd'
import { canOpenNavDestination } from '../../../../../utils/commandPaletteActions'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useProjectState } from '../../../contexts/ProjectContext'
import { getPreferredSiteUrl } from '../../../utils/getPreferredSiteUrl'
import { getIntercomHash, setIntercomSettings } from '~/components/Utils'
import { isIntercomAllowed, isProjectIntercomAllowed } from '../../../utils/assistantIntercom'
import { useProductDir } from '../../Shared/Product/useProductDir'
import { TrialExtensionHomeCard } from '../../TrialExtension'
import { WhatsNew } from './WhatsNew'
import { useGoogleActionsVisibility } from '../../../hooks/useGoogleActionsVisibility'
import { HomeHeader } from './HomeHeader'
import { TodaySummary } from './TodaySummary'
import { SalesTrend } from './SalesTrend'
import { NeedsAttention } from './NeedsAttention'
import { SetupGuide, SetupGuideRestore } from './SetupGuide'
import { MoreServices } from './MoreServices'
import { Shortcuts } from './Shortcuts'
import './blocks.css'
import './home.css'

const withoutQuery = (path) => String(path ?? '').split('?')[0]

/**
 * redesign home R1 (Q-04, review M4): a button that disappears when its action runs (a retry that swaps the error for the skeleton,
 * «Hide guide», «Show setup guide») would drop the focus on the body. `arm()` is called by the action; when `ready` is true the
 * focus goes to `ref` once. A block that loads on its own, with no action asked, never takes the focus.
 */
const useFocusAfter = (ref, ready) => {
  const armed = useRef(false)
  useEffect(() => {
    if (!armed.current || !ready || !ref.current) return
    armed.current = false
    ref.current.focus()
  })
  return useCallback(() => { armed.current = true }, [])
}

/**
 * Home (redesign home C1, D1): direction A, «Pulso del día». The controller (`Home`, lote B) computes; this paints, in this order:
 * header, trial card, setup guide, today's figures, trend with «Needs attention», shortcuts, support and the guide's restore
 * support (main removed the More Services cards).
 */
export const HomePageUI = (props) => {
  const {
    today,
    reloadToday,
    trend,
    reloadTrend,
    last30SalesList,
    attention,
    reloadAttention,
    attentionKeys,
    guide,
    hideGuide,
    showGuide,
    canOpen,
    disableSupportModule
  } = props

  const [{ configs, loading: loadingConfigs }] = useConfig()
  const [{ sites }] = useSite()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [projectStatus] = useProjectState()
  const [sessionState] = useSession()
  const [ordering, { configurations }] = useApi()
  // «Stores Google is not showing» counts the activated stores the API skipped, from the project's Google status
  const { visible: googleActionsVisible, status: googleActions } = useGoogleActionsVisibility()
  const showGoogleRow = googleActionsVisible && canOpen?.('/connect/order-with-google') !== false
  const homeAttentionKeys = showGoogleRow ? [...(attentionKeys || []), 'googleNotShown'] : attentionKeys
  const homeAttention = showGoogleRow
    ? { ...attention, counts: { ...(attention?.counts || {}), googleNotShown: Number(googleActions?.counts?.skipped) || 0 } }
    : attention
  const history = useHistory()
  const dir = useProductDir()

  const user = sessionState?.user

  // redesign home R1 (Q-04): where the focus goes after each action that removes the button the person pressed
  const todayHeadingRef = useRef(null)
  const trendHeadingRef = useRef(null)
  const attentionHeadingRef = useRef(null)
  const guideHeadingRef = useRef(null)
  const restoreButtonRef = useRef(null)
  const armToday = useFocusAfter(todayHeadingRef, !today?.loading)
  const armTrend = useFocusAfter(trendHeadingRef, !trend?.loading)
  const armAttention = useFocusAfter(attentionHeadingRef, !attention?.loading)
  const armHide = useFocusAfter(restoreButtonRef, Boolean(guide?.eligible && guide?.hidden))
  const armShow = useFocusAfter(guideHeadingRef, Boolean(guide?.eligible && !guide?.hidden))
  const retryToday = () => { armToday(); reloadToday?.() }
  const retryTrend = () => { armTrend(); reloadTrend?.() }
  const retryAttention = () => { armAttention(); reloadAttention?.() }
  const handleHide = () => { armHide(); hideGuide?.() }
  const handleShow = () => { armShow(); showGuide?.() }

  const onNavigate = useCallback((path) => history.push(path), [history])
  const hasAttention = Array.isArray(homeAttentionKeys) && homeAttentionKeys.length > 0

  // main: «Visit my Website» opens the site the project prefers, in a new tab
  const handleVisitWebsite = () => {
    const websiteUrl = getPreferredSiteUrl({
      sites,
      configurations,
      configs,
      ordering,
      websiteProduct: projectStatus?.websiteProduct
    })
    if (websiteUrl) window.open(websiteUrl, '_blank', 'noopener,noreferrer')
  }

  // redesign home C1 (HM-10, HM-17, auditor 5): the same values `main` sent, once per mount and only when the last 30 days series, the configs and
  // the project status have loaded.
  // redesign home R1 (Q-10, PA-1): as in `main`, a failed series sends nothing (an empty series would tell Intercom «no sales»); the
  // error does not consume the one send, so a retry that succeeds sends it
  // main (#472): nothing is sent while the project (its /current/support answer) or the Intercom workspace does not allow it. A hash that arrives after the project
  // changed or Home unmounted is dropped; a different project (or user) sends its own values once.
  const intercomSentFor = useRef(null)
  useEffect(() => {
    if (last30SalesList?.loading || last30SalesList?.error || loadingConfigs) return
    if (!isProjectIntercomAllowed(projectStatus) || !isIntercomAllowed()) return
    const sendKey = `${projectStatus?.project?.id ?? ''}:${projectStatus?.plan?.id ?? ''}:${user?.id ?? user?.email ?? ''}`
    if (intercomSentFor.current === sendKey) return
    intercomSentFor.current = sendKey
    let cancelled = false
    let done = false
    const values = {
      project_code: projectStatus?.project?.code,
      ...(user?.user_system_id ? { project_owner_id: user.user_system_id } : {}),
      project_current_status: projectStatus?.project?.current_status,
      project_current_status_until: projectStatus?.project?.project_current_status_until,
      ...(projectStatus?.plan?.id ? { project_plan: projectStatus.plan.id } : {}),
      // n.º 13: the last 30 closed days; the shape (array of `{ time, sales }`) must not change, Intercom fixes the type on first receipt
      project_sales_last_30_days: last30SalesList?.sales ?? [],
      project_addons: Object.keys(configs ?? {}).filter(config => config.includes('addon_')).map(c => configs[c])
    }
    const setIntercom = async () => {
      const userIntercomHash = await getIntercomHash({ userId: user?.email, token: sessionState?.token })
      done = true
      if (!cancelled && userIntercomHash) {
        setIntercomSettings({
          ...values,
          user_hash: userIntercomHash,
          company: {
            id: projectStatus?.project?.id,
            name: projectStatus?.project?.code
          }
        }, user)
      }
    }
    setIntercom()
    return () => {
      cancelled = true
      // a send cut short by a re-render of the same project is retried; one that finished is not repeated
      if (!done && intercomSentFor.current === sendKey) intercomSentFor.current = null
    }
  }, [last30SalesList?.loading, last30SalesList?.error, projectStatus, loadingConfigs, configs, sessionState?.token, user])

  return (
    <div
      className='od-ui od-home-page odc-root odc-home'
      data-slot='home-page'
      dir={dir}
    >
      <HomeHeader
        user={user}
        projectStatus={projectStatus}
        isCollapse={isCollapse}
        onShowMenu={() => handleMenuCollapse(false)}
        onVisitWebsite={handleVisitWebsite}
      />
      <TrialExtensionHomeCard />
      <SetupGuide
        guide={guide}
        level={user?.level}
        canOpen={canOpen}
        user={user}
        configs={configs}
        onHide={handleHide}
        onNavigate={onNavigate}
        headingRef={guideHeadingRef}
      />
      <WhatsNew onNavigate={onNavigate} />
      <TodaySummary today={today} onRetry={retryToday} headingRef={todayHeadingRef} />
      <div className='odc-home-split' data-solo={hasAttention ? undefined : ''}>
        {/* redesign home C1 (D1, analysis §4): attention first in the reading order, so a stacked layout (below 1280, the phone) shows it right after today's figures; from 1280 the grid puts the trend on the start side */}
        <NeedsAttention attention={homeAttention} keys={homeAttentionKeys} onRetry={retryAttention} onNavigate={onNavigate} headingRef={attentionHeadingRef} />
        <SalesTrend trend={trend} onRetry={retryTrend} headingRef={trendHeadingRef} />
      </div>
      <Shortcuts user={user} configs={configs} project={ordering?.project} sites={sites} onNavigate={onNavigate} />
      <MoreServices level={user?.level} disableSupportModule={disableSupportModule} />
      <SetupGuideRestore guide={guide} onShow={handleShow} buttonRef={restoreButtonRef} />
    </div>
  )
}

/**
 * The wired Home: what the user can open from their own menu (D7, auditor 4) decides which «Needs attention» rows are counted
 * and which steps of the guide get a link. The permission is the menu's (`getDashboardNavSections`), not only the route guard.
 */
export const HomePage = (props) => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const [{ sites }] = useSite()

  const sections = useMemo(
    // (main): the sites decide the My products website entries (a migrated one leaves after some days)
    () => getDashboardNavSections({ t, user, configs, sites }),
    [t, user, configs, sites]
  )
  const level = user?.level
  const canOpen = useCallback(
    (path) => {
      const url = withoutQuery(path)
      if (canOpenNavDestination({ sections, url, level })) return true
      // redesign a destination the menu does not list at all (/stores/add, the first step of the guide) was denied for
      // everybody, so a project with no stores got «Create a menu» as its primary. For those, the route guard's levels decide;
      // a menu item that exists but is hidden or disabled stays denied.
      const inMenu = Object.values(sections).some(section => section.items.some(item => item.url === url))
      if (inMenu || !canOpenDashboardRoute(url, level)) return false
      // The same «register stores» rule as the list's button, ⌘K and the route's gate
      return url !== '/stores/add' || canRegisterStores(user, configs)
    },
    [sections, level, user, configs]
  )
  const attentionKeys = useMemo(() => [
    ...(canOpen('/orders') ? ['pending', 'late'] : []),
    ...(canOpen('/deliveries') ? ['waitingDriver'] : []),
    ...(canOpen('/cart-recovery/open-carts') ? ['failedCarts'] : [])
  ], [canOpen])

  const homeProps = {
    ...props,
    UIComponent: HomePageUI,
    attentionKeys,
    sites,
    canOpen
  }

  return <HomeController {...homeProps} />
}
