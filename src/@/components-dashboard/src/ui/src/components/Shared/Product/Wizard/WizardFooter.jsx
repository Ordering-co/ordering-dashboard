import React, { useId } from 'react'

import { Button } from '../Button'
import { cx } from '../classNames'
import './wizard.css'

/**
 * Pinned foot of the create-order wizard (C7, batch 5.5): Back (secondary, hidden on the
 * first step) and the primary action (Continue, or the final action with its amount).
 * While the primary is disabled the reason shows in one line above the buttons and is linked
 * with `aria-describedby`. `continueLabel={null}` leaves the foot without a primary, for a
 * step whose own content owns the final action. On mobile the buttons take the full width
 * and 44px (wizard.css).
 */
export const WizardFooter = ({
  showBack = false,
  backLabel,
  onBack,
  continueLabel,
  onContinue,
  continueDisabled = false,
  reason,
  busy = false,
  className
}) => {
  const reasonId = useId()
  const showReason = continueDisabled && !!reason && !!continueLabel
  return (
    <div className={cx('odc-wizard-foot', className)}>
      {showReason && <p id={reasonId} className='odc-wizard-reason'>{reason}</p>}
      <div className='odc-wizard-actions'>
        {showBack && <Button variant='secondary' size='lg' onClick={onBack}>{backLabel}</Button>}
        {continueLabel && (
          <Button
            variant='primary'
            size='lg'
            className='odc-wizard-primary'
            busy={busy}
            disabled={continueDisabled}
            aria-describedby={showReason ? reasonId : undefined}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
