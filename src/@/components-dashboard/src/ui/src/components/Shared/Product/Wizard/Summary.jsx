import React, { useId, useState } from 'react'

import { ChevronDown } from '../../Icon'
import { Button } from '../Button'
import { cx } from '../classNames'
import './wizard.css'

/**
 * Fixed summary of the create-order wizard (batch 5.5): a named region with only what is
 * already chosen; what is missing says `notSetLabel`. Each block with data has an Edit button
 * that goes back to its step (its name is "Edit" + the block label). From 1024px it is a column;
 * below that it sits on top and folds into one line (a disclosure button that peeks the total through `data-total`).
 * All text comes in by props.
 *
 * blocks: [{ id, label, lines: string[] | null, step }]; `total` is the formatted amount or null.
 */
export const Summary = ({
  label,
  blocks,
  total,
  totalLabel,
  editLabel,
  notSetLabel,
  onEdit,
  className
}) => {
  const baseId = useId()
  const bodyId = `${baseId}-body`
  const [open, setOpen] = useState(false)
  return (
    <section className={cx('odc-wizard-summary', className)} aria-label={label} data-open={open ? 'true' : 'false'}>
      <button
        type='button'
        className='odc-wizard-summary-toggle'
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(value => !value)}
      >
        <span className='odc-wizard-summary-title' data-total={total || undefined}>{label}</span>
        <ChevronDown className='odc-icon odc-wizard-summary-chevron' />
      </button>
      <p className='odc-wizard-summary-heading' aria-hidden='true'>{label}</p>
      <div id={bodyId} className='odc-wizard-summary-body'>
        {blocks.map(block => {
          const hasData = Array.isArray(block.lines) && block.lines.length > 0
          return (
            <div key={block.id} className='odc-wizard-block'>
              <div className='odc-wizard-block-head'>
                <span className='odc-wizard-block-label'>{block.label}</span>
                {hasData && (
                  <Button
                    variant='link'
                    size='sm'
                    // redesign W0-2 r2 (W0-Q1-09): the name carries the object, «Edit Customer»; the visible text stays «Edit»
                    aria-label={`${editLabel} ${block.label}`}
                    onClick={() => onEdit?.(block.step)}
                  >
                    {editLabel}
                  </Button>
                )}
              </div>
              {hasData
                ? block.lines.map((line, index) => <p key={`${block.id}-${index}`} className='odc-wizard-block-line'>{line}</p>)
                : <p className='odc-wizard-block-line odc-wizard-block-empty'>{notSetLabel}</p>}
            </div>
          )
        })}
        <div className='odc-wizard-block odc-wizard-total'>
          <span className='odc-wizard-block-label'>{totalLabel}</span>
          {total
            ? <p className='odc-wizard-block-line odc-wizard-total-value odc-figure'>{total}</p>
            : <p className='odc-wizard-block-line odc-wizard-block-empty'>{notSetLabel}</p>}
        </div>
      </div>
    </section>
  )
}
