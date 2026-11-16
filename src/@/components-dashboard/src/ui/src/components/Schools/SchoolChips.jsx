import React from 'react'

import { useLanguage } from '../../../../index'
import { allergenLabel, dietaryLabel } from './schoolDisplay'
import './schools.css'

// redesign SC-B1 (M-SC05): allergens and dietary tags as words (`Gluten free`, not `gluten_free`). Allergens carry the attention tone
// (a status tone of the brand, not a new color); dietary tags are neutral.
//
// @param {'allergen'|'dietary'} props.kind
// @param {string[]}             [props.values]      The raw catalog values.
// @param {string}               [props.emptyLabel]  What shows (muted, no list) when there are no values.
// @param {string}               props.label         The accessible name of the list.
export const SchoolChips = ({ kind, values, emptyLabel = '—', label }) => {
  const [, t] = useLanguage()
  const list = Array.isArray(values) ? values : []
  if (list.length === 0) return <span className='odc-school-chip-empty'>{emptyLabel}</span>
  const wording = kind === 'allergen' ? allergenLabel : dietaryLabel
  return (
    <ul className='odc-school-chips' aria-label={label}>
      {list.map((value) => (
        <li key={value} className='odc-school-chip' data-tone={kind === 'allergen' ? 'warning' : undefined}>
          {wording(t, value)}
        </li>
      ))}
    </ul>
  )
}
