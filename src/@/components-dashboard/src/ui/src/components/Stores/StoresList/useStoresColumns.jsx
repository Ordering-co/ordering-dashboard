import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { useFeaturedRestriction } from '../../../hooks/useFeaturedRestriction'
import { ColumnManager } from '../../Shared/Product'

// redesign stores 3.B: the columns the person chooses on /stores/list. The manager used to sit in a row of its own
// above the table, with nothing else in it; now it is a tool of the filter bar (FilterBar `tools`, as in sketch 01), so the state
// lives here and BusinessesListing hands it to both: the manager in the bar and the table that draws the columns.
// Store, Today, Featured and Ratings can be hidden or moved; Enabled, ID and the actions are always there, as before. The choice is
// not kept across visits (as before).

export const MANAGED_STORE_COLUMNS = Object.freeze(['business', 'today', 'featured', 'ratings'])

export const defaultStoreColumns = () => MANAGED_STORE_COLUMNS.map(id => ({ id, visible: true }))

/**
 * The managed columns this session may see: Featured needs an administrator (`useFeaturedRestriction`, main ), Ratings is
 * not shown on EatStreet.
 */
export const availableStoreColumns = ({ isRestricted = false, isEatstreetProject = false } = {}) => MANAGED_STORE_COLUMNS.filter(id => (
  !(id === 'featured' && isRestricted) && !(id === 'ratings' && isEatstreetProject)
))

/** `{ columns, setColumns }`: the order and visibility of the managed columns, `[{ id, visible }]`. */
export const useStoresColumns = () => {
  const [columns, setColumns] = useState(defaultStoreColumns)
  return { columns, setColumns }
}

/**
 * The manager of the columns, for the `tools` of the stores' FilterBar. It edits only the columns this session may see and keeps the
 * others where they were.
 *
 * @param {object}   props
 * @param {Array<{id: string, visible: boolean}>} props.columns  From `useStoresColumns`.
 * @param {Function} props.setColumns                           From `useStoresColumns`.
 * @param {boolean}  [props.isEatstreetProject]                 No Ratings.
 */
export const StoresColumnsTool = ({ columns, setColumns, isEatstreetProject }) => {
  const [, t] = useLanguage()
  const isRestricted = useFeaturedRestriction()
  const available = availableStoreColumns({ isRestricted, isEatstreetProject })
  const labels = {
    business: t('STORE', 'Store'),
    today: t('TODAY', 'Today'),
    featured: t('FEATURED', 'Featured'),
    ratings: t('RATINGS', 'Ratings')
  }
  const managerColumns = columns.filter(column => available.includes(column.id)).map(({ id, visible }) => ({ id, label: labels[id], visible }))
  const changeColumns = (next) => {
    setColumns([
      ...next.map(({ id, visible }) => ({ id, visible })),
      ...columns.filter(column => !available.includes(column.id))
    ])
  }
  return (
    <ColumnManager
      columns={managerColumns}
      onChange={changeColumns}
      onReset={() => setColumns(defaultStoreColumns())}
      triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
      title={t('MANAGE_COLUMNS', 'Manage columns')}
      resetLabel={t('COLUMNS_RESET', 'Reset')}
      lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
      widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
      moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', label)}
      moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', label)}
    />
  )
}
