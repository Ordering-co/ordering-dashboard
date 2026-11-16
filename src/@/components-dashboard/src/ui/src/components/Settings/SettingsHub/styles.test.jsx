import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'

import { HubPage, ListColumn } from './styles'

describe('SettingsHub layout styles', () => {
  it('fits the hub to the window below the shell notices so Chrome cannot scroll the title away and no blank band is left', () => {
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

      // The shell has no fixed 65px header any more: the only room above the layout is the notices (SidebarNav publishes it).
      expect(css).not.toContain('65px')
      expect(css).toContain('height:calc(100vh - var(--odc-shell-notice-block,0px))')
      expect(css).toContain('height:calc(100dvh - var(--odc-shell-notice-block,0px))')
      expect(css).toContain('max-height:calc(100vh - var(--odc-shell-notice-block,0px))')
      expect(css).toContain('max-height:calc(100dvh - var(--odc-shell-notice-block,0px))')
      expect(css).toContain('overflow:clip')
      expect(css).toContain('overflow-anchor:none')
      expect(css).toContain('min-width:0')
    } finally {
      sheet.seal()
    }
  })
})
