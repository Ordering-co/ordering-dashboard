import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const BusinessQRCodeOptions = (props) => {
  const {
    UIComponent,
    useSiteFromApi = false
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [siteState, setSiteState] = useState({ site: null, loading: false, error: null })

  /**
   * Method to get the themes from API
   */
  const getSites = async () => {
    try {
      setSiteState({ ...siteState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const site = result.find(site => site.code === 'website')
        setSiteState({ ...siteState, loading: false, site })
      } else {
        setSiteState({ ...siteState, loading: false, error: result })
      }
    } catch (err) {
      setSiteState({ ...siteState, loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (useSiteFromApi) {
      getSites()
    }
  }, [useSiteFromApi])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          siteState={siteState}
        />
      )}
    </>
  )
}

BusinessQRCodeOptions.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Whether to fetch site information from API. If false, the UI component should use useSite() hook instead.
   */
  useSiteFromApi: PropTypes.bool
}
