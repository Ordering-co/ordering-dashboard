import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../classNames'
import { Stepper } from './Stepper'
import './wizard.css'

/**
 * Layout of the create-order wizard (batch 5.5): steps on top, then the step (its title and
 * content) next to the fixed summary, and the pinned footer. It owns the focus rule: when the
 * step changes, focus goes to the step title (never on the first render, where the Sheet
 * decides where focus starts).
 *
 * `footerHost` says where the footer goes. A DOM element: the footer is portaled there (the
 * Sheet's foot slot). `null`: the host is not ready yet, draw nothing. `undefined`: no host
 * (standalone use), the footer is drawn inline at the end. The component has no text of its own.
 */
export const Wizard = ({
  steps,
  current,
  onSelectStep,
  stepperLabel,
  doneLabel,
  pendingLabel,
  title,
  summary,
  footer,
  footerHost,
  className,
  children
}) => {
  const titleRef = useRef(null)
  const previousStep = useRef(current)

  useEffect(() => {
    if (previousStep.current === current) return
    previousStep.current = current
    titleRef.current?.focus()
  }, [current])

  let foot = null
  if (footerHost) foot = createPortal(footer, footerHost)
  else if (footerHost === undefined) foot = <div className='odc-wizard-foot-inline'>{footer}</div>

  return (
    <div className={cx('odc-wizard', className)}>
      <Stepper
        label={stepperLabel}
        steps={steps}
        doneLabel={doneLabel}
        pendingLabel={pendingLabel}
        onSelect={onSelectStep}
      />
      <div className='odc-wizard-layout'>
        <div className='odc-wizard-main'>
          <h3 ref={titleRef} tabIndex={-1} className='odc-wizard-step-title' data-wizard-step-title=''>{title}</h3>
          {children}
        </div>
        {summary && <div className='odc-wizard-aside'>{summary}</div>}
      </div>
      {foot}
    </div>
  )
}
