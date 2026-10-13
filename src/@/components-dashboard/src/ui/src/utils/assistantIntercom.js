let hidden = false
let previousVisibility = null

export const getAssistantIntercomSettings = (settings = {}) => ({
  ...settings,
  alignment: 'left',
  horizontal_padding: 20,
  ...(hidden ? { hide_default_launcher: true, hide_notifications: true } : {})
})

export const hideAssistantIntercomMessenger = () => {
  if (hidden && typeof window.Intercom === 'function') window.Intercom('hide')
}

export const setAssistantIntercomHidden = (next) => {
  if (hidden === next) return
  hidden = next
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
