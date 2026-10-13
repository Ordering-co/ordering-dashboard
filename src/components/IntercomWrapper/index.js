import React, { useEffect } from 'react'
import { useConfig, useSession } from '~components'
import { setIntercomSettings } from '../Utils'
import settings from '../../config'
import { getAssistantIntercomSettings, hideAssistantIntercomMessenger } from '../../@/components-dashboard/src/ui/src/utils/assistantIntercom'

export const IntercomWrapper = (props) => {
  const [{ user, auth, token, loading: sessionLoading }] = useSession()
  const [{ configs, loading: loadingConfigs }] = useConfig()
  const values = {
    user_id: user?.email,
    email: user?.email
  }

  if (user?.first_name || user?.last_name) {
    values.name = user?.first_name && user?.last_name
      ? `${user?.first_name} ${user?.last_name}`
      : user?.first_name ?? user?.last_name
  }

  if (user?.phone_country_code && user?.cellphone) {
    values.phone = `+${user?.phone_country_code} ${user?.cellphone}`
  }

  const addIntercomScript = () => {
    if (!settings.intercom_app_id) return
    const isBlockUpdate = user?.email?.includes('@ordering.co')
    if (!isBlockUpdate) {
      window.intercomSettings = getAssistantIntercomSettings({
        ...window.intercomSettings,
        api_base: 'https://api-iam.intercom.io',
        app_id: settings.intercom_app_id,
        ...values
      })
      const func = (function () { const w = window; const ic = w.Intercom; if (typeof ic === 'function') { ic('reattach_activator'); ic('update', w.intercomSettings) } else { const d = document; const i = function () { i.c(arguments) }; i.q = []; i.c = function (args) { i.q.push(args) }; w.Intercom = i; const l = function () { const s = d.createElement('script'); s.type = 'text/javascript'; s.async = true; s.src = 'https://widget.intercom.io/widget/' + encodeURIComponent(settings.intercom_app_id); const x = d.getElementsByTagName('script')[0]; x?.parentNode?.insertBefore?.(s, x) }; if (document.readyState === 'complete') { l() } else if (w.attachEvent) { w.attachEvent('onload', l) } else { w.addEventListener('load', l, false) } } })()
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.text = func
      script.id = 'intercom_widget'
      document.body.appendChild(script)
      hideAssistantIntercomMessenger()
    }
  }

  const getIntercomHash = async ({ userId, token }) => {
    if (!userId || !token) return null
    try {
      const req = await fetch(`${settings.api.url}/${settings.api.version}/system/integrations/intercom/hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_email: userId })
      })
      const { error, result } = await req.json()
      const userHash = error ? null : result?.intercom_hash
      if (userHash) {
        setIntercomSettings({ user_hash: userHash })
      }
    } catch {
      return null
    }
  }

  const removeIntercom = () => {
    // Remove Intercom script
    const intercomScript = document.getElementById('intercom_widget')
    if (intercomScript) {
      intercomScript.remove()
    }

    // Remove Intercom elements
    const intercomElements = document.querySelectorAll('.intercom-lightweight-app, #intercom-container, iframe[name="intercom-launcher-frame"]')
    intercomElements.forEach(element => {
      if (element) {
        element.remove()
      }
    })

    // Clear Intercom from window object
    if (window.Intercom) {
      window.Intercom('shutdown')
      delete window.Intercom
    }
  }

  useEffect(() => {
    if (!settings.intercom_app_id || loadingConfigs || sessionLoading) return
    if (!auth || (user?.level !== 0 && configs?.ordering_support_widget?.value === '1')) {
      window?.Intercom?.('shutdown')
      removeIntercom()
    } else if (user?.level === 0) {
      setIntercomSettings(values, user)
      if (!window.document.getElementById('intercom_widget')) {
        addIntercomScript()
      }
    }
  }, [user, auth, loadingConfigs, sessionLoading])

  useEffect(() => {
    if (!settings.intercom_app_id || loadingConfigs || sessionLoading) return
    if (auth && (user?.level === 0 || configs?.ordering_support_widget?.value !== '1')) {
      getIntercomHash({ userId: user?.email, token })
    }
  }, [auth, user, loadingConfigs, sessionLoading])

  return <>{props.children}</>
}
