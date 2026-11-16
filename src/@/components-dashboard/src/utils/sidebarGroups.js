import { canOpenDashboardRoute, getDashboardNavSections, getDashboardRoleFlags } from './dashboardNavigation'
import { isMyProductsPath, isProductAppActive } from './myProductsNav'

/**
 * Sidebar information architecture (orders pilot, C11): the same sections the
 * command palette searches (`getDashboardNavSections`), grouped by job — Operate,
 * Catalog, Grow, Platform — plus the account menu. Pure, no React.
 *
 * Visibility and active rules are the ones the sidebar already had (order,
 * level and read-only gates, addon flags); only the grouping and the presentation
 * change. Exactly one entry is current (`aria-current="page"`): a section that
 * contains the current page is marked `containsCurrent`, never current itself.
 *
 * Entry kinds:
 *  - `link`      internal route; `page` / `state` are the `go_to_page` payload, or `route` when the link goes
 *                straight to the router and never through the event bus (Open Source Code, as in main)
 *  - `external`  `href` opened in a new tab
 *  - `action`    `action` is handled by the UI (billing, upgrade, aiAgents, assistant)
 *  - `section`   disclosure with `items` (links, external links or product apps)
 */

const link = (key, label, icon, url, page, current, extra = {}) => ({ kind: 'link', key, label, icon, url, page, current: !!current, ...extra })

export const getSidebarGroups = ({
  t = (_key, fallback) => fallback,
  user,
  configs = {},
  location = { pathname: '', search: '', state: null },
  productApps = [],
  website = { loading: false, hasProduct: true, destinations: [] },
  plan = {},
  // (main): the project's sites; a legacy website migrated to Builder leaves My products after some days
  sites = [],
  // the project shows Order with Google (its Connect entry), and the urls a running «What's new» tags «New»
  googleActionsVisible = false,
  newFeatureUrls = []
} = {}) => {
  const pathname = location.pathname || ''
  const sections = getDashboardNavSections({ t, user, configs, sites, googleActionsVisible })
  const { level, isReadOnly } = getDashboardRoleFlags(user)
  const hasSystemId = !!user?.user_system_id
  // redesign (D1–D3, owner 2026-10-11): a section entry is offered only when its route guard lets the level in,
  // the rule the command palette already uses (M-06, M-07, M-11). Single entries (Home, Schools, Builder) and the account
  // menu keep their own rules: /home has no ProtectedRoute and the guard denies unknown routes.
  const childLinks = (items, isCurrent) => items
    .filter(item => item.enabled && canOpenDashboardRoute(item.url, level))
    .map(item => link(`${item.pageName}`, item.title, null, item.url, item.pageName, isCurrent(item),
      newFeatureUrls.includes(item.url) ? { badge: t('NEW', 'New') } : {}))

  const section = (key, label, icon, items, containsCurrent, extra = {}) => ({
    kind: 'section',
    key,
    label,
    icon,
    items,
    containsCurrent: !!containsCurrent || items.some(item => item.current),
    ...extra
  })

  const operate = []
  if (sections.home.visible) operate.push(link('home', t('HOME', 'Home'), 'House', '/home', 'home', pathname === '/home'))
  if (sections.orders.visible) {
    operate.push(section('orders', t('ORDERS', 'Orders'), 'ListChecks',
      childLinks(sections.orders.items, item => pathname.includes(item.url)),
      ['/orders', '/cart-recovery/open-carts', '/messages', '/appointments', '/gift-cards'].includes(pathname) ||
        (['/all-in-one', '/deliveries'].includes(pathname) && isReadOnly)))
  }
  if (sections.delivery.visible) {
    operate.push(section('delivery', t('DELIVERY', 'Delivery'), 'Truck',
      childLinks(sections.delivery.items, item => pathname.includes(item.pageName) || pathname.includes(item.url)),
      ['/delivery/drivers-list', '/delivery/drivers-managers', '/delivery/drivers-groups', '/delivery/drivers-companies', '/delivery/drivers-time-display', '/all-in-one', '/deliveries', '/drivers-dashboard'].includes(pathname)))
  }
  if (!isReadOnly && sections.schools.visible) {
    operate.push(link('schools', t('SCHOOLS', 'Schools'), 'GraduationCap', '/schools', 'schools', pathname.includes('schools')))
  }

  const catalog = []
  if (sections.stores.visible) {
    catalog.push(section('stores', t('STORES', 'Stores'), 'Store',
      childLinks(sections.stores.items, item => pathname.includes(item.url)),
      pathname.includes('stores')))
  }
  if (sections.myProducts.visible) {
    const products = childLinks(sections.myProducts.items, item => pathname === item.url || pathname.startsWith(`${item.url}/`))
    const apps = productApps.map(app => {
      const current = isProductAppActive({ app, search: location.search, state: location.state })
      return link(`app-${app.id}`, app.title, null, `/my-products?id=${app.id}`, 'products', current, { search: `?id=${app.id}`, state: { productId: app.id, type: app.type } })
    })
    catalog.push(section('myProducts', t('MY_PRODUCTS', 'My products'), 'ShoppingBag', [...products, ...apps], isMyProductsPath(pathname)))
  }
  // main: Builder, right after My products, for every project (canAccessBuilder: level 0) and not read-only.
  if (sections.builder?.visible) {
    catalog.push(link('builder', t('BUILDER', 'Builder'), 'Phone', '/builder', 'builder',
      pathname === '/builder' || pathname.startsWith('/builder/'), { badge: t('NEW', 'New') }))
  }
  if (level === 0 && (website.loading || !website.hasProduct || website.destinations.length > 0)) {
    catalog.push(section('website', t('MY_WEBSITE', 'My website'), 'ExternalLink',
      website.destinations.map(destination => ({
        kind: 'external',
        key: `website-${destination.key}`,
        label: destination.key === 'live' ? t('LIVE_WEBSITE', 'Live website') : t('TEMPORARY_WEBSITE', 'Temporary website'),
        href: destination.url
      })),
      false,
      { disabled: website.loading || !website.hasProduct || website.destinations.length === 0 }))
  }

  const grow = []
  if (sections.marketing.visible) {
    grow.push(section('marketing', t('MARKETING', 'Marketing'), 'Megaphone',
      childLinks(sections.marketing.items, item => pathname.includes(item.pageName) || pathname.includes(item.url)),
      ['/marketing/promotions-enterprise', '/marketing/campaign', '/marketing/ad-banners', '/cart-recovery/recovery-actions'].includes(pathname)))
  }
  if (sections.users.visible) {
    grow.push(section('users', t('USERS', 'Users'), 'Users',
      childLinks(sections.users.items, item => pathname.includes(item.pageName) || pathname.includes(item.url)),
      ['/users/customers', '/users/business-owners', '/users/callcenter-agents', '/users/professionals', '/users/managers'].includes(pathname)))
  }
  if (sections.intelligence.visible) {
    grow.push(section('intelligence', t('REPORTS', 'Reports'), 'ChartColumn',
      childLinks(sections.intelligence.items, item => pathname.includes(item.pageName) || pathname === item.url),
      ['/intelligence/business', '/intelligence/drivers', '/intelligence/invoice', '/intelligence/reports', '/intelligence/business-payments'].includes(pathname) ||
        pathname.includes('/intelligence/reviews')))
  }
  // Owner decision 30 A (2026-10-21): not for a read-only admin until (it hands the session to ai.ordering.co). This item is
  // the only way in: AI agents has no route and no ⌘K entry.
  if (level === 0 && !isReadOnly) grow.push({ kind: 'action', key: 'aiAgents', action: 'aiAgents', label: t('AI_AGENTS', 'AI agents'), icon: 'Workflow', external: true })

  // main: levels 0 and 2 always reach the account footer, read-only or not (Open Source Code: level 0 only, ).
  const showBottom = [0, 2].includes(level) || !isReadOnly
  const platform = []
  if (sections.connect.visible) {
    platform.push(section('connect', t('CONNECT_MODULE', 'Connect'), 'Plug',
      childLinks(sections.connect.items, item => pathname.includes(item.url)),
      pathname.includes('connect')))
  }
  if (showBottom && !isReadOnly) {
    if (level === 0 && hasSystemId) platform.push({ kind: 'action', key: 'billing', action: 'billing', label: t('BILLING', 'Billing'), icon: 'Banknote' })
    if (level === 0 && hasSystemId && plan?.upgrade_plan_id) platform.push({ kind: 'action', key: 'upgrade', action: 'upgrade', label: t('UPGRADE_TO_PRO', 'Upgrade to Pro'), icon: 'Star' })
    if (level === 0) platform.push(link('settings', t('SETTINGS', 'Settings'), 'Settings', '/settings', 'settings', pathname === '/settings'))
    // main: Logs audit has one page, so it opens straight from the sidebar instead of a one-item disclosure.
    if (sections.logs.visible) platform.push(link('logs', t('LOGS_AUDIT', 'Logs audit'), 'FileText', '/settings/logs', 'logs', pathname === '/settings/logs'))
  }

  const account = []
  account.push(link('profile', t('PROFILE', 'Profile'), 'UserRound', '/profile', 'profile', pathname === '/profile'))
  if (showBottom && level === 0) account.push(link('free_products', t('FREE_DOWNLOADS', 'Free downloads'), 'Download', '/free-downloads', 'free_products', pathname === '/free-downloads'))
  // main: Open Source Code is for administrators only
  if (showBottom && level === 0) account.push(link('open_source_code', t('SOURCE_CODE_PAGE_TITLE', 'Open source code'), 'Download', '/open-source-code', 'open_source_code', pathname === '/open-source-code', { route: '/open-source-code' }))
  if (showBottom && !isReadOnly && level === 0) account.push({ kind: 'external', key: 'share_ideas', label: t('SHARE_IDEAS', 'Share ideas'), icon: 'Lightbulb', href: 'https://tally.so/r/WO4pdJ' })
  if (!(level === 2 && configs?.white_label_module?.value)) account.push({ kind: 'external', key: 'help', label: t('HELP', 'Help'), icon: 'CircleHelp', href: 'https://docs.ordering.co' })

  return {
    groups: [
      { key: 'operate', label: t('SIDEBAR_GROUP_OPERATE', 'Operate'), items: operate },
      { key: 'catalog', label: t('SIDEBAR_GROUP_CATALOG', 'Catalog'), items: catalog },
      { key: 'grow', label: t('SIDEBAR_GROUP_GROW', 'Grow'), items: grow },
      { key: 'platform', label: t('SIDEBAR_GROUP_PLATFORM', 'Platform'), items: platform }
    ].filter(group => group.items.length > 0),
    account,
    showLanguage: showBottom && !isReadOnly
  }
}

/** Key of the section that contains the current page, to open it on arrival. */
export const getCurrentSectionKey = groups => groups
  .flatMap(group => group.items)
  .find(item => item.kind === 'section' && !item.independent && item.containsCurrent)?.key ?? null
