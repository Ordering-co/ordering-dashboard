import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'

import { HubPage, ListColumn } from './styles'

describe('SettingsHub layout styles', () => {
  it('fits the hub under the fixed header so Chrome cannot scroll the title away', () => {
    const sheet = new ServerStyleSheet()

    try {
      renderToString(
        sheet.collectStyles(
          <ThemeProvider theme={{ colors: { backgroundPage: '#fff' } }}>
            <HubPage>
              <ListColumn />
            </HubPage>
          </ThemeProvider>
        )
      )

      const css = sheet.getStyleTags()

      expect(css).toContain('height:calc(100vh - 65px)')
      expect(css).toContain('max-height:calc(100vh - 65px)')
      expect(css).toContain('overflow:clip')
      expect(css).toContain('overflow-anchor:none')
      expect(css).toContain('min-width:0')
    } finally {
      sheet.seal()
    }
  })
})
