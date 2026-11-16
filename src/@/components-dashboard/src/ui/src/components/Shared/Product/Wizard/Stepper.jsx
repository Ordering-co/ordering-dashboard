import React from 'react'

import { Check } from '../../Icon'
import { cx } from '../classNames'
import './wizard.css'

/**
 * Steps of the create-order wizard (batch 5.5). A named navigation with an ordered list:
 * every step has its number, its name and a state in words (done, current, pending).
 * The current one carries `aria-current="step"`. Done steps are buttons that go back (or
 * forward to a step that already has its data); pending steps are plain text and cannot be
 * skipped. All text comes in by props: the component has none of its own.
 *
 * steps: [{ id, label, state: 'done' | 'current' | 'pending' }]
 */
export const Stepper = ({ label, steps, doneLabel, pendingLabel, onSelect, className }) => (
  <nav className={cx('odc-wizard-steps', className)} aria-label={label}>
    <ol className='odc-wizard-steps-list'>
      {steps.map((step, index) => {
        const marker = (
          <span className='odc-wizard-step-marker' aria-hidden='true'>
            {step.state === 'done' ? <Check className='odc-icon' /> : index + 1}
          </span>
        )
        return (
          <li key={step.id} className='odc-wizard-step-item' data-state={step.state}>
            {step.state === 'done'
              ? (
                <button
                  type='button'
                  className='odc-wizard-step-link'
                  aria-label={`${step.label}, ${doneLabel}`}
                  onClick={() => onSelect?.(index)}
                >
                  {marker}
                  <span className='odc-wizard-step-label'>{step.label}</span>
                </button>
                )
              : (
                <span className='odc-wizard-step-link' aria-current={step.state === 'current' ? 'step' : undefined}>
                  {marker}
                  <span className='odc-wizard-step-label'>{step.label}</span>
                  {step.state === 'pending' && <span className='odc-sr-only'>{pendingLabel}</span>}
                </span>
                )}
          </li>
        )
      })}
    </ol>
  </nav>
)
