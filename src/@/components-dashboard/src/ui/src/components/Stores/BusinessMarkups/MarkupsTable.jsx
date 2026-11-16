import React, { useId } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { AsyncSwitch, Checkbox, DataTable, RecordCardList } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import './business-markups.css'

// redesign stores 5.13 (E3b): the list of the markups of a store as a Product DataTable (RecordCards under 768px, as the
// stores list and the customer fees). It draws what the controller gives and fetches nothing. Columns: ID, Name (a native button
// that opens the markup), Applies to (site · delivery type), Rule (what it adds to products and, always, to suboptions;
// S-7: all of it from the data the list already has) and Status, a switch that saves at once (P/AsyncSwitch: it goes back and says
// why when the save fails).
// A global markup (S-6) is the one of every store: it has no name button, no checkbox and its switch is off with the reason said
// to a screen reader; a click or Enter on its row opens nothing. The note above the table says where to edit it.

const SKELETON_ROWS = 5

// redesign the ids of the table's columns, in their default order (the host keeps the order and the visibility)
export const MARKUP_COLUMN_IDS = ['id', 'name', 'store', 'applies', 'rule', 'status']
const FIXED_COLUMN_IDS = ['id', 'name']

// The definitions in the order of `chosen`, only the visible ones. ID and Name are fixed: they are painted even when `chosen` hides
// or leaves them out (then in front, ID first). An id with no definition (unknown, or `store` without `storeOf`) is ignored.
const chooseColumns = (definitions, chosen) => {
  const byId = new Map(definitions.map(definition => [definition.id, definition]))
  const wanted = chosen.filter(column => byId.has(column?.id) && (column.visible || FIXED_COLUMN_IDS.includes(column.id))).map(column => column.id)
  const fixed = FIXED_COLUMN_IDS.filter(id => !wanted.includes(id))
  // redesign (review r1 #2): a column may carry `hideBelow` (P/DataTable: the list's width under which it steps aside)
  const hideBelow = new Map(chosen.filter(column => column?.hideBelow != null).map(column => [column.id, column.hideBelow]))
  return [...fixed, ...wanted].map(id => (hideBelow.has(id) ? { ...byId.get(id), hideBelow: hideBelow.get(id) } : byId.get(id)))
}

const nameLabel = (template, markup) => template.replace('_name_', () => markup?.name ?? '')

// «Suboptions: _value_» with the value as a figure (decision 11: figures keep their direction, the words stay prose)
const fillValue = (template, value) => template.split(/(_value_)/).map((part, index) => (
  part === '_value_' ? <span key={index} className='odc-figure'>{value}</span> : part
))

const hasRule = (rule) => rule != null && rule.markup_value != null && rule.markup_value !== '' && Number.isFinite(Number(rule.markup_value))

/**
 * @param {object}   props
 * @param {Array<object>} props.markups
 * @param {boolean}  props.loading             Skeleton rows (only with no rows to keep on screen).
 * @param {Array}    props.selectedIds         Ids of the selected markups (they outlive the page).
 * @param {Function} props.onToggle            `(id)`: one row.
 * @param {Function} props.onToggleAll         `()`: the selectable rows of the page.
 * @param {*}        [props.activeId]          The markup open in the detail.
 * @param {Function} props.onOpen              `(markup)`: only called for the markups of the store.
 * @param {Function} props.onToggleEnabled     `(markup, next) => Promise<{ ok, error? }>`: the switch.
 * @param {Function} props.isGlobal            `(markup) => boolean`: the markup of every store (read-only here).
 * @param {Function} props.appliesTo           `(markup) => string`: «Main site · Delivery».
 * @param {React.ReactNode} [props.empty]      What the table says when a search finds nothing.
 * @param {Function} [props.storeOf]           `(markup) => ReactNode`: adds the «Business» column after Name (and the business in the
 *                                             line of a card). Off by default: the store editor does not pass it.
 * @param {Array<{ id: string, visible: boolean, hideBelow?: number }>} [props.columns] Order and visibility of the columns of the
 *                                             table (not of the cards). ID and Name are always painted; an unknown id is ignored;
 *                                             `hideBelow` is P/DataTable's (the list's width under which the column steps aside). Off by default.
 * @param {Function} [props.onWidthHiddenChange] P/DataTable's: the ids the width hides, once per change (for the column manager).
 */
export const MarkupsTable = ({
  markups,
  loading,
  selectedIds,
  onToggle,
  onToggleAll,
  activeId,
  onOpen,
  onToggleEnabled,
  isGlobal,
  appliesTo,
  empty,
  storeOf,
  columns: chosenColumns,
  onWidthHiddenChange
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const isPhone = useIsPhone()
  const reasonId = useId()

  const formatRule = (rule) => {
    const value = Number(rule.markup_value)
    return rule.markup_type === 'fixed' ? `+${parsePrice(value)}` : `+${value}%`
  }

  const editable = markups.filter(markup => !isGlobal(markup))
  const pageIds = editable.map(markup => markup.id)
  const selectedOnPage = pageIds.filter(id => selectedIds.includes(id))
  const allChecked = !loading && pageIds.length > 0 && selectedOnPage.length === pageIds.length
  const selectLabel = (markup) => nameLabel(t('STORES_SELECT_ROW', 'Select _name_'), markup)
  const openLabel = (markup) => `${markup?.name ?? ''}, ${t('VIEW_DETAILS', 'View details')}`
  const listLabel = t('MARKUPS', 'Markups')
  const loadingLabel = t('MARKUPS_LOADING', 'Loading markups')
  const reasonText = t('GLOBAL_MARKUP_READONLY', 'This is a global markup and cannot be edited from the business settings.')

  // ---- the cells (the table and the cards draw the same ones) ----
  const globalTag = <span className='odc-bm-tag'>{t('GLOBAL', 'Global')}</span>

  const nameCell = (markup) => (
    <span className='odc-bm-namecell'>
      {isGlobal(markup)
        ? (
          <span className='odc-bm-name-line'>
            <span className='odc-bm-name-text' dir='auto' title={markup.name}>{markup.name}</span>
            {globalTag}
          </span>
          )
        : (
          <button type='button' className='odc-bm-name' aria-label={openLabel(markup)} onClick={() => onOpen(markup)}>
            <span className='odc-bm-name-text' dir='auto' title={markup.name}>{markup.name}</span>
          </button>
          )}
    </span>
  )

  const appliesCell = (markup) => <span className='odc-bm-applies' dir='auto'>{appliesTo(markup)}</span>

  const ruleCell = (markup) => {
    const products = markup?.rules?.products
    if (!hasRule(products)) return <span className='odc-bm-none'>-</span>
    const suboptions = markup?.rules?.suboptions
    // always said, so the column never leaves a doubt: the rule of the suboptions (the same one as the products' when they match) or none
    const second = hasRule(suboptions) && Number(suboptions.markup_value) !== 0
      ? fillValue(t('MARKUP_SUBOPTIONS_RULE', 'Suboptions: _value_'), formatRule(suboptions))
      : t('MARKUP_SUBOPTIONS_NONE', 'Suboptions: none')
    return (
      <span className='odc-bm-rule'>
        <span className='odc-figure'>{formatRule(products)}</span>
        <span className='odc-bm-sub'>{second}</span>
      </span>
    )
  }

  // The switch of a row: a click on it is its own, never the row's. The global one is off and says why.
  const statusCell = (markup) => {
    const global = isGlobal(markup)
    const describedBy = global ? `${reasonId}-${markup.id}` : undefined
    return (
      <span className='odc-bm-control' data-odc-no-open=''>
        <AsyncSwitch
          checked={Boolean(markup.enabled)}
          label={nameLabel(t('MARKUP_ENABLED_NAMED', 'Enabled: _name_'), markup)}
          failureText={t('MARKUP_ENABLE_FAILED', "We couldn't change this markup.")}
          disabled={global}
          aria-describedby={describedBy}
          onToggle={(next) => onToggleEnabled(markup, next)}
        />
        {global && <span id={describedBy} className='odc-sr-only'>{reasonText}</span>}
      </span>
    )
  }

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (markup) => {
      const global = isGlobal(markup)
      return {
        id: markup.id,
        // a global card opens nothing: no address, so it is not a link and not a tab stop
        href: global ? undefined : '#', // the card is a link for the keyboard and the screen reader; a plain click opens the detail
        label: openLabel(markup),
        title: <span className='odc-bm-name-text' dir='auto'>{markup.name}</span>,
        status: global ? globalTag : null,
        from: (
          <span className='odc-bm-sub'>
            {t('ID', 'ID')} <bdi dir='ltr' className='odc-figure'>{markup.id}</bdi>
            {/* redesign «ID 331 · business · applies to» when the host gives the business */}
            {storeOf ? <> · <bdi dir='auto'>{storeOf(markup)}</bdi></> : null}
            {` · ${appliesTo(markup)}`}
          </span>
        ),
        indicator: ruleCell(markup),
        active: activeId != null && String(activeId) === String(markup.id),
        actions: (
          <div className='odc-bm-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            {global
              ? <span aria-hidden='true' />
              : <Checkbox label={selectLabel(markup)} checked={selectedIds.includes(markup.id)} onCheckedChange={() => onToggle(markup.id)} />}
            {statusCell(markup)}
          </div>
        ),
        onOpen: () => { if (!global) onOpen(markup) }
      }
    }
    return (
      <RecordCardList
        label={listLabel}
        items={loading ? [] : markups.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={SKELETON_ROWS}
        empty={empty}
        selectAll={pageIds.length > 0
          ? {
              label: t('SELECT_ALL', 'Select all'),
              checked: allChecked ? true : (selectedOnPage.length > 0 ? 'mixed' : false),
              onToggle: onToggleAll
            }
          : undefined}
      />
    )
  }

  const definitions = [
    { id: 'id', header: t('ID', 'ID'), align: 'end', skeleton: { lines: 1 }, cell: markup => <bdi dir='ltr' className='odc-figure'>{markup.id}</bdi> },
    { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, skeleton: { lines: 1 }, cell: nameCell },
    // redesign the business of the markup, only when the host says how to name it (the project page; the store editor does not)
    ...(storeOf ? [{ id: 'store', header: t('BUSINESS', 'Business'), wrap: true, skeleton: { lines: 1 }, cell: markup => <span dir='auto'>{storeOf(markup)}</span> }] : []),
    { id: 'applies', header: t('APPLIES_TO', 'Applies to'), wrap: true, skeleton: { lines: 1 }, cell: appliesCell },
    // redesign tanda AB (S-3): the rule is a figure («+10%», «+$2.00»), aligned to the end
    { id: 'rule', header: t('MARKUP_RULE', 'Rule'), align: 'end', skeleton: { lines: 2 }, cell: ruleCell },
    { id: 'status', header: t('STATUS', 'Status'), skeleton: { lines: 1 }, cell: statusCell }
  ]
  // redesign `columns` gives the order and what is visible; an id it does not know is ignored, and ID and Name are always there
  const columns = chosenColumns ? chooseColumns(definitions, chosenColumns) : definitions

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      onWidthHiddenChange={onWidthHiddenChange}
      rows={markups}
      getRowId={markup => markup.id}
      selection={{
        selectedIds,
        onToggle: id => onToggle(id),
        onToggleAll,
        allLabel: t('SELECT_ALL', 'Select all'),
        rowLabel: selectLabel,
        isSelectable: markup => !isGlobal(markup)
      }}
      activeRowId={activeId != null ? markups.find(markup => String(markup.id) === String(activeId))?.id : undefined}
      onOpenRow={(markup) => { if (!isGlobal(markup)) onOpen(markup) }}
      getRowAttributes={markup => (isGlobal(markup) ? { 'data-odc-bm-global': '' } : { 'data-section-split-key': markup.id })}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={SKELETON_ROWS}
      scrollLabel={t('MARKUPS_TABLE_SCROLL_REGION', 'Markups table, scrolls sideways')}
      empty={empty}
    />
  )
}
