import React from 'react'
import { CheckCircleFill } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { useTrialExtension } from '../../../contexts/TrialExtensionContext'
import { Modal } from '../../Shared'
import { Button } from '../../../styles'
import { CalendlyInlineEmbed } from '../CalendlyInlineEmbed'
import {
  ModalBody,
  OfferDescription,
  SuccessIcon,
  SuccessState,
  SuccessText,
  SuccessTitle
} from './styles'

/**
 * The single app-level booking modal: the popup, the top banner, and the Home card all open
 * this same modal (via TrialExtensionContext.openBooking). Shows the Calendly inline embed,
 * then a success state once the visitor books (or already booked elsewhere).
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
    <Modal
      open={isModalOpen}
      onClose={closeBooking}
      width='720px'
      maxWidth='95vw'
      padding='30px'
      title={t('TRIAL_EXTENSION_MODAL_TITLE', 'Extend your free trial to 14 days')}
    >
      <ModalBody>
        {showSuccess
          ? (
            <SuccessState>
              <SuccessIcon aria-hidden='true'>
                <CheckCircleFill size={48} />
              </SuccessIcon>
              <SuccessTitle>{t('TRIAL_EXTENSION_SUCCESS_TITLE', 'Your meeting is booked')}</SuccessTitle>
              <SuccessText>
                {t('TRIAL_EXTENSION_SUCCESS_TEXT', 'Your meeting is booked. Our team will extend your free trial to 14 days.')}
              </SuccessText>
              <Button color='primary' borderRadius='8px' style={{ minHeight: '44px' }} onClick={closeBooking}>
                {t('CLOSE', 'Close')}
              </Button>
            </SuccessState>
            )
          : (
            <>
              <OfferDescription>
                {t(
                  'TRIAL_EXTENSION_MODAL_DESCRIPTION',
                  'Book a short call with our team before your trial ends and we will extend it to 14 days in total from the start of your trial.'
                )}
              </OfferDescription>
              <CalendlyInlineEmbed
                embedUrl={bookingUrl}
                fallbackUrl={fallbackUrl}
                onScheduled={markBooked}
              />
            </>
            )}
      </ModalBody>
    </Modal>
  )
}
