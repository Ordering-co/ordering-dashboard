import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useSite } from '../../contexts/SiteContext'

/**
 * Google Actions Center on one store: reads
 * GET business/{id}/google_actions, activates with the chosen site and the
 * current consent version, and deactivates. The caller mounts it only for
 * a project that shows Google (the GET answers for every project).
 */
export const BusinessGoogleActions = (props) => {
  const { UIComponent, businessId } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [statusState, setStatusState] = useState({ loading: true, data: null, error: null })
  // The project sites are already loaded for the whole dashboard (SiteContext).
  const [siteState, { getSites: loadSites }] = useSite()
  const sitesState = {
    loading: !!siteState?.loading,
    loaded: Array.isArray(siteState?.sites),
    sites: Array.isArray(siteState?.sites) ? siteState.sites : []
  }
  const [actionState, setActionState] = useState({ loading: false, error: null, code: null, reason: null })

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const url = `${ordering.root}/business/${businessId}/google_actions`

  const getStatus = async () => {
    try {
      setStatusState(prev => ({ ...prev, loading: true, error: null }))
      const response = await fetch(url, { method: 'GET', headers })
      const content = await response.json()
      if (content.error) {
        setStatusState({ loading: false, data: null, error: content.result })
        return
      }
      setStatusState({ loading: false, data: content.result, error: null })
    } catch (err) {
      setStatusState({ loading: false, data: null, error: [err.message] })
    }
  }

  /** Loads the sites only if the dashboard has not got them (e.g. its request failed). */
  const getSites = () => {
    if (!sitesState.loading && !sitesState.loaded && loadSites) loadSites()
  }

  /** Sends the change; true when the API accepted it. */
  const update = async (body) => {
    try {
      setActionState({ loading: true, error: null, code: null, reason: null })
      const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
      const content = await response.json()
      if (content.error) {
        setActionState({ loading: false, error: content.result, code: content.error_codes?.[0] || null, reason: content.reason || null })
        return false
      }
      setActionState({ loading: false, error: null, code: null, reason: null })
      setStatusState({ loading: false, data: content.result, error: null })
      return true
    } catch (err) {
      setActionState({ loading: false, error: [err.message], code: null, reason: null })
      return false
    }
  }

  const handleActivate = (siteId) => update({
    enabled: true,
    site_id: siteId,
    consent_version: statusState.data?.current_consent_version
  })

  const handleDeactivate = () => update({ enabled: false })

  const clearActionError = () => setActionState({ loading: false, error: null, code: null, reason: null })

  useEffect(() => {
    if (businessId) getStatus()
  }, [businessId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          statusState={statusState}
          sitesState={sitesState}
          actionState={actionState}
          getStatus={getStatus}
          getSites={getSites}
          handleActivate={handleActivate}
          handleDeactivate={handleDeactivate}
          clearActionError={clearActionError}
        />
      )}
    </>
  )
}

BusinessGoogleActions.propTypes = {
  UIComponent: PropTypes.elementType,
  businessId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
}
