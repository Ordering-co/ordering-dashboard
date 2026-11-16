import React, { useEffect, useState } from 'react'
import { useApi, useLanguage, useSession } from '~components'
import { GOOGLE_ACTIONS_STATE_FAMILIES, getGoogleActionsBadgeLabels, getGoogleActionsState } from '../../../../../utils/googleActions'
import { IconButton, Skeleton, StatusBadge } from '../../Shared/Product'
import { ChevronRight } from '../../Shared/Icon'

// · the store's Order with Google state as one more figure of the Overview, with the arrow to its section. Drawn by the
// Overview only when the section is in the person's menu (the project shows Google); it reads GET business/{id}/google_actions.

/** The state of one store on Google, as the API gives it: `{ loading, state }` (`state` null on error). */
const useStoreGoogleState = (businessId) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const ready = !!businessId && !!token
  const [result, setResult] = useState({ loading: ready, state: null })

  useEffect(() => {
    if (!ready) {
      setResult({ loading: false, state: null })
      return
    }
    let active = true
    setResult({ loading: true, state: null })
    fetch(`${ordering.root}/business/${businessId}/google_actions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    })
      .then(response => response.json())
      .then(({ error, result: data }) => {
        if (active) setResult({ loading: false, state: error ? null : getGoogleActionsState(data) })
      })
      .catch(() => { if (active) setResult({ loading: false, state: null }) })
    return () => { active = false }
  }, [ready, businessId, token, ordering?.root])

  return result
}

export const StoreGoogleFact = ({ businessId, label, openLabel, onOpen }) => {
  const [, t] = useLanguage()
  const { loading, state } = useStoreGoogleState(businessId)
  if (!loading && state === null) return null
  const labels = getGoogleActionsBadgeLabels(t)

  return (
    <div className='odc-se-fact'>
      <dt>{label}</dt>
      <dd>
        {loading
          ? <Skeleton size='40%' />
          : state === 'not_activated'
            ? <span>{labels.not_activated}</span>
            : <StatusBadge family={GOOGLE_ACTIONS_STATE_FAMILIES[state]} label={labels[state]} />}
        <IconButton icon={ChevronRight} flipInRtl size='sm' label={openLabel} onClick={onOpen} />
      </dd>
    </div>
  )
}
