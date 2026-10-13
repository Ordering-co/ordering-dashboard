// Levels the API accepts on /users/me but the dashboard never allowed at boot
export const SESSION_CHECK_REJECTED_LEVELS = [6, 7]

// apiv4 `messages.trial_expire` (lang/en and lang/es; other locales fall back to en)
const PROJECT_INACTIVE_MESSAGES = [
  'Your project is not active, please pay your invoice or contact the Ordering.co sales team for assistance.',
  'Su proyecto no está activo, pague su factura o póngase en contacto con el equipo de ventas de Ordering.co para obtener ayuda.'
]

export const getSessionCheckUrl = (root) => `${root}/users/me?params=id,level,enabled`

const isProjectInactiveMessage = (result) => {
  const messages = Array.isArray(result) ? result : [result]
  return messages.some(message => PROJECT_INACTIVE_MESSAGES.includes(message))
}

/**
 * Decide what to do with the stored session from the /users/me response.
 * Only a 401 or a rejected level ends the session; a server or network error keeps it.
 * @returns {'keep' | 'logout' | 'billing'}
 */
export const getSessionCheckAction = ({ status, content } = {}) => {
  if (status === 401) {
    return isProjectInactiveMessage(content?.result) ? 'billing' : 'logout'
  }
  if (status >= 200 && status < 300) {
    const level = content?.result?.level
    return SESSION_CHECK_REJECTED_LEVELS.includes(level) ? 'logout' : 'keep'
  }
  return 'keep'
}
