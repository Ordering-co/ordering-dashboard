import React from 'react'
import QRCode from 'react-qr-code'
import { BoxArrowUpRight } from 'react-bootstrap-icons'
import { whatsAppTestUrlFromPhone } from '../../../../../components/WhatsAppBotsList/botConnection'
import { useLanguage } from '../../../../../index'
import { Modal } from '../../Shared'
import { Hint, QrBlock, QrFrame, TestLink, TestModalBody, TestPhone } from './styles'

/**
 * Test chat for one bot, opened from the list. The link is the number
 * digits only.
 */
export const WhatsAppBotTest = ({ open, phone, onClose }) => {
  const [, t] = useLanguage()
  const url = whatsAppTestUrlFromPhone(phone)
  if (!open || !url) return null

  return (
    <Modal
      open
      width='440px'
      title={t('WHATSAPP_TEST_AGENT', 'Test WhatsApp Agent')}
      onClose={onClose}
    >
      <TestModalBody>
        <Hint>{t('WHATSAPP_TEST_HINT', 'Open this WhatsApp chat in your desktop browser, or scan the QR code from your phone.')}</Hint>
        <TestPhone>
          <span>{t('PHONE', 'Phone')}:</span> {phone}
        </TestPhone>
        <TestLink href={url} target='_blank' rel='noopener noreferrer'>
          <BoxArrowUpRight aria-hidden='true' />
          {t('WHATSAPP_TEST_OPEN_LINK', 'Open WhatsApp Link')}
        </TestLink>
        <QrBlock>
          <Hint>{t('WHATSAPP_TEST_QR_HINT', 'Scan this QR code in WhatsApp to test the same link from your phone.')}</Hint>
          <QrFrame>
            <QRCode value={url} size={180} title={t('WHATSAPP_TEST_QR', 'QR code of the WhatsApp test link')} />
          </QrFrame>
        </QrBlock>
      </TestModalBody>
    </Modal>
  )
}
