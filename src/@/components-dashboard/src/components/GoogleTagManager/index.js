import React, { useEffect } from 'react'
import propTypes from 'prop-types'

export const GoogleTagManager = (props) => {
  const { children, tagId } = props

  useEffect(() => {
    if (tagId) {
      const tag = (w, d, s, l, i) => {
        w[l] = w[l] || []; w[l].push({
          'gtm.start': new Date().getTime(),
          event: 'gtm.js'
        })
        const f = d.getElementsByTagName(s)[0]
        const j = d.createElement(s)
        const dl = l !== 'dataLayer' ? '&l=' + l : ''
        j.async = true
        j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f?.parentNode?.insertBefore?.(j, f)
        window.document.head.appendChild(j)
      }
      tag(window, document, 'script', 'dataLayer', tagId)
    }
  }, [tagId])

  return (
    <>
      {children}
    </>
  )
}

GoogleTagManager.propTypes = {
  /**
   * Id of google tag manger
   */
  tagId: propTypes.string.isRequired
}
