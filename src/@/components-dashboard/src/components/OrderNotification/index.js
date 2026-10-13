import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useEvent } from '../../contexts/EventContext'

export const OrderNotification = (props) => {
  const {
    UIComponent
  } = props

  const socket = useWebsocket()
  const [{ user, loading }] = useSession()
  const [events] = useEvent()

  useEffect(() => {
    if (!user) return
    const handleRegisterOrder = (order) => {
      events.emit('order_added', order)
    }
    socket.on('orders_register', handleRegisterOrder)
    return () => {
      socket.off('orders_register', handleRegisterOrder)
    }
  }, [socket, loading, user])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
        />
      )}
    </>
  )
}

OrderNotification.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
