import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

// redesign stores 5.7 · The ETA form saves from its own draft, so this controller holds no form state and shows no
// toast: `saveEta(values)` writes the WHOLE object of times (main resends every key) and answers `{ ok, error }`; the form draws
// the failure in its save bar. `error` is the first text of `content.result`, or the thrown message.

// the first text of what the API answers (a string or a list of them), or null
const firstMessage = (value) => {
  const message = Array.isArray(value) ? value.find(item => typeof item === 'string' && item.trim()) : value
  return typeof message === 'string' && message.trim() ? message : null
}

export const BusinessEta = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  // the latest props and token, so a save that ends after a render updates the business that is on screen now
  const latest = useRef({})
  latest.current = { ...props, ordering, token }

  /**
   * Writes the times of every status of both lists. Answers `{ ok: true }` or `{ ok: false, error }`.
   */
  const saveEta = async (values) => {
    try {
      const { business, ordering, token } = latest.current
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ eta_status_times: JSON.stringify(values) })
      }
      const response = await fetch(`${ordering.root}/business/${business.id}`, requestOptions)
      const content = await response.json()
      if (content.error) return { ok: false, error: firstMessage(content.result) }
      latest.current.handleUpdateBusinessState?.({ ...latest.current.business, eta_status_times: values })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: firstMessage(error?.message) }
    }
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            saveEta={saveEta}
          />
        )
      }
    </>
  )
}

BusinessEta.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
