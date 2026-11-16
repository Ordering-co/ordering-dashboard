import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

// redesign stores 5.7 · The pickup form saves from its own draft, so this controller holds no form state and shows no
// toast: `savePickup(changes)` writes the changed keys and answers `{ ok, error }`, and the form draws the failure in its save bar.
// `error` is the first text of the API message (never the boolean flag of the response), or the thrown message.

// the first text of what the API answers (a string or a list of them), or null
const firstMessage = (value) => {
  const message = Array.isArray(value) ? value.find(item => typeof item === 'string' && item.trim()) : value
  return typeof message === 'string' && message.trim() ? message : null
}

export const BusinessPickupDetails = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  // the latest props and session, so a save that ends after a render updates the business that is on screen now
  const latest = useRef({})
  latest.current = { ...props, ordering, session }

  /**
   * Writes the changed keys of the business. Answers `{ ok: true }` or `{ ok: false, error }`.
   */
  const savePickup = async (changes) => {
    try {
      const { business, ordering, session } = latest.current
      const { content: { error, result } } = await ordering.businesses(business.id).save(changes, {
        accessToken: session.token
      })
      if (error) return { ok: false, error: firstMessage(result) }
      latest.current.handleUpdateBusinessState?.(result)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: firstMessage(err?.message) }
    }
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            savePickup={savePickup}
          />
        )
      }
    </>
  )
}

BusinessPickupDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
