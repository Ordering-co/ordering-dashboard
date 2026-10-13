import { getLocalStorageItem } from '../@/components-dashboard/src/webStrategy'

export const getStoredLanguageCode = () => {
  const language = getLocalStorageItem('language', true)
  if (typeof language?.code === 'string' && language.code) return language.code

  language !== null && localStorage.removeItem('language')
  return 'en'
}

export const resolveInitialProject = ({
  auth,
  storedProject,
  settingsProject,
  useProjectDomain
} = {}) => {
  if (useProjectDomain && !auth) return null
  return storedProject || settingsProject || null
}
