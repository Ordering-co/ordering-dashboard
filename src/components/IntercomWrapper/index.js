import React, { useEffect, useLayoutEffect, useState } from 'react'
import { useApi, useConfig, useSession } from '~components'
import { useProjectState } from '~ui'
import settings from '../../config'
import { getIntercomHash, setIntercomSettings } from '../Utils'
import { clearIntercomSession, isIntercomAllowed, isProjectIntercomAllowed, setIntercomAccess } from '../../@/components-dashboard/src/ui/src/utils/assistantIntercom'

export const IntercomWrapper = (props) => {
  const [{ user, auth, token, loading: sessionLoading }] = useSession()
  const [{ configs, loading: loadingConfigs }] = useConfig()
  const [ordering] = useApi()
  const [projectStatus] = useProjectState()
  const appId = settings.intercom_app_id
  const allowed = !!(appId && auth && token && !sessionLoading && !loadingConfigs &&
    isProjectIntercomAllowed(projectStatus) &&
    (user?.level === 0 || configs?.ordering_support_widget?.value !== '1'))
  const identity = JSON.stringify([appId, ordering.root, ordering.project, projectStatus?.project?.id, token, user?.id, user?.email, user?.level])
  const [verification, setVerification] = useState(null)
  const userHash = verification?.identity === identity ? verification.hash : null
  const values = {
    user_id: user?.email,
    email: user?.email,
    ...(user?.first_name || user?.last_name
      ? { name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') }
      : {}),
    ...(user?.phone_country_code && user?.cellphone
      ? { phone: `+${user.phone_country_code} ${user.cellphone}` }
      : {})
  }

  // Establish access before child effects (Home/Assistant) can update settings.
  useLayoutEffect(() => {
    setIntercomAccess(allowed, identity)
    if (!allowed) setVerification(null)
    return () => { setIntercomAccess(false) }
  }, [allowed, identity])

  useLayoutEffect(() => {
    if (!allowed || !userHash) return
    let loadScript
    if (typeof window.Intercom !== 'function') {
      const queue = function () { queue.q.push(arguments) }
      queue.q = []
      window.Intercom = queue
      loadScript = () => {
        if (!isIntercomAllowed()) return
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.async = true
        script.src = `https://widget.intercom.io/widget/${encodeURIComponent(appId)}`
        script.id = 'intercom_widget'
        // A downloaded SDK may finish after its project/session was revoked.
        script.onload = () => {
          const currentHash = window.intercomSettings?.user_hash
          if (!isIntercomAllowed() || typeof currentHash !== 'string' || !currentHash.trim()) clearIntercomSession()
        }
        document.body.appendChild(script)
      }
    }
    // Install verified settings before requesting a SDK that can auto-boot.
    setIntercomSettings({ api_base: 'https://api-iam.intercom.io', app_id: appId, ...values, user_hash: userHash }, user)
    if (loadScript) {
      if (document.readyState === 'complete') loadScript()
      else window.addEventListener('load', loadScript, { once: true })
    }
    return () => {
      if (loadScript) window.removeEventListener('load', loadScript)
    }
  }, [allowed, identity, userHash])

  useEffect(() => {
    if (allowed) setIntercomSettings(values, user)
  }, [allowed, identity, user])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    const updateHash = async () => {
      const userHash = await getIntercomHash({ userId: user?.email, token })
      if (!cancelled && userHash) setVerification({ identity, hash: userHash })
    }
    updateHash()
    return () => { cancelled = true }
  }, [allowed, identity, user?.email, token])

  return <>{props.children}</>
}
