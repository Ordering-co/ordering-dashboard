import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'

import {
  SidebarContainer,
  SidebarContent,
  SidebarInnerContainer,
  SidebarMainContent,
  UserInfo
} from './styles'

describe('SidebarMenu layout styles', () => {
  it('keeps the desktop sidebar from growing a horizontal scrollbar', () => {
    const sheet = new ServerStyleSheet()

    try {
      renderToString(
        sheet.collectStyles(
          <ThemeProvider theme={{ colors: { backgroundPage: '#fff', borderColor: '#ddd' } }}>
            <SidebarContainer isCollapse={false}>
              <SidebarInnerContainer />
            </SidebarContainer>
          </ThemeProvider>
        )
      )

      const css = sheet.getStyleTags()

      expect(css).toContain('@media (min-width:768px)')
      expect(css).toContain('position:sticky')
      expect(css).toContain('top:0')
      expect(css).toContain('align-self:flex-start')
      expect(css).toContain('overflow-x:hidden')
    } finally {
      sheet.seal()
    }
  })

  it('keeps the footer visible while only the navigation section scrolls', () => {
    const sheet = new ServerStyleSheet()

    try {
      renderToString(
        sheet.collectStyles(
          <ThemeProvider theme={{ colors: { borderColor: '#ddd' } }}>
            <SidebarMainContent>
              <SidebarContent />
              <UserInfo />
            </SidebarMainContent>
          </ThemeProvider>
        )
      )

      const css = sheet.getStyleTags()

      expect(css).toContain('min-height:0')
      expect(css).toContain('overflow:hidden')
      expect(css).toContain('overflow-y:auto')
      expect(css).toContain('flex-shrink:0')
      expect(css).toContain('@media (max-height:520px)')
      expect(css).toContain('overflow-y:visible')
    } finally {
      sheet.seal()
    }
  })
})
