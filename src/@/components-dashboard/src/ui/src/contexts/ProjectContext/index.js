import React, { useState, createContext, useEffect, useRef } from 'react'
import { useApi, useSession, useConfig } from '../../../../index'
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
  const [{ configs, fetchedWithToken }] = useConfig()
  const [state, setState] = useState({ loading: !!token, project: {}, plan: null, intercomAllowed: null, planResolved: false, trialSubscription: null, websiteProduct: null, billingUnavailable: false })
  const identity = `${ordering.root}:${ordering.project}:${token}`
  const [sessionIdentity, setSessionIdentity] = useState(identity)
  const requestSeq = useRef(0)
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity

  if (identity !== sessionIdentity) {
    setSessionIdentity(identity)
    setState({ loading: !!token, project: {}, plan: null, intercomAllowed: null, planResolved: false, trialSubscription: null, websiteProduct: null, billingUnavailable: false })
  }

  const websiteProduct = state.websiteProduct || (state.billingUnavailable && fetchedWithToken
    ? (configs?.web_franchises_x?.value && !configs?.web_marketplace_26?.value ? 'web_franchises_x' : 'web_marketplace_26')
    : null)

  const getProjectStatus = async () => {
    const seq = ++requestSeq.current
    captureDashboardOperation({ status: 'started', module: 'project', action: 'load_project' })
    setState(prev => ({ ...prev, loading: true, intercomAllowed: null, planResolved: false }))

    // Project support is available to project-local users without billing access.
    // Support settles independently: neither its loading nor billing can block the other.
    const read = async (path, authenticated = false) => {
      const response = await fetch(`${ordering.root}${path}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      return { response, data: await response.json() }
    }
    const isCurrentRequest = () => seq === requestSeq.current && identity === currentIdentity.current
    read('/current/support', true).then(({ response, data }) => {
      if (!isCurrentRequest()) return
      const intercomAllowed = response.ok === true && data?.error === false && typeof data?.result?.intercom_allowed === 'boolean'
        ? data.result.intercom_allowed
        : null
      setState(prev => ({ ...prev, intercomAllowed }))
    }, () => {
      if (isCurrentRequest()) setState(prev => ({ ...prev, intercomAllowed: null }))
    })
    const [projectRequest, billingRequest] = await Promise.allSettled([
      read('/current'),
      read('/billing/subscriptions', true)
    ])
    if (!isCurrentRequest()) return

    const projectResponse = projectRequest.value?.response
    const { error = true, result } = projectRequest.value?.data || {}
    const billingResponse = billingRequest.value?.response
    const resPlan = billingRequest.value?.data
    const projectId = result?.id
    const projectReadable = !error && ['number', 'string'].includes(typeof projectId) && Number.isInteger(Number(projectId)) && Number(projectId) > 0
    const billingReadable = !resPlan?.error && Array.isArray(resPlan?.result)
    const subscriptions = billingReadable ? resPlan.result : []
    const activePlan = subscriptions.length ? subscriptions.find(plan => plan?.status === 'active')?.plan?.plan : null
    const trialSubscription = subscriptions.find(subscription => subscription?.status === 'trialing') || null

    captureDashboardOperation({
      status: error ? 'failed' : 'succeeded',
      module: 'project',
      action: 'load_project',
      ...(error && { failureType: projectRequest.status === 'rejected' ? 'network' : 'api' })
    })
    setState(prev => ({
      ...prev,
      loading: false,
      project: error ? {} : result,
      plan: activePlan,
      planResolved: projectResponse?.ok === true && billingResponse?.ok === true && projectReadable && billingReadable,
      trialSubscription,
      websiteProduct: !error && billingReadable ? getSubscribedWebsiteProduct(subscriptions) : null,
      billingUnavailable: !error && !billingReadable
    }))
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
    <ProjectContext.Provider value={[{ ...state, websiteProduct }, functions]}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectState () {
  const projectManager = React.useContext(ProjectContext)
  return projectManager || [{}, () => {}]
}
