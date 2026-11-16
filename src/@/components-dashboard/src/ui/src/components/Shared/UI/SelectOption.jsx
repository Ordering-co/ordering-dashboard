import React from 'react'

import { Avatar } from '../Product/Avatar'
import './select-option.css'

/**
 * Content of a dropdown row (C18): media of 20px (24px on a phone), the label, and the secondary data
 * (assigned orders, a category, an id) as a muted second column at the end, never in parentheses.
 * `media` is `{ kind: 'person' | 'business', name, src }`: a person is round, a business a rounded square;
 * with no picture (or one that fails to load) the initials show. The row itself (height, hover, check
 * mark) belongs to the select that draws the list; this is only what goes inside it.
 */
export const SelectOptionContent = ({ label, media, meta }) => (
  <span className='odc-so'>
    {media && <Avatar kind={media.kind || 'person'} name={media.name ?? (typeof label === 'string' ? label : '')} src={media.src} />}
    <span className='odc-so-label'>{label}</span>
    {meta !== undefined && meta !== null && meta !== '' && <span className='odc-so-meta'>{meta}</span>}
  </span>
)
