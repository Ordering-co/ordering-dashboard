import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Skeleton } from '../../Shared/Product'
import './occupation-filter.css'

// redesign (B1b, decision 4): the occupation row of the professionals list, main's U/OccupationsFilter as Product buttons:
// «All» and one button per occupation, `aria-pressed`, ONE click (it is not a pill: that would be two). The rows wrap, with no
// sideways drag. It holds no state: `value` is the chosen occupation id (null = all) and `onChange(id | null)` reports each click.
// Nothing is drawn when there are no occupations and they are not loading (main drew nothing either).

const SKELETONS = 3

export const OccupationFilter = ({ label, occupations, loading = false, value = null, onChange }) => {
  const [, t] = useLanguage()
  const list = Array.isArray(occupations) ? occupations : []

  if (loading) {
    return (
      <div className='odc-occ-filter' role='status' aria-busy='true' aria-label={label}>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        {Array.from({ length: SKELETONS }, (_, index) => (
          <Skeleton key={index} size='calc(var(--od-x-control-height) * 3)' block='var(--od-x-control-height)' />
        ))}
      </div>
    )
  }
  if (list.length === 0) return null

  const isAll = value === null || value === undefined
  return (
    <div className='odc-occ-filter' role='group' aria-label={label}>
      <Button aria-pressed={isAll} onClick={() => onChange?.(null)}>{t('ALL', 'All')}</Button>
      {list.map(occupation => (
        <Button
          key={occupation.id}
          aria-pressed={!isAll && String(value) === String(occupation.id)}
          onClick={() => onChange?.(occupation.id)}
        >
          {occupation.name}
        </Button>
      ))}
    </div>
  )
}
