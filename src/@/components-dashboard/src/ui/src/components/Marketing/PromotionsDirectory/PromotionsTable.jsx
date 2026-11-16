import React, { useId, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  AsyncSwitch,
  Button,
  ColumnManager,
  DataTable,
  EmptyState,
  IconButton,
  Menu,
  Pagination,
  RecordCardList,
  Status,
  cx
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Ellipsis, FilterX, GripVertical, Image as ImageIcon, Inbox, Pencil, Trash2, TriangleAlert } from '../../Shared/Icon'
import {
  isPromotionEnabled,
  promotionAppliesLabel,
  promotionBenefit,
  promotionDates,
  promotionStatus,
  promotionStatusKey,
  promotionTargetLabel,
  sortByRank
} from './promotionData'
import { createSummaryDateFormatter, formatDescriptionStamps } from '../PromotionJourneysListing/journeyUtils'
import './promotions-table.css'

// redesign PE-B1 (decisions 3, 4, 8, 9, 10; PE-01, PE-02, PE-04, PE-05, PE-09, PE-17): the promotions list as a Product DataTable (and
// RecordCards under 768px), used by BOTH views. It draws what the host gives (`promotions`, `pagination`, the open record, the handlers)
// and fetches nothing and owns no dialog. What changes against `main`: a status in words (Active, Scheduled, Ended, Off) worked out from
// the switch and the dates, the benefit with its figures, dates in the project's format (never ISO), an enable switch that does not
// lie when the save fails, «Delete» in the row (a menu in Advanced, a visible button in Quick), a list that can fail and retry.

const DEFAULT_PAGE_SIZE = 10
const SKELETON_ROWS = 10
// The columns the person can hide or reorder in Advanced: main let hide «Promotion types», «How?», «Date Range» and the enable column
const MANAGED = ['promotion', 'status', 'benefit', 'type', 'applies', 'dates', 'enabled']
const LOCKED = ['promotion']

const defaultColumns = () => MANAGED.map(id => ({ id, visible: true }))

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const figureOf = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// The card is a link, as the order cards are: a middle click works; a plain click goes through `onOpen`. Advanced addresses the open
// record with `?id=`; Quick has no address for its builder, so its card points at the page it is on.
const hrefFor = (id, withId) => {
  if (typeof window === 'undefined') return withId ? `?id=${id}` : '?'
  const params = new URLSearchParams(window.location.search)
  if (withId) params.set('id', id)
  return `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

// `$` in a replacement is special for String.replace: a function keeps the name as it is
const named = (template, name) => template.replace('_name_', () => name)

export const PromotionsTable = ({
  variant = 'advanced',
  promotions = [],
  loading = false,
  error = null,
  onRetry,
  activeId,
  onOpen,
  onToggle,
  onDelete,
  drag,
  pagination,
  searchValue = '',
  onClearSearch,
  emptyAction,
  hiddenColumnIds,
  onColumnsChange,
  toolbar,
  busyId
}) => {
  const [, t] = useLanguage()
  const [{ parseDate, parsePrice, optimizeImage }] = useUtils()
  const isPhone = useIsPhone()
  const advanced = variant !== 'quick'
  // the column manager's state is local, as today (no persistence); a host that gives `hiddenColumnIds` decides what is hidden
  const [columns, setColumns] = useState(defaultColumns)
  const noteBase = useId() // ids of the «Ended» lines the cards' switches are described by

  // redesign PE-B1 (PE-08, inventory D16): the rows are drawn in the order of their priority, in a NEW array (main sorted its state in render)
  const rows = sortByRank(promotions)
  const now = new Date()
  const hasSearch = String(searchValue ?? '').trim() !== ''
  const total = pagination?.total != null && Number.isFinite(Number(pagination.total)) ? Number(pagination.total) : null
  const pageSize = Number(pagination?.pageSize) || DEFAULT_PAGE_SIZE
  const currentPage = Number(pagination?.page) || 1

  // ---- the cells (the table and the cards draw the same ones) ----
  const noneNode = <span className='odc-promo-muted'>—</span>

  // (G4, tanda AK): the id of a row's status, which describes the switch of an Ended row in the table
  const statusIdOf = (promotion) => `${noteBase}-status-${promotion.id}`
  const statusNode = (promotion) => {
    const status = promotionStatus(promotion, t, now)
    return <Status id={statusIdOf(promotion)} family={status.family} label={status.label} className='odc-promo-status-label' />
  }

  const benefitNode = (promotion) => {
    const parts = promotionBenefit(promotion, { t, parsePrice })
    if (parts.length === 0) return noneNode
    return (
      <span className='odc-promo-benefit'>
        {parts.map((part, index) => (
          <React.Fragment key={index}>{'figure' in part ? figureOf(part.figure) : part.text}</React.Fragment>
        ))}
      </span>
    )
  }

  const typeNode = (promotion) => promotionTargetLabel(promotion.target, t)

  const appliesNode = (promotion) => (
    <span className='odc-promo-applies'>
      {promotionAppliesLabel(promotion, t)}
      {promotion.type === 2 && promotion.coupon && (
        <>{' '}<span className='odc-promo-code odc-mono' dir='ltr'>{promotion.coupon}</span></>
      )}
    </span>
  )

  const datesNode = (promotion) => {
    const { start, end } = promotionDates(promotion, parseDate)
    const noEnd = <span className='odc-promo-muted'>{t('PROMOTION_NO_END_DATE', 'No end date')}</span>
    if (!start && !end) return noEnd
    return (
      <span className='odc-promo-dates'>
        {start ? figureOf(start) : '—'}{' – '}{end ? figureOf(end) : noEnd}
      </span>
    )
  }

  const imageNode = (promotion) => (promotion.image
    ? <img className='odc-promo-image' src={optimizeImage(promotion.image, 'h_50,c_limit')} alt='' />
    : <span className='odc-promo-image odc-promo-image-empty' aria-hidden='true'><ImageIcon className='odc-icon' /></span>)

  // descriptions saved by an older version carry raw stamps; they are written as dates here (the stored text is not touched)
  const summaryDate = createSummaryDateFormatter(parseDate)
  const descriptionOf = (promotion) => formatDescriptionStamps(promotion.description, summaryDate) || t('NO_DESCRIPTION', 'No description')

  const nameNode = (promotion) => (
    <span className='odc-promo-name'>
      {advanced && imageNode(promotion)}
      <span className='odc-promo-name-text'>
        <span className='odc-promo-name-main' dir='auto' title={promotion.name}>{promotion.name}</span>
        {!advanced && (
          <span className='odc-promo-name-sub' dir='auto' title={descriptionOf(promotion)}>{descriptionOf(promotion)}</span>
        )}
      </span>
    </span>
  )

  // The switch saves at once and does not lie when the save fails (decision 4): AsyncSwitch shows the stored value again and says why.
  // (G4, tanda AK, coordinator option a): an Ended row keeps its switch on; the «Ended» of its Status cell describes it,
  // with nothing new on screen (the line «no longer applies» stays for the cards, which have no column header: AC-9)
  const switchNode = (promotion) => (
    <span className='odc-promo-control' data-odc-no-open=''>
      <AsyncSwitch
        checked={isPromotionEnabled(promotion.enabled)}
        onToggle={next => onToggle?.(promotion, next)}
        aria-describedby={promotionStatusKey(promotion, now) === 'ended' ? statusIdOf(promotion) : undefined}
        label={`${t('ENABLE', 'Enable')} ${promotion.name ?? ''}`.trim()}
        failureText={t('PROMOTION_TOGGLE_FAILED', "We couldn't change this promotion. Try again.")}
      />
    </span>
  )

  // redesign AC-D (G7): on a card the switch has no column header above it, so it says what it is in visible text
  // («Enable», the word of the table's header); its accessible name stays «Enable <name>», which contains that word. An Ended
  // promotion keeps its switch (on, working) and says in a line of its own, which also describes the switch, what it means.
  const cardSwitchNode = (promotion) => {
    const ended = promotionStatusKey(promotion, now) === 'ended'
    const noteId = `${noteBase}-ended-${promotion.id}`
    return (
      <span className='odc-promo-control odc-promo-card-switch' data-odc-no-open=''>
        <AsyncSwitch
          checked={isPromotionEnabled(promotion.enabled)}
          onToggle={next => onToggle?.(promotion, next)}
          aria-label={`${t('ENABLE', 'Enable')} ${promotion.name ?? ''}`.trim()}
          aria-describedby={ended ? noteId : undefined}
          failureText={t('PROMOTION_TOGGLE_FAILED', "We couldn't change this promotion. Try again.")}
        >
          {t('ENABLE', 'Enable')}
        </AsyncSwitch>
        {ended && <span id={noteId} className='odc-promo-card-note'>{t('PROMOTION_ENDED_NOTE', 'Ended · no longer applies')}</span>}
      </span>
    )
  }

  // Advanced: «Delete» in the row (decision 9). The menu is portaled: its clicks still bubble through React, and none may open the row.
  const menuNode = (promotion) => (
    <span className='odc-promo-control' data-odc-no-open='' data-card-actions='' onClick={event => event.stopPropagation()}>
      <Menu
        icon={Ellipsis}
        label={named(t('PROMOTION_ROW_ACTIONS', 'Actions for _name_'), promotion.name ?? '')}
        items={[{ key: 'delete', label: t('DELETE', 'Delete'), icon: Trash2, tone: 'danger', onSelect: () => onDelete?.(promotion) }]}
      />
    </span>
  )

  // redesign (row 81, review r1 R8): as in main, the Delete of a row is off while that row's switch is saving (or it is being deleted)
  const isBusy = (promotion) => busyId != null && busyId !== '' && String(busyId) === String(promotion.id)

  // Quick: «Edit promotion» and a VISIBLE «Delete», two clicks as today, named after the promotion (PJ:880-887)
  // redesign PE-B4 (live check): in the table the two actions are icon buttons (named, with a tooltip) so the row fits 1280-1440
  // without pushing them out of the screen; the cards keep the worded buttons
  const quickTableActionsNode = (promotion) => (
    <span className='odc-promo-actions' data-odc-no-open=''>
      <IconButton icon={Pencil} label={t('EDIT_PROMOTION', 'Edit promotion')} onClick={() => onOpen?.(promotion)} />
      <IconButton icon={Trash2} label={`${t('DELETE', 'Delete')} ${promotion.name ?? ''}`.trim()} disabled={isBusy(promotion)} onClick={() => onDelete?.(promotion)} />
    </span>
  )

  const quickActionsNode = (promotion) => (
    <span className='odc-promo-actions' data-odc-no-open=''>
      <Button variant='link' onClick={() => onOpen?.(promotion)}>{t('EDIT_PROMOTION', 'Edit promotion')}</Button>
      <Button
        variant='ghost'
        icon={Trash2}
        aria-label={`${t('DELETE', 'Delete')} ${promotion.name ?? ''}`.trim()}
        disabled={isBusy(promotion)}
        onClick={() => onDelete?.(promotion)}
      >
        {t('DELETE', 'Delete')}
      </Button>
    </span>
  )

  // ---- the states that are not rows ----
  const loadingLabel = t('PROMOTIONS_LOADING', 'Loading promotions')
  const listLabel = t('PROMOTIONS', 'Promotions')

  const emptyState = () => {
    if (hasSearch) {
      return (
        <EmptyState
          icon={FilterX}
          title={t('PROMOTIONS_NO_MATCH', 'No promotions match your search')}
          action={<Button onClick={() => onClearSearch?.()}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )
    }
    if (!advanced) return <EmptyState icon={Inbox} title={t('NO_PROMOTIONS', 'No promotions yet. Choose a template to create your first draft.')} />
    return <EmptyState icon={Inbox} title={t('PROMOTIONS_EMPTY', 'No promotions yet')} action={emptyAction} />
  }

  // A failure takes the place of the list, with the way to try again (PE-15: today it kills the page until reload)
  if (!loading && hasError(error)) {
    return (
      <>
        {/* redesign (row 81, review r1 R9): the host's search stays in view, so a search that failed can be changed and not only retried */}
        {toolbar && <div className='odc-promo-tools'>{toolbar}</div>}
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('PROMOTIONS_LOAD_ERROR', "We couldn't load promotions.")}
          description={errorText(t, error)}
          action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
        />
      </>
    )
  }

  // ---- the foot: the pages; nothing when there are no rows ----
  const showFoot = total != null ? total > 0 : rows.length > 0
  const foot = showFoot && (
    <div className='odc-promo-foot'>
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total ?? undefined}
        itemCount={rows.length}
        pageSizeOptions={pagination?.pageSizeOptions}
        onPageChange={page => pagination?.onPageChange?.(page)}
        onPageSizeChange={(size, page) => pagination?.onPageSizeChange?.(size, page)}
        busy={loading}
        showPageInput
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(totalPages, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figure)}
        rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
        pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
      />
    </div>
  )

  // ---- phone: the same data as cards; no drag (touch cannot drag, as today) ----
  if (isPhone) {
    const toCard = (promotion) => {
      const name = promotion.name ?? ''
      const description = descriptionOf(promotion)
      return {
        id: promotion.id,
        href: hrefFor(promotion.id, advanced),
        label: `${t('OPEN', 'Open')} ${name}`.trim(),
        title: <span className='odc-promo-card-name' dir='auto'>{name}</span>,
        status: statusNode(promotion),
        // Advanced: what it discounts and how it is applied; Quick: the description, today's main datum on the card (one line)
        from: advanced
          ? <span className='odc-promo-card-text'>{typeNode(promotion)}{' · '}{appliesNode(promotion)}</span>
          : <span className='odc-promo-card-text odc-promo-name-sub' dir='auto' title={description}>{description}</span>,
        indicator: advanced ? undefined : <span className='odc-promo-card-text'>{appliesNode(promotion)}</span>,
        schedule: [datesNode(promotion)],
        figure: benefitNode(promotion),
        actions: (
          <div className='odc-promo-card-actions' data-card-actions=''>
            {cardSwitchNode(promotion)}
            {advanced ? menuNode(promotion) : quickActionsNode(promotion)}
          </div>
        ),
        active: activeId != null && String(activeId) === String(promotion.id),
        onOpen: () => onOpen?.(promotion)
      }
    }
    return (
      <div className='odc-promo-cards' data-variant={variant}>
        {/* redesign PE-B2 (live check): the host's search on the phone too */}
        {toolbar && <div className='odc-promo-tools'>{toolbar}</div>}
        <RecordCardList
          label={listLabel}
          items={loading ? [] : rows.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={SKELETON_ROWS}
          empty={emptyState()}
        />
        {foot}
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const effective = columns.map(column => (
    Array.isArray(hiddenColumnIds) ? { ...column, visible: !hiddenColumnIds.includes(column.id) } : column
  ))
  const labels = {
    promotion: t('PROMOTION', 'Promotion'),
    status: t('STATUS', 'Status'),
    benefit: t('PROMOTION_BENEFIT', 'Benefit'),
    type: t('PROMOTION_TYPE', 'Promotion type'),
    applies: t('PROMOTION_APPLIES', 'Applies'),
    dates: t('DATE_RANGE', 'Date range'),
    enabled: t('ENABLE', 'Enable')
  }
  const DEFINITIONS = {
    promotion: {
      header: labels.promotion,
      rowHeader: true,
      wrap: true,
      locked: true,
      // redesign PE-B1 (live check): beside the open panel the name was cut to one letter («B u.»); the column names its floor
      skeleton: { lines: advanced ? 1 : 2, floor: 'var(--od-x-col-floor-promotion)' },
      cell: nameNode
    },
    status: { header: labels.status, skeleton: { lines: 1, lead: 'dot' }, cell: statusNode },
    benefit: { header: labels.benefit, wrap: true, skeleton: { lines: 1, floor: 'var(--od-x-col-floor-promotion-benefit)' }, cell: benefitNode }, // redesign PE-B1 (live check)
    type: { header: labels.type, skeleton: { lines: 1 }, cell: typeNode },
    // redesign AC-D2 (G6, review): it may break between words, so the table gives up width here before the pinned Enable covers a date
    applies: { header: labels.applies, wrap: true, skeleton: { lines: 1 }, cell: appliesNode },
    dates: { header: labels.dates, skeleton: { lines: 1 }, cell: datesNode },
    // redesign AC-D (G6): pinned beside the last column, so its header is never under it (see promotions-table.css)
    enabled: { header: labels.enabled, className: 'odc-promo-col-enabled', skeleton: { lines: 1 }, cell: switchNode }
  }
  // Quick shows its columns as they are (it never had the column manager); Advanced shows the ones the person left on
  const shown = advanced
    ? effective.filter(column => column.visible || LOCKED.includes(column.id))
    : effective.filter(column => column.id !== 'type')
  const tableColumns = shown.map(({ id }) => ({ id, ...DEFINITIONS[id] }))
  if (advanced) {
    tableColumns.unshift({
      id: 'drag',
      srHeader: t('PRIORITY', 'Priority'),
      className: 'odc-promo-col-grip',
      skeleton: { lines: 1 },
      cell: promotion => (
        <span
          className='odc-promo-grip'
          draggable='true'
          aria-hidden='true'
          data-odc-no-open=''
          onDragStart={event => drag?.onDragStart?.(event, promotion)}
        >
          <GripVertical className='odc-icon' />
        </span>
      )
    })
    tableColumns.push({ id: 'menu', srHeader: t('ACTIONS', 'Actions'), className: 'odc-promo-col-menu', skeleton: { lines: 1 }, cell: menuNode })
  } else {
    tableColumns.push({ id: 'actions', srHeader: t('ACTIONS', 'Actions'), className: 'odc-promo-col-actions', skeleton: { lines: 1 }, cell: quickTableActionsNode })
  }

  const managerColumns = effective.map(({ id, visible }) => ({ id, label: labels[id], visible: LOCKED.includes(id) || visible, locked: LOCKED.includes(id) }))
  const hiddenIdsOf = (list) => list.filter(({ id, visible }) => !visible && !LOCKED.includes(id)).map(({ id }) => id)
  // `onColumnsChange(hiddenIds)`: the ids the person hid, the shape of `hiddenColumnIds` the host gives back
  const changeColumns = (next) => {
    setColumns(next.map(({ id, visible }) => ({ id, visible })))
    onColumnsChange?.(hiddenIdsOf(next))
  }
  const resetColumns = () => {
    setColumns(defaultColumns())
    onColumnsChange?.([])
  }

  // The drag is delegated to the container of the table (decision 8): the rows are resolved from the event, and the controller of
  // `main` keeps its handlers (`(event, id, index)` over a row, `(event, record)` on drop). The index is the one of the drawn order.
  const rowHit = (event) => {
    const element = event.target?.closest?.('[data-promotion-id]')
    if (!element) return null
    const id = element.getAttribute('data-promotion-id')
    const index = rows.findIndex(row => String(row.id) === id)
    return index < 0 ? null : { record: rows[index], index }
  }
  const handleDragOver = (event) => {
    const hit = rowHit(event)
    if (hit) drag?.onDragOver?.(event, hit.record.id, hit.index)
  }
  const handleDrop = (event) => {
    const hit = rowHit(event)
    if (hit) drag?.onDrop?.(event, hit.record)
  }

  const activeRow = activeId != null && activeId !== '' ? rows.find(row => String(row.id) === String(activeId)) : undefined

  const rowAttributes = (promotion, index) => {
    if (!advanced) return { 'data-promotion-id': promotion.id }
    return {
      'data-promotion-id': promotion.id,
      // `draggable_promotion` is the class main's controller looks the row up by (`closest('.draggable_promotion')`)
      className: cx(
        'draggable_promotion',
        drag && String(drag.targetId ?? '') === String(promotion.id) && 'odc-promo-drop-target',
        drag?.targetBottom && index === rows.length - 1 && 'odc-promo-drop-bottom'
      )
    }
  }

  return (
    <>
      {(advanced || toolbar) && (
        <div className='odc-promo-tools'>
          {/* redesign PE-B2 (live check): the host's search shares the row with the column manager */}
          {toolbar}
          {advanced && <ColumnManager
            columns={managerColumns}
            onChange={changeColumns}
            onReset={resetColumns}
            triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
            title={t('MANAGE_COLUMNS', 'Manage columns')}
            resetLabel={t('COLUMNS_RESET', 'Reset')}
            lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
            widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
            moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', () => label)}
            moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', () => label)}
          />}
        </div>
      )}
      <div
        className='odc-promo-table'
        data-variant={variant}
        onDragOver={advanced && drag ? handleDragOver : undefined}
        onDrop={advanced && drag ? handleDrop : undefined}
        onDragEnd={advanced && drag ? drag.onDragEnd : undefined}
      >
        <DataTable
          label={listLabel}
          columns={tableColumns}
          rows={rows}
          getRowId={promotion => promotion.id}
          activeRowId={activeRow?.id}
          onOpenRow={promotion => onOpen?.(promotion)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonRows={SKELETON_ROWS}
          empty={emptyState()}
          getRowAttributes={rowAttributes}
        />
      </div>
      {foot}
    </>
  )
}
