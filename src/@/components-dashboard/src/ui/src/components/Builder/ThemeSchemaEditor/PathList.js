import React from 'react'

import { formatText, labelOf, splitPath } from './schemaNodes'

/** Paths of the theme or the settings, each by its name, with what the API says of it (`code`), as a list to read. */
export const PathList = ({ t, schema, items }) => (
  <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
    {items.map(({ path, code }) => (
      <li key={path}>
        {formatText(t, labelOf(schema, splitPath(path)), { fallback: splitPath(path).pop() })} <code>{path}</code>{code ? ` · ${code}` : ''}
      </li>
    ))}
  </ul>
)
