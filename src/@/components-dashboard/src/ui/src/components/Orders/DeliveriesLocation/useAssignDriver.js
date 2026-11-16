import { useCallback, useRef, useState } from 'react'
import { useApi, useConfig, useLanguage, useSession } from '../../../../../index'
import { ToastType, useToast } from '../../../../../contexts/ToastContext'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'

// redesign deliveries F2-B2 (decision 3): assign a driver from the dispatch board with the request the order panel sends,
// without DriverSelector or the DriversList controller (they leave the page's location rooms when they unmount and ask for
// another list of candidates). One assignment at a time: a second press while one is in flight is ignored.
//   assign(order, driver)   saves { driver_id } (or asks for the comment first when the project requires it)
//   isBusy(order, driver)   true for the button that was pressed
//   busy                    true while any assignment is in flight (the dock uses its end to put the focus back, R1 finding 4)
//   error / retry / dismissError   the failed assignment, repeated as it was sent (comment included)
//   comment                 { open, onSubmit(text), onCancel() } for AssignCommentDialog
const keyOf = (order, driver) => `${order?.id}:${driver?.id}`

// The API answers an array of messages or a single one; the first text is the one the dashboard has always shown.
const firstMessage = (result) => (Array.isArray(result) ? result.find(item => typeof item === 'string') : result)

export const useAssignDriver = ({ onAssigned } = {}) => {
  const [ordering] = useApi()
  const [session] = useSession()
  const [configState] = useConfig()
  const [, t] = useLanguage()
  const [, toast] = useToast()

  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(null)
  const inFlight = useRef(false)
  const onAssignedRef = useRef(onAssigned)
  onAssignedRef.current = onAssigned

  // Same switch as the order panel's driver selector (DriverSelector/index.js).
  const needsComment = configState?.configs?.manual_driver_assignment_comment_enabled?.value === '1'

  const send = async (order, driver, comment) => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    setBusyKey(keyOf(order, driver))
    const fail = (message) => setError({
      message: translateApiMessage(t, message, t('ERROR_UNKNOWN', 'An error has occurred')),
      order,
      driver,
      comment
    })
    try {
      const payload = comment === undefined
        ? { driver_id: driver.id }
        : { manual_driver_assignment_comment: comment, driver_id: driver.id }
      const { content } = await ordering.setAccessToken(session?.token).orders(order.id).save(payload)
      if (content?.error) {
        fail(firstMessage(content.result))
      } else {
        toast?.showToast?.(ToastType.Success, t('ORDER_DRIVER_ASSIGNED', 'Driver assigned to order'))
        onAssignedRef.current?.(order, driver)
      }
    } catch (err) {
      fail(err?.message)
    } finally {
      inFlight.current = false
      setBusyKey(null)
    }
  }

  const assign = (order, driver) => {
    if (inFlight.current || !order || !driver) return
    if (needsComment) {
      setPending({ order, driver })
      return
    }
    send(order, driver)
  }

  const submitComment = (text) => {
    if (!pending || typeof text !== 'string' || !text.trim()) return
    const { order, driver } = pending
    setPending(null)
    send(order, driver, text)
  }

  const cancelComment = useCallback(() => setPending(null), [])

  const retry = () => {
    if (error) send(error.order, error.driver, error.comment)
  }

  return {
    assign,
    isBusy: (order, driver) => busyKey !== null && busyKey === keyOf(order, driver),
    busy: busyKey !== null, // redesign deliveries R1 (finding 4)
    error,
    retry,
    dismissError: () => setError(null),
    comment: {
      open: !!pending,
      order: pending?.order ?? null,
      driver: pending?.driver ?? null,
      onSubmit: submitComment,
      onCancel: cancelComment
    }
  }
}
