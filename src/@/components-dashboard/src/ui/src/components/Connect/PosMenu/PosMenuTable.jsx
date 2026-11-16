import React, { useState } from 'react'

import { useLanguage, useSession, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getIntegrationSetupAction, getIntegrationSetupStatus, getIntegrationSetupWarning } from '../../../../../utils/integrationSetupStatus'
import { useShowPluginPage } from '../../../hooks/usePluginPage'
import {
  Avatar,
  Button,
  ColumnManager,
  DataTable,
  EmptyState,
  RecordCardList,
  Status
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Search, Store, TriangleAlert } from '../../Shared/Icon'
import { connectKind } from './connectKinds'
import { PluginFrameDialog } from './PluginFrameDialog'
import { SetupWarning } from './SetupWarning'
import { isPluginLinkRestricted, linkedIntegrations, posSummary } from './posMenuModel'
import './pos-menu-table.css'

// redesign PM-B (decisions D1, D2, D6): the store table of /connect/pos-menu as a Product DataTable, and RecordCards under
// 768px. It draws what the PosMenuBusinessList controller gives (the businesses, the POS catalog, the cities) and fetches nothing: the
// page owns the search, the tabs, the page and the panel. What `main` showed is kept (inventory C6, C7, C9): ID, Business (logo, name,
// city), Status, the Disabled reason of the Inactive tab, Business and Status that can be hidden, and the three empty messages.

const SKELETON_ROWS = 10 // inventory C6: 10 list rows
// ID is a fixed column and POS is always visible (D2); Business and Status can be hidden, as in `main` (C7). The columns and the
// fixed ones of a kind come from connectKinds (redesign SC-B, sales channels fix only ID and have Sales channels, not Status)
const defaultColumns = (columns) => columns.map(id => ({ id, visible: true }))

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpenBusiness`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

// The API sends a text or a list of texts (or of `{ message }`); the first one that says something is the one to show
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const fill = (template, name, value) => template.replace(name, () => String(value ?? ''))

// redesign PM-07: the logo of a POS is decoration (its name is beside it) and is gone when it does not load
const PosLogo = ({ src }) => {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return <img className='odc-pm-pos-logo' src={src} alt='' onError={() => setFailed(true)} />
}

/**
 * @param {object}   props
 * @param {Array<object>} props.businesses      `businessList.businesses`.
 * @param {boolean}  props.loading              `businessList.loading`.
 * @param {*}        [props.error]              `businessList.error`: a text or a list from the API, or null.
 * @param {Array<object>} props.integrations    `integrationsList.thirdPartyIntegrations` (the POS catalog).
 * @param {Array<{id: number, name: string}>} [props.citiesList]  Names of the cities (a business has `city_id`).
 * @param {boolean}  props.activeState          `selectedBusinessActiveState`: true = Active tab; Disabled reason shows on false.
 * @param {string|null} [props.searchValue]     The text searched.
 * @param {number|string|null} [props.activeBusinessId]  The store open in the panel (a number, or the text of the URL).
 * @param {Function} props.onOpenBusiness       `(business)`: opens the store panel.
 * @param {Function} props.onClearSearch        `()`: clears the search.
 * @param {Function} props.onRetry              `()`: loads the list again.
 * @param {string}   [props.kind]               `'pos'` (default) or `'sales_channel'`, see connectKinds: columns, cells and labels.
 * @param {Function} [props.onReload]           `()`: reads the list again after a plugin page the row opened closes (main #394).
 *
 * main #394, the list of main in this table: under the state of a POS its reason (setup_message) and the date it was
 * reported, a warning when its plugin cannot serve it, and one action per row only when something needs fixing: «Reconnect» (failed)
 * or «Continue setup» (pending). It opens the plugin's setup page (links.launch first, PluginFrameDialog) without opening the panel.
 */
export const PosMenuTable = ({
  businesses,
  loading,
  error,
  integrations,
  citiesList,
  activeState,
  searchValue,
  activeBusinessId,
  onOpenBusiness,
  onClearSearch,
  onRetry,
  kind = 'pos',
  onReload
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage, parseDate }] = useUtils()
  const [{ user }] = useSession()
  const [frame, setFrame] = useState({ open: false, url: null })
  const [frameStoreId, setFrameStoreId] = useState(null) // the store whose page is open (its messages must be about it)
  const showPluginPage = useShowPluginPage(setFrame)
  const isPhone = useIsPhone()
  const { kind: kindName, columns: kindColumns, lockedColumns, columnManager, cardStatus } = connectKind(kind)
  const isSalesChannel = kindName === 'sales_channel'
  const isImporter = kindName === 'importer'
  // redesign IM-A: only `importer` says false; undefined (pos, sales_channel) is true
  const showColumnManager = columnManager !== false
  const showCardStatus = cardStatus !== false
  const [columns, setColumns] = useState(() => defaultColumns(kindColumns)) // local and not saved, as in `main` (C7)

  const rows = businesses || []
  const isLoading = Boolean(loading)
  const openId = activeBusinessId != null && activeBusinessId !== '' && Number.isFinite(Number(activeBusinessId))
    ? Number(activeBusinessId)
    : undefined
  const term = String(searchValue ?? '').trim()

  const cityOf = (business) => (
    citiesList?.find(city => city.id === business.city_id)?.name || business.city?.name || ''
  )
  const logoOf = (business) => (business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined)

  // ---- the cells (the table and the cards draw the same ones) ----
  const storeCell = (business) => {
    const city = cityOf(business)
    return (
      <span className='odc-pm-store'>
        <Avatar kind='business' name={business.name || ''} src={logoOf(business)} />
        <span className='odc-pm-store-text'>
          <span className='odc-pm-name' dir='auto' title={business.name}>{business.name}</span>
          {city && <span className='odc-pm-sub' dir='auto' title={city}>{city}</span>}
        </span>
      </span>
    )
  }

  // redesign PM-07: the POS column has a header and a name; no POS is a dash that still says "Not connected"
  const posCell = (business) => {
    const summary = posSummary(business, integrations)
    if (!summary.pos.length) {
      return (
        // redesign PM-R3: a visual dash only; the Status column already says "Not connected"
        <span className='odc-pm-dash' aria-hidden='true'>—</span>
      )
    }
    return (
      <span className='odc-pm-pos-list'>
        {summary.pos.map((pos, index) => (
          <span key={`${pos.id ?? 'pos'}-${index}`} className='odc-pm-pos'>
            <PosLogo src={pos.logo} />
            <span className='odc-pm-pos-name' dir='auto'>{pos.name}</span>
          </span>
        ))}
      </span>
    )
  }

  // redesign SC-03: the POS and Sales channels columns of a sales-channels store: every linked integration of the type, by
  // name (main drew the logos alone and cut them at 5, SC-04). A link that is turned off says so; no link is a dash that a screen reader
  // reads as «Not connected» (there is no Status column here to say it).
  const linkedCell = (business, type) => {
    const linked = linkedIntegrations(business, integrations, type)
    if (!linked.length) {
      return (
        <>
          <span className='odc-pm-dash' aria-hidden='true'>—</span>
          <span className='odc-sr-only'>{t('BUSINESS_POS_STATUS_NOT_CONNECTED', 'Not connected')}</span>
        </>
      )
    }
    const fallback = type === 'pos' ? 'POS' : t('SALES_CHANNELS_UNNAMED', 'Sales channel')
    return (
      <span className='odc-pm-pos-list'>
        {linked.map((item, index) => (
          <span key={`${item.id ?? type}-${index}`} className='odc-pm-pos'>
            <PosLogo src={item.logo} />
            <span className='odc-pm-pos-name' dir='auto'>{item.name || fallback}</span>
            {!item.enabled && <span className='odc-pm-muted'>{t('POS_MENU_STATUS_OFF', 'Turned off')}</span>}
          </span>
        ))}
      </span>
    )
  }

  // redesign PM-01: the status is the real one; no POS is quiet text. (main #390, owner decision D1 = C): the state
  // and its words are main's (posMenuModel.linkSetupState), never the raw setup_status
  const statusCell = (business) => {
    const summary = posSummary(business, integrations)
    if (summary.family == null) {
      return <span className='odc-pm-muted'>{t(summary.statusKey, summary.statusDefault)}</span>
    }
    const { message } = getIntegrationSetupStatus(summary.link, t)
    const date = summary.link?.setup_status_updated_at ? parseDate(summary.link.setup_status_updated_at) : null
    return (
      <span className='odc-pm-status'>
        <span className='odc-pm-status-line'>
          <Status family={summary.family} label={t(summary.statusKey, summary.statusDefault)} wrap />
          {/* review r1: only a catalog entry that carries its plugin says the plugin's state */}
          <SetupWarning warning={summary.integration?.plugin ? getIntegrationSetupWarning(summary.link, summary.integration, t) : null} />
        </span>
        {message && <span className='odc-pm-sub' dir='auto'>{message}</span>}
        {date && <span className='odc-pm-sub odc-figure'>{date}</span>}
      </span>
    )
  }

  // main #394: the one action of a row, only to fix a failed or pending connection, never a Calendly setup for a non-administrator
  const fixAction = (business) => {
    if (isSalesChannel || isImporter) return null
    const summary = posSummary(business, integrations)
    if (!summary.link) return null
    const action = getIntegrationSetupAction(summary.link, summary.integration, t)
    const plugin = summary.integration?.plugin
    if (action?.kind !== 'fix' || isPluginLinkRestricted(plugin, action.path, { isAdmin: user?.level === 0, kind })) return null
    return {
      label: action.label,
      open: () => {
        setFrameStoreId(business.id)
        return showPluginPage(plugin, 'setup', { businessId: business.id })
      }
    }
  }
  const actionCell = (business) => {
    const action = fixAction(business)
    if (!action) return null
    return (
      <Button size='sm' aria-label={`${action.label} · ${business.name}`} onClick={action.open}>{action.label}</Button>
    )
  }

  const idCell = (business) => <bdi dir='ltr' className='odc-figure'>{business.id}</bdi>

  const labels = {
    id: t('ID', 'ID'),
    business: t('BUSINESS', 'Business'),
    // `POS` already exists in the dictionary as «Pos»: this header is the acronym
    pos: t('POS_MENU_COLUMN_POS', 'POS'),
    status: t('STATUS', 'Status'),
    sales_channels: t('SALES_CHANNELS_TITLE', 'Sales channels')
  }

  const DEFINITIONS = {
    id: { header: labels.id, locked: false, skeleton: { lines: 1 }, cell: idCell },
    business: { header: labels.business, rowHeader: true, wrap: true, skeleton: { lines: 2, lead: 'business' }, cell: storeCell },
    pos: { header: labels.pos, wrap: true, skeleton: { lines: 1 }, cell: isSalesChannel ? business => linkedCell(business, 'pos') : posCell },
    status: { header: labels.status, skeleton: { lines: 1, lead: 'dot' }, cell: statusCell },
    sales_channels: { header: labels.sales_channels, wrap: true, skeleton: { lines: 1 }, cell: business => linkedCell(business, 'sales_channel') }
  }
  // redesign IM-A: the table of an importers page does not talk about POS
  const tableLabel = isImporter
    ? t('IMPORTERS_TABLE_LABEL', 'Stores')
    : isSalesChannel
      ? t('SALES_CHANNELS_STORES_TABLE', 'Stores and their sales channels')
      : t('POS_MENU_STORES_TABLE', 'Stores and their POS')

  // The plugin page a fix action opened; closing it reads the list again (the plugin reports to the API, not to this page)
  const pluginFrame = (
    <PluginFrameDialog
      frame={frame}
      businessId={frameStoreId}
      onClose={() => setFrame(previous => ({ ...previous, open: false }))}
      onReload={onReload}
    />
  )

  // ---- the states that are not rows ----
  const loadingLabel = t('POS_MENU_LOADING_STORES', 'Loading stores')

  const emptyState = () => {
    if (term) {
      return (
        <EmptyState
          icon={Search}
          title={fill(t('CONNECT_BUSINESS_SEARCH_NO_RESULTS', 'No businesses found for "{{term}}". Try another name, email, or phone.'), '{{term}}', term)}
          action={<Button onClick={() => onClearSearch?.()}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={Store}
        title={activeState
          ? t('CONNECT_BUSINESS_LIST_EMPTY_ACTIVE', 'No active businesses to show.')
          : t('CONNECT_BUSINESS_LIST_EMPTY_INACTIVE', 'No inactive businesses to show.')}
      />
    )
  }

  // redesign PM-15: `main` left an empty table when the list failed; a failure now takes the place of the list
  // review r1: a plugin page a row opened stays open when the reload it asked for fails
  if (!isLoading && hasError(error)) {
    return (
      <>
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={translateApiMessage(t, firstMessage(error), t('POS_MENU_STORES_ERROR', 'The stores could not be loaded.'))}
          action={<Button onClick={() => onRetry?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
        />
        {pluginFrame}
      </>
    )
  }

  // ---- phone (PM-08): one card per store; nothing sideways ----
  if (isPhone) {
    const toCard = (business) => {
      const summary = posSummary(business, integrations)
      // redesign SC-B: a sales-channels store has no Status; its line names the channels, then «POS: …» if it has one, then the city
      const posNames = linkedIntegrations(business, integrations, 'pos').map(item => item.name || 'POS').join(', ')
      const channelNames = linkedIntegrations(business, integrations, 'sales_channel')
        .map(item => item.name || t('SALES_CHANNELS_UNNAMED', 'Sales channel'))
        .join(', ')
      // redesign SC-R1-2: a store on no channel says so, as the dash of the table column does
      // redesign IM-A: an importers store has neither POS nor channels in its line: the city alone
      const parts = isImporter
        ? [cityOf(business)]
        : isSalesChannel
          ? [channelNames || t('SALES_CHANNELS_NONE', 'No sales channels'), posNames && `${t('POS_MENU_COLUMN_POS', 'POS')}: ${posNames}`, cityOf(business)]
          : [summary.pos.map(pos => pos.name).join(', '), cityOf(business)]
      const line = parts.filter(Boolean).join(' · ')
      return {
        id: business.id,
        href: hrefFor(business.id),
        label: fill(t('POS_MENU_OPEN_STORE', 'Open _name_'), '_name_', business.name),
        title: <span className='odc-pm-name' dir='auto'>{business.name}</span>,
        status: isSalesChannel || !showCardStatus ? undefined : statusCell(business),
        from: (
          <span className='odc-pm-store'>
            <Avatar kind='business' name={business.name || ''} src={logoOf(business)} />
            <span className='odc-pm-sub odc-pm-card-sub' dir='auto'>{line}</span>
          </span>
        ),
        active: openId != null && openId === business.id,
        onOpen: () => onOpenBusiness?.(business),
        // main #394: the fix action of the row, under the card (it never opens the store)
        actions: actionCell(business) || undefined
      }
    }
    return (
      <div className='odc-pm-cards'>
        <RecordCardList
          label={tableLabel}
          items={isLoading ? [] : rows.map(toCard)}
          loading={isLoading}
          loadingLabel={loadingLabel}
          skeletonCount={SKELETON_ROWS}
          empty={emptyState()}
        >
          {pluginFrame}
        </RecordCardList>
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const tableColumns = [
    ...columns
      .filter(column => column.visible)
      .map(({ id }) => ({ id, ...DEFINITIONS[id] })),
    // redesign PM-16: on the Inactive tab `main` drew the header and no cell; now the cell has the reason
    ...(!activeState
      ? [{
          id: 'disabledReason',
          header: t('DISABLED_REASON', 'Disabled reason'),
          wrap: true,
          skeleton: { lines: 1 },
          // redesign SC-R1-3: no reason is the same dash as an empty POS cell
          cell: business => (business.disabled_reason
            ? <span className='odc-pm-reason' dir='auto'>{business.disabled_reason}</span>
            : <span className='odc-pm-dash' aria-hidden='true'>—</span>)
        }]
      : []),
    // main #394: one action per row, only when a POS connection needs fixing (no column for sales channels nor importers)
    ...(!isSalesChannel && !isImporter && rows.some(business => fixAction(business))
      ? [{ id: 'fixAction', header: t('ACTIONS', 'Actions'), skeleton: { lines: 1 }, cell: actionCell }]
      : [])
  ]

  return (
    <>
      {showColumnManager && (
        <div className='odc-pm-tools'>
          <ColumnManager
            columns={columns.map(({ id, visible }) => ({ id, label: labels[id], visible, locked: lockedColumns.includes(id) }))}
            onChange={next => setColumns(next.map(({ id, visible }) => ({ id, visible })))}
            onReset={() => setColumns(defaultColumns(kindColumns))}
            triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
            title={t('MANAGE_COLUMNS', 'Manage columns')}
            resetLabel={t('COLUMNS_RESET', 'Reset')}
            lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
            widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
            moveUpLabel={label => fill(t('MOVE_COLUMN_UP', 'Move _column_ up'), '_column_', label)}
            moveDownLabel={label => fill(t('MOVE_COLUMN_DOWN', 'Move _column_ down'), '_column_', label)}
          />
        </div>
      )}
      <div className='odc-pm-table'>
        <DataTable
          label={tableLabel}
          columns={tableColumns}
          rows={rows}
          getRowId={business => business.id}
          activeRowId={openId}
          onOpenRow={business => onOpenBusiness?.(business)}
          loading={isLoading}
          loadingLabel={loadingLabel}
          skeletonRows={SKELETON_ROWS}
          empty={emptyState()}
        />
      </div>
      {pluginFrame}
    </>
  )
}
