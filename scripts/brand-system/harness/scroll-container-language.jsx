// AutoScroll reads the dashboard ThemeContext; the harness owns only a styled theme.
import { useTheme as useStyledTheme } from 'styled-components'
import { useLanguage as useBaseLanguage } from './language'

export const useTheme = () => [useStyledTheme()]
export const useLanguage = () => useBaseLanguage()
