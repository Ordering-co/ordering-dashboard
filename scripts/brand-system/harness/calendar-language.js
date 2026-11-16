import { useLanguage as useFixtureLanguage } from './language'

// Supply the real calendar's language.code contract without changing other fixtures.
export const useLanguage = () => {
  const [state, translate] = useFixtureLanguage()
  const code = new URLSearchParams(window.location.search).get('locale') || 'en'
  return [{ ...state, language: { code } }, translate]
}
