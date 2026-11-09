let accessAllowed = false
let accessIdentity = null

export const isIntercomAllowed = () => accessAllowed

export const isProjectIntercomAllowed = (projectStatus) => {
  return projectStatus?.intercomAllowed === true
}

export const clearIntercomSession = () => {
  window.Intercom?.('shutdown')
  delete window.Intercom
  delete window.intercomSettings
  document.querySelectorAll('#intercom_widget, script[src*="widget.intercom.io"], .intercom-lightweight-app, #intercom-container, iframe[name="intercom-launcher-frame"]').forEach(element => element.remove())
}

export const setIntercomAccess = (allowed, identity = null) => {
  if (accessAllowed === allowed && accessIdentity === identity) return
  accessAllowed = allowed
  accessIdentity = identity
  previousVisibility = null
  clearIntercomSession()
}

let hidden = false
let previousVisibility = null

export const getAssistantIntercomSettings = (settings = {}) => {
  if (hidden && !previousVisibility) {
    previousVisibility = {
      hide_default_launcher: settings.hide_default_launcher ?? false,
      hide_notifications: settings.hide_notifications ?? false
    }
  }
  return {
    ...settings,
    alignment: 'left',
    horizontal_padding: 20,
    ...(hidden ? { hide_default_launcher: true, hide_notifications: true } : {})
  }
}

export const hideAssistantIntercomMessenger = () => {
  if (accessAllowed && hidden && typeof window.Intercom === 'function') window.Intercom('hide')
}

export const setAssistantIntercomHidden = (next) => {
  if (hidden === next) return
  hidden = next
  if (!accessAllowed) {
    previousVisibility = null
    return
  }
  const settings = window.intercomSettings || {}
  if (hidden) {
    previousVisibility = {
      hide_default_launcher: settings.hide_default_launcher ?? false,
      hide_notifications: settings.hide_notifications ?? false
    }
  }
  const visibility = hidden
    ? { hide_default_launcher: true, hide_notifications: true }
    : previousVisibility
  window.intercomSettings = { ...settings, ...visibility }
  if (typeof window.Intercom === 'function') window.Intercom('update', visibility)
  hideAssistantIntercomMessenger()
  if (!hidden) previousVisibility = null
}
