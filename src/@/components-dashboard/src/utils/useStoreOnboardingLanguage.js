import { useCallback, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import copy from 'virtual:store-onboarding-translations'

export const useStoreOnboardingLanguage = () => {
  const [language, t] = useLanguage()
  const current = useRef({ language, t }); current.current = { language, t }
  const translate = useCallback((key, fallback) => current.current.t(key, copy[key]?.[current.current.language?.language?.code] || fallback), [])
  return [language, translate]
}
