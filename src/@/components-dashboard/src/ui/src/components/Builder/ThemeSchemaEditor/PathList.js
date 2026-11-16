import React from 'react'

import { formatText, labelOf, splitPath } from './schemaNodes'
import './theme-editor.css'

/** Paths of the theme or the settings, each by its name, with what the API says of it (`code`), as a list to read. */
export const PathList = ({ t, schema, items }) => (
  <ul className='odc-te-paths'>
    {items.map(({ path, code }) => (
      <li key={path}>
        {formatText(t, labelOf(schema, splitPath(path)), { fallback: splitPath(path).pop() })} <code>{path}</code>{code ? ` · ${code}` : ''}
      </li>
    ))}
  </ul>
)
