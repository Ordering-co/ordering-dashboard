import React, { useState } from 'react'
import { useLanguage, useUtils, useEvent, WebsocketStatus as WebsocketStatusController } from '../../../../../index'
import { Modal } from '../../Shared'
import { Button } from '../../../styles'

import {
  Contatiner,
  StatusContainer,
  WebsocketStatusDot,
  DetailContainer,
  StatusItemWrapper,
  TroubleshootingSection,
  ButtonsContainer
} from './styles'

const STATUS_ITEMS = [
  { status: 1, labelKey: 'OK', labelDefault: 'Ok', descriptionKey: 'WEBSOCKET_OK', descriptionDefault: 'The websocket works normally.' },
  { status: 0, labelKey: 'CONNECTING', labelDefault: 'Connecting', descriptionKey: 'WEBSOCKET_CONNECTING', descriptionDefault: 'The websocket is connecting.' },
  { status: 2, labelKey: 'DISCONNECTED', labelDefault: 'Disconnected', descriptionKey: 'WEBSOCKET_DISCONNECTED', descriptionDefault: 'The server is slow, please reload.' }
]

const SocketStatusUI = (props) => {
  const {
    socketStatus,
    connectedDate,
    isConnectionDegraded
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [events] = useEvent()
  const [openModal, setOpenModal] = useState(false)

  const handleGoToSupport = () => {
    setOpenModal(false)
    events.emit('go_to_page', { page: 'support' })
  }

  return (
    <Contatiner className='websocket-container' isDegraded={isConnectionDegraded}>
      <Button
        borderRadius='8px'
        color='secundary'
        onClick={() => setOpenModal(true)}
      >
        <StatusContainer>
          <span>{t('CONNECTION', 'Connection')}</span>
          <WebsocketStatusDot
            status={socketStatus}
            isDegraded={isConnectionDegraded}
          />
        </StatusContainer>
      </Button>
      {openModal && (
        <Modal
          open={openModal}
          onClose={() => setOpenModal(false)}
          width='535px'
        >
          <DetailContainer>
            <h2>{t('CONNECTION_STATUS', 'Connection status')}</h2>
            <span>{t('LAST_UPDATE', 'Last update')}: {parseDate(connectedDate)}</span>
            <p>{t('WEBSOCKET_STATUS_INFO_WITHOUT_LINK', 'Verify the server connection by date and time using the Connection status button. Press update to refresh you dashboard and update the status as well. Need help? Contact our Customer support team.')}</p>
            {STATUS_ITEMS.map(({ status, labelKey, labelDefault, descriptionKey, descriptionDefault }) => (
              <StatusItemWrapper key={status} isActive={socketStatus === status}>
                <div>
                  <WebsocketStatusDot status={status} />
                  <span>{t(labelKey, labelDefault)}</span>
                </div>
                <p>{t(descriptionKey, descriptionDefault)}</p>
              </StatusItemWrapper>
            ))}
            {isConnectionDegraded && (
              <TroubleshootingSection>
                <h3>{t('WEBSOCKET_TROUBLESHOOTING_TITLE', 'Troubleshooting')}</h3>
                <p>{t('WEBSOCKET_BANNER_BLOCKED_SUBTITLE', 'Real-time updates are unavailable. Your browser may be blocking the connection — try disabling ad blockers or browser extensions, check your firewall settings, or reload the page.')}</p>
                <p>{t('WEBSOCKET_STATUS_INFO_WITHOUT_LINK', 'Verify the server connection by date and time using the Connection status button. Press update to refresh you dashboard and update the status as well. Need help? Contact our Customer support team.')}</p>
                <button type='button' onClick={handleGoToSupport}>
                  {t('CUSTOMER_SUPPORT', 'Customer support')}
                </button>
              </TroubleshootingSection>
            )}
            <ButtonsContainer>
              <Button
                color='secundary'
                onClick={() => setOpenModal(false)}
              >
                {t('CLOSE', 'Close')}
              </Button>
              <Button
                color='primary'
                onClick={() => window.location.reload()}
              >
                {t('UPDATE', 'Update')}
              </Button>
            </ButtonsContainer>
          </DetailContainer>
        </Modal>
      )}
    </Contatiner>
  )
}

export const WebsocketStatus = (props) => {
  const socketProps = {
    ...props,
    UIComponent: SocketStatusUI
  }
  return <WebsocketStatusController {...socketProps} />
}
