import React from 'react'

import { Swatch } from '../BuilderWebTheme/styles'
import { formatColor, parseColor } from './colors'
import { editorOf, formatText, getAt, getIn, humanize, resolveValue } from './schemaNodes'

/** A node the editor shows but doesn't change (`readonly`): the theme may hold it, the API works it out. */
export const isReadOnly = (schema, path) => editorOf(getAt(schema, path)).readonly === true

/**
 * What a read-only node is: the value `resolve` serves at its path (else its
 * own, followed), named by `labels.unset` ("Automatic") while the theme has
 * none of its own. Nothing to edit, reset or send.
 */
export const ReadOnlyValue = ({ ctx, path, label, read }) => {
  const { t, schema } = ctx
  const served = read ? getIn(ctx.resolved, read.themeKeys) : undefined
  const value = served !== undefined && served !== null ? served : resolveValue(ctx, read?.value)
  const unset = editorOf(getAt(schema, path)).labels?.unset
  const color = typeof value === 'string' && parseColor(value) ? formatColor(value) : null
  const name = (read?.value === null || read?.value === undefined) && unset
    ? formatText(t, unset)
    : color || (value === null || value === undefined ? '—' : typeof value === 'object' ? '' : humanize(value))
  return (
    <span role='img' aria-label={`${label}: ${name}${color && name !== color ? ` (${color})` : ''}`} title={color || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, padding: '0 10px', fontSize: 13, color: '#5E6B7D' }}>
      {color && <Swatch color={value} aria-hidden='true' small />}
      <span aria-hidden='true' style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  )
}
