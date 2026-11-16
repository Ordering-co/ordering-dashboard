import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { AiAgentsUpgradeModal } from '../components/AiAgentsUpgradeModal'
import { buildDashboardUpgradeUrl } from '../utils/aiAgentsUrl'
import { useProjectState } from './ProjectContext'

const outsideProvider = { upgradeRequired: false, upgradePending: false, requestUpgrade: () => false }
const LegacyPlanUpgradeContext = createContext(outsideProvider)

export const LegacyPlanUpgradeProvider = ({ children }) => {
  const location = useLocation()
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [projectStatus] = useProjectState()
  const project = ordering?.project
  const root = ordering?.root
  // Only the current tenant's explicit server decision can trigger the dialog.
  const upgradeRequired = !!token && projectStatus?.dashboardUpgradeRequired === true
  const pending = !!token && projectStatus?.dashboardUpgradePending === true
  const [request, setRequest] = useState(null)
  const deferred = useRef(null)
  const matches = useCallback(candidate => candidate?.project === project && candidate?.root === root && candidate?.token === token, [project, root, token])
  const open = upgradeRequired && request?.open === true && matches(request)

  useEffect(() => {
    if (!upgradeRequired || !matches(request)) setRequest(null)
  }, [matches, request, upgradeRequired])

  const requestUpgrade = useCallback((returnFocus, proceed) => {
    if (pending) {
      deferred.current = { project, root, token, location, returnFocus, proceed }
      return true
    }
    if (!upgradeRequired) return false
    setRequest(previous => previous?.open && matches(previous)
      ? previous
      : { open: true, project, root, token, returnFocus })
    return true
  }, [location, matches, pending, upgradeRequired, project, root, token])

  useEffect(() => {
    const intent = deferred.current
    if (!intent) return
    if (!matches(intent) || intent.location !== location) {
      deferred.current = null
      return
    }
    if (pending) return
    deferred.current = null
    if (!requestUpgrade(intent.returnFocus)) intent.proceed?.()
  }, [location, matches, pending, requestUpgrade])

  const context = useMemo(() => ({ upgradeRequired, upgradePending: pending, requestUpgrade }), [upgradeRequired, pending, requestUpgrade])

  return (
    <LegacyPlanUpgradeContext.Provider value={context}>
      {children}
      <AiAgentsUpgradeModal
        open={open}
        onClose={() => setRequest(previous => previous && { ...previous, open: false })}
        formUrl={buildDashboardUpgradeUrl({ project, email: user?.email })}
        variant='legacy-plan'
        returnFocus={request?.returnFocus}
      />
    </LegacyPlanUpgradeContext.Provider>
  )
}

export const useLegacyPlanUpgrade = () => useContext(LegacyPlanUpgradeContext)
