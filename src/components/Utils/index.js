import settings from '../../config'
import { getAssistantIntercomSettings, hideAssistantIntercomMessenger, isIntercomAllowed } from '../../@/components-dashboard/src/ui/src/utils/assistantIntercom'

export const setIntercomSettings = (values, user) => {
  if (!isIntercomAllowed() || String(values?.project_plan) === '581') return
  let _settings = { ...window.intercomSettings, ...values }
  if (user) {
    _settings = {
      ..._settings,
      ...(user?.user_system_id
        ? {
            billing_user_id: user?.user_system_id,
            is_billing_user: !!user?.user_system_id
          }
        : {}),
      dashboard_user_id: user?.id,
      created_at: user?.created_at,
      email_verified: user?.email_verified,
      language_id: user?.language_id,
      level: user?.level
    }
  }
  window.intercomSettings = getAssistantIntercomSettings(_settings)
  if (typeof _settings.user_hash === 'string' && _settings.user_hash.trim()) {
    window?.Intercom?.('boot', window.intercomSettings)
    hideAssistantIntercomMessenger()
  }
}

export const getIntercomHash = async ({ userId, token }) => {
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
    if (!req.ok) return null
    const { error, result } = await req.json()
    const userHash = !error && typeof result?.intercom_hash === 'string' && result.intercom_hash.trim() ? result.intercom_hash : null
    return userHash
  } catch {
    return null
  }
}
