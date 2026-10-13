import React, { useState, createContext, useEffect, useRef } from 'react'
import { useApi, useSession } from '../../../../index'
import { captureDashboardOperation } from '~/analytics/posthog'
import { getSubscribedWebsiteProduct } from '../../utils/getPreferredSiteUrl'
/**
 * Create ProjectContext
 * This context will manage the info between pages and provide an easy interface
 */
export const ProjectContext = createContext()

/**
  * Custom provider to mange shared info
  * @param {props} props
  */
export const ProjectProvider = ({ children }) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [state, setState] = useState({ loading: false, project: {}, trialSubscription: null, websiteProduct: null })
  const identity = `${ordering.root}:${ordering.project}:${token}`
  const [sessionIdentity, setSessionIdentity] = useState(identity)
  const requestSeq = useRef(0)

  if (identity !== sessionIdentity) {
    setSessionIdentity(identity)
    setState(prev => ({ ...prev, trialSubscription: null, websiteProduct: null }))
  }

  const getProjectStatus = async () => {
    const seq = ++requestSeq.current
    captureDashboardOperation({ status: 'started', module: 'project', action: 'load_project' })
    try {
      setState(prev => seq === requestSeq.current ? { ...prev, loading: true } : prev)
      const response = await fetch(`${ordering.root}/current`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const reqPlan = await fetch(`${ordering.root}/billing/subscriptions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })

      const { error, result } = await response.json()
      const resPlan = await reqPlan.json()

      const activePlan = resPlan?.result?.length ? resPlan?.result?.find(plan => plan?.status === 'active')?.plan?.plan : null
      const trialSubscription = resPlan?.result?.length ? resPlan?.result?.find(subscription => subscription?.status === 'trialing') : null

      captureDashboardOperation({
        status: error ? 'failed' : 'succeeded',
        module: 'project',
        action: 'load_project',
        ...(error && { failureType: 'api' })
      })

      if (seq !== requestSeq.current) return
      setState({
        loading: false,
        project: error ? {} : result,
        plan: resPlan?.error
          ? null
          : activePlan,
        trialSubscription: resPlan?.error
          ? null
          : (trialSubscription || null),
        websiteProduct: !error && !resPlan?.error && Array.isArray(resPlan?.result)
          ? getSubscribedWebsiteProduct(resPlan.result)
          : null
      })
    } catch (error) {
      captureDashboardOperation({ status: 'failed', module: 'project', action: 'load_project', failureType: 'network' })
      if (seq !== requestSeq.current) return
      setState(prev => ({ ...prev, loading: false, websiteProduct: null }))
    }
  }

  const functions = {
    getProjectStatus
  }

  useEffect(() => {
    if (token) {
      getProjectStatus()
    }
    return () => { requestSeq.current += 1 }
  }, [token, ordering.root, ordering.project])

  return (
    <ProjectContext.Provider value={[state, functions]}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectState () {
  const projectManager = React.useContext(ProjectContext)
  return projectManager || [{}, () => {}]
}
