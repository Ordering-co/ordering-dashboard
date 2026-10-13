import React, { useEffect } from 'react'
import { useSession } from '../../contexts/SessionContext'
import PropTypes from 'prop-types'

export const CannyIdentification = (props) => {
  const {
    appId,
    children
  } = props

  const [{ user }] = useSession()

  useEffect(() => {
    if (!appId) {
      return
    }
    !(function (w, d, i, s) { function l () { if (!d.getElementById(i)) { const f = d.getElementsByTagName(s)[0]; const e = d.createElement(s); e.type = 'text/javascript', e.async = !0, e.src = 'https://canny.io/sdk.js', f?.parentNode?.insertBefore?.(e, f) } } if (typeof w.Canny !== 'function') { const c = function () { c.q.push(arguments) }; c.q = [], w.Canny = c, d.readyState === 'complete' ? l() : w.attachEvent ? w.attachEvent('onload', l) : w.addEventListener('load', l, !1) } }(window, document, 'canny-jssdk', 'script'))
  }, [appId])

  useEffect(() => {
    if (!user || !appId) return

    window.Canny('identify', {
      appID: appId,
      user: {
        // Replace these values with the current user's data
        email: user.email,
        name: user.name,
        id: user.id,

        // These fields are optional, but recommended:
        avatarURL: user?.photo
      }
    })
  }, [user, appId])

  return (
    <>
      {children}
    </>
  )
}

CannyIdentification.propTypes = {
  /**
   * Your Canny appId
   * @see appId What is appId ? https://developers.canny.io/install
   */
  appId: PropTypes.string.isRequired
}
