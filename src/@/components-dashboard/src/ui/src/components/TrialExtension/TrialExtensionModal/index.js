// redesign (R2): the booking modal on Product's Dialog, replacing the legacy Shared Modal.
import React from 'react'

import { useLanguage } from '../../../../../index'
import { useTrialExtension } from '../../../contexts/TrialExtensionContext'
import { Button, Dialog } from '../../Shared/Product'
import { CircleCheck } from '../../Shared/Icon'
import { CalendlyInlineEmbed } from '../CalendlyInlineEmbed'
import './trial-extension-modal.css'

/**
 * The single app-level booking modal: the popup, the top banner, and the Home card all open
 * this same modal (via TrialExtensionContext.openBooking). Shows the Calendly inline embed,
 * then a success state once the visitor books (or already booked elsewhere).
 *
 * Product Dialog, `size='lg'` (720px; on a phone the Dialog is a bottom sheet at the full width). The Dialog's own
 * body scrolls, so a tall Calendly embed scrolls inside it.
 */
export const TrialExtensionModal = () => {
  const [, t] = useLanguage()
  const {
    isModalOpen,
    closeBooking,
    bookingUrl,
    fallbackUrl,
    booked,
    justBooked,
    markBooked
  } = useTrialExtension()

  const showSuccess = booked || justBooked

  return (
    <Dialog
      open={isModalOpen}
      onOpenChange={(open) => { if (!open) closeBooking() }}
      size='lg'
      title={t('TRIAL_EXTENSION_MODAL_TITLE', 'Extend your free trial to 14 days')}
      closeLabel={t('CLOSE', 'Close')}
    >
      <div className='odc-trial-modal-body'>
        {showSuccess
          ? (
            <div className='odc-trial-modal-success'>
              <CircleCheck className='odc-icon odc-trial-modal-success-icon' aria-hidden='true' />
              <h3 className='odc-trial-modal-success-title'>{t('TRIAL_EXTENSION_SUCCESS_TITLE', 'Your meeting is booked')}</h3>
              <p className='odc-trial-modal-success-text'>
                {t('TRIAL_EXTENSION_SUCCESS_TEXT', 'Your meeting is booked. Our team will extend your free trial to 14 days.')}
              </p>
              <Button variant='primary' onClick={closeBooking}>
                {t('CLOSE', 'Close')}
              </Button>
            </div>
            )
          : (
            <>
              <p className='odc-trial-modal-description'>
                {t(
                  'TRIAL_EXTENSION_MODAL_DESCRIPTION',
                  'Book a short call with our team before your trial ends and we will extend it to 14 days in total from the start of your trial.'
                )}
              </p>
              <CalendlyInlineEmbed
                embedUrl={bookingUrl}
                fallbackUrl={fallbackUrl}
                onScheduled={markBooked}
              />
            </>
            )}
      </div>
    </Dialog>
  )
}
