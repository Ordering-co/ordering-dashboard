import React from 'react'

import { Info } from '../Icon'
import { CopyButton } from './CopyButton'
import { InlineNotice } from './FilterBar'
import { cx } from './classNames'
import './product.css'
import './project-code.css'

// redesign F2 (N-SU2): the note «a sentence, the project code and Copy» that /support and /free-downloads each wrote on
// their own. The piece has no text: the sentence, the label of the code and the four words of Copy all come from the page.

const COPY_WORDS = ['label', 'copyLabel', 'copiedLabel', 'failedLabel']

/**
 * ProjectCode: a static info note with a sentence (`note`) and, when `project` is known, the code (`codeLabel` + the code as
 * left-to-right text in a mono chip) and a small CopyButton in the action of the notice. Without `project` only the sentence shows.
 *
 * It is a note, not a live region (nothing in it changes by itself, so nothing is announced). `copy` carries the words of
 * P/CopyButton, all required: `{ label, copyLabel, copiedLabel, failedLabel }`. `className` and every other prop go to the notice.
 */
export const ProjectCode = ({ note, project, codeLabel, copy, className, ...props }) => {
  if (note == null) throw new Error('ProjectCode needs a note: the sentence of the page')
  if (codeLabel == null) throw new Error('ProjectCode needs a codeLabel')
  for (const word of COPY_WORDS) {
    if (copy?.[word] == null) throw new Error(`ProjectCode needs copy.${word}`)
  }
  return (
    <InlineNotice
      {...props}
      tone='info'
      icon={Info}
      live={false}
      className={cx('odc-project-code', className)}
      action={project
        ? (
          <CopyButton
            text={project}
            label={copy.label}
            copyLabel={copy.copyLabel}
            copiedLabel={copy.copiedLabel}
            failedLabel={copy.failedLabel}
            size='sm'
          />
          )
        : undefined}
    >
      <span>{note}</span>
      {project && (
        <span className='odc-project-code-value'>
          <span className='odc-project-code-label'>{codeLabel}</span>
          <code className='odc-project-code-code'><bdi dir='ltr'>{project}</bdi></code>
        </span>
      )}
    </InlineNotice>
  )
}
