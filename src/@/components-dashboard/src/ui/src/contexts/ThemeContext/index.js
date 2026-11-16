import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createGlobalStyle, css, ThemeProvider as ThemeProviderStyled } from 'styled-components'

const GlobalStyle = createGlobalStyle`
  :root {
    ${props => props.theme.ordering && Object.entries(props.theme.ordering.css).map(([key, value]) => `${key}: ${value};`).join('\n')}
  }

  @media (min-width: 578px) {
    /** Mozilla scrollbar*/
    * {
      scrollbar-color: #CCC !important;
      scrollbar-width: thin !important;
    }

    /** Scrollbar for browser based on webkit */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-thumb {
      background: #CCCCCC;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #AFAFAF;
    }
    ::-webkit-scrollbar-thumb:active {
      background: #6b6b6b;
    }
    ::-webkit-scrollbar-track {
      background: rgba(204, 204, 204, 0.3);
    }
  }

  /**
   * Mirrors the Bootstrap 4.6 reboot, which production loads only incidentally
   * through three feature components of the ~ui barrel. Values are identical, so
   * production does not change. Without it, converted <button>s render
   * 13.333px/normal and the brand harness measured something production never
   * paints (L7 independent review P2-1).
   */
  body {
    font-family: ${props => props.theme.fonts.primary?.family || `'${props.theme.fonts.primary?.name || 'Helvetica'}', sans-serif`};
    margin: 0;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.5;
    text-align: left;
    background-color: ${props => props.theme.colors?.backgroundPage || '#FFFFFF'};
    color: ${props => props.theme.colors?.headingColor || '#000'};

    ${props => props.theme.rtl && css`
      direction: rtl;
    `}
  }

  input, button, select, optgroup, textarea {
    margin: 0;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  ${props => props.theme.ordering && css`
    code, pre, kbd, samp {
      font-family: ${props.theme.ordering.font.family.mono};
      font-variant-ligatures: ${props.theme.ordering.font.variant.monoLigatures};
    }
  `}

  * {
    box-sizing: border-box;
  }

  .popup-backdrop {
    background-color: rgba(0, 0, 0, 0.4);
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: var(--od-x-layer-overlay);
  }

  .modal-backdrop {
    display: none;
  }

  .popup-component {
    background-color: rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .ghostDragging {
    border-radius: 8px;
    background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
    box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid ${props => props.theme.colors?.borderColor};
    font-size: 14px;
    padding: 10px 19px;
    width: fit-content;
    min-width: 200px;
    font-size: 14px;
    position: fixed;
  }

  #___reactour {
    > div:first-child {
      opacity: 0.7;
      color: #000;
      z-index: calc(var(--od-x-layer-chrome) + 1000);
    }

    span[data-tour-elem=badge] {
      display: none;
    }
    div[data-tour-elem=controls] {
      display: none;
    }
  }
`

const getFontStylesId = name => `${name}-font-styles`

const getRemoteFontHref = fontFamily => `https://fonts.googleapis.com/css2?family=${fontFamily.name}:wght@${fontFamily.weights.join(';')}&display=swap`

/**
 * Create ThemeContext
 * Context to use theme on the app
 */
export const ThemeContext = createContext()

/**
 * Api provider to manage theme
 * @param {props} props
 */
export const ThemeProvider = ({ children, ...props }) => {
  const [theme, setTheme] = useState(props.theme)
  const managedFontStyles = useRef(new Map())

  useEffect(() => {
    const fonts = Object.entries(theme.fonts || {})
    fonts.forEach(([name, fontFamily]) => {
      const id = getFontStylesId(name)
      const previousManagedFont = managedFontStyles.current.get(id)
      const existingFont = window.document.getElementById(id)
      const managedFont = previousManagedFont === existingFont ? previousManagedFont : undefined
      const hasRemoteSource = !fontFamily.local && fontFamily.name && Array.isArray(fontFamily.weights) && fontFamily.weights.length > 0

      if (previousManagedFont && !managedFont) {
        previousManagedFont.remove()
        managedFontStyles.current.delete(id)
      }

      if (!hasRemoteSource) {
        managedFont?.remove()
        managedFontStyles.current.delete(id)
        return
      }

      // An existing element can be supplied by the host page. Only mutate and
      // remove links created by this provider so its cleanup cannot race with
      // another owner reusing the compatibility id.
      if (!managedFont && existingFont) return

      const font = managedFont || window.document.createElement('link')
      font.id = id
      font.rel = 'stylesheet'
      font.async = true
      font.defer = true
      const href = getRemoteFontHref(fontFamily)
      if (font.getAttribute('href') !== href) font.href = href

      if (!managedFont) window.document.body.appendChild(font)
      managedFontStyles.current.set(id, font)
    })

    const currentFontIds = new Set(fonts.map(([name]) => getFontStylesId(name)))
    managedFontStyles.current.forEach((font, id) => {
      if (currentFontIds.has(id)) return
      font.remove()
      managedFontStyles.current.delete(id)
    })
  }, [theme.fonts])

  useEffect(() => () => {
    managedFontStyles.current.forEach(font => font.remove())
    managedFontStyles.current.clear()
  }, [])

  const update = (theme) => {
    setTheme(theme)
  }

  const merge = (partTheme) => {
    setTheme(currentTheme => ({
      ...currentTheme,
      ...partTheme
    }))
  }

  return (
    <ThemeContext.Provider value={[theme, { update, merge }]}>
      <ThemeProviderStyled theme={theme}>
        <GlobalStyle />
        {children}
      </ThemeProviderStyled>
    </ThemeContext.Provider>
  )
}

/**
 * Hook to get theme state
 */
export const useTheme = () => {
  const themeManager = useContext(ThemeContext)
  return themeManager || [{}]
}
