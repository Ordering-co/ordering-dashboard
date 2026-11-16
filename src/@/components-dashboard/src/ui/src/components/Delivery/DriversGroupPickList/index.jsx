import React, { useId } from 'react'

import { CircleAlert, Search } from '../../Shared/Icon'
import { Button, Checkbox, EmptyState, SearchField, Skeleton } from '../../Shared/Product'
import './drivers-group-pick-list.css'

/**
 * redesign (AD-4, AD-6): the anatomy of the lists the panel of a delivery group picks from (driver managers, drivers,
 * driver companies, stores, payment methods), in place of main's SearchBar, grey «Select all / Select none» buttons and bare rows.
 * Presentation only: the section keeps its data, filter, selection and save; this draws them.
 *
 * - `legend` names the group (a fieldset), so two lists in one section («Select all» of managers and of drivers) are told apart.
 * - `search`, `onSearch`, `searchLabel`, `clearLabel`, `placeholder`: the search field (P/SearchField); left out, no field.
 * - `onSelectAll`, `onSelectNone`, `selectAllLabel`, `selectNoneLabel`: the two actions of main, same effect.
 * - `status`: a node next to the actions (the stores selected count of D-12), announced politely by its owner.
 * - `message`: a node above the rows (the add form's `selectionError`); `groupProps` go on the fieldset (the add form's
 *   `aria-describedby` and `tabIndex`: the one group the message describes); `listProps` go on the rows' container.
 * - `loading` + `loadingLabel`: skeleton rows; `error` + `errorTitle`: the list could not load; `empty`: nothing to pick from
 *   (`emptyTitle`) or nothing matches the search (`noMatchTitle`, when `search` has text).
 * - `children`: the rows (`DriversGroupPickRow`); `footer`: the pagination.
 */
export const DriversGroupPickList = ({
  legend,
  search,
  onSearch,
  searchLabel,
  clearLabel,
  placeholder,
  onSelectAll,
  onSelectNone,
  selectAllLabel,
  selectNoneLabel,
  actionsDisabled = false,
  status,
  message,
  groupProps,
  listProps,
  loading = false,
  loadingLabel,
  error = false,
  errorTitle,
  empty = false,
  emptyTitle,
  noMatchTitle,
  footer,
  className,
  children
}) => {
  const searching = typeof search === 'string' && search.trim() !== ''
  let body
  if (loading) {
    body = (
      <div className='gpl-skeleton' role='status' aria-busy='true' aria-label={loadingLabel}>
        {[0, 1, 2].map(row => (
          <span key={row} className='gpl-skeleton-row'>
            <Skeleton shape='box' size='var(--od-space-4)' block='var(--od-space-4)' />
            <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
            <Skeleton size='50%' />
          </span>
        ))}
      </div>
    )
  } else if (error) {
    body = <EmptyState tone='error' icon={CircleAlert} title={errorTitle} />
  } else if (empty) {
    body = <EmptyState icon={searching ? Search : undefined} title={searching ? noMatchTitle : emptyTitle} />
  } else {
    body = <ul className='gpl-rows' {...listProps}>{children}</ul>
  }

  return (
    <fieldset className={['gpl-root', className].filter(Boolean).join(' ')} {...groupProps}>
      <legend className='odc-field-label gpl-legend'>{legend}</legend>
      {onSearch && (
        <SearchField
          className='gpl-search'
          value={search ?? ''}
          onChange={value => onSearch(value)}
          label={searchLabel}
          clearLabel={clearLabel}
          placeholder={placeholder}
        />
      )}
      {(onSelectAll || onSelectNone || status) && (
        <div className='gpl-actions'>
          {onSelectAll && <Button size='sm' disabled={actionsDisabled} onClick={onSelectAll}>{selectAllLabel}</Button>}
          {onSelectNone && <Button size='sm' disabled={actionsDisabled} onClick={onSelectNone}>{selectNoneLabel}</Button>}
          {status && <span className='gpl-status'>{status}</span>}
        </div>
      )}
      {message}
      {body}
      {!loading && !error && !empty && footer && <div className='gpl-footer'>{footer}</div>}
    </fieldset>
  )
}

/**
 * One row: the checkbox, an optional medium (P/Avatar), the title and a muted line, and `extra` at the end (the temporary driver
 * of a driver). The title is the checkbox's label: clicking it toggles, as main's <label htmlFor>.
 */
export const DriversGroupPickRow = ({ checked, onCheckedChange, disabled = false, media, title, meta, extra }) => {
  const id = useId()
  const titleId = `${id}-title`
  return (
    <li className='gpl-row' data-disabled={disabled ? '' : undefined}>
      <Checkbox
        id={id}
        checked={Boolean(checked)}
        disabled={disabled}
        aria-labelledby={titleId}
        onCheckedChange={next => onCheckedChange?.(next)}
      />
      {media}
      <span className='gpl-text'>
        <label id={titleId} htmlFor={id} className='gpl-title'>{title}</label>
        {meta && <span className='gpl-meta'>{meta}</span>}
      </span>
      {extra && <span className='gpl-extra'>{extra}</span>}
    </li>
  )
}
