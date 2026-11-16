import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { flushSync } from 'react-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({ activeDialog: false, width: 1200 }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: runtime.width, height: 800 })
}))

vi.mock('./dialog-layer', async importOriginal => ({
  ...await importOriginal(),
  hasActiveDialogLayer: () => runtime.activeDialog
}))

import { SideBar } from './SideBar'

const currentTheme = createDashboardTheme(theme)
const renderSidebar = content => render(<ThemeProvider theme={currentTheme}>{content}</ThemeProvider>)

afterEach(() => {
  runtime.activeDialog = false
  runtime.width = 1200
})

describe('Ordering nonmodal SideBar owner', () => {
  it('closes a newly mounted open sidebar with the viewport fallback and preserves the listener snapshot', async () => {
    const onClose = vi.fn()
    runtime.width = undefined
    const { rerender } = renderSidebar(<SideBar open={false} onClose={onClose}>Panel</SideBar>)
    runtime.width = 1200
    rerender(<ThemeProvider theme={currentTheme}><SideBar open onClose={onClose}>Panel</SideBar></ThemeProvider>)
    runtime.width = 500
    rerender(<ThemeProvider theme={currentTheme}><SideBar open onClose={onClose}>Panel</SideBar></ThemeProvider>)

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()

    const firstMountClose = vi.fn()
    runtime.width = undefined
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    renderSidebar(<SideBar open onClose={firstMountClose}>Initially open</SideBar>)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(firstMountClose).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByText('Initially open').closest('.od-sidebar')).toBeInTheDocument())
  })

  it('dismisses equal-z siblings and nested sidebars one visible layer at a time', () => {
    const Harness = () => {
      const [first, setFirst] = useState(true)
      const [second, setSecond] = useState(true)
      return (
        <>
          {first && <SideBar open sidebarId='first-sidebar' onClose={() => setFirst(false)}>First sidebar</SideBar>}
          {second && <SideBar open sidebarId='second-sidebar' onClose={() => flushSync(() => setSecond(false))}>Second sidebar</SideBar>}
        </>
      )
    }
    const { unmount } = renderSidebar(<Harness />)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByText('Second sidebar')).not.toBeInTheDocument()
    expect(screen.getByText('First sidebar')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByText('First sidebar')).not.toBeInTheDocument()
    unmount()

    const NestedHarness = () => {
      const [parent, setParent] = useState(true)
      const [child, setChild] = useState(true)
      return parent && (
        <SideBar open sidebarId='parent-sidebar' onClose={() => setParent(false)}>
          Parent sidebar
          {child && <SideBar open sidebarId='child-sidebar' onClose={() => setChild(false)}>Child sidebar</SideBar>}
        </SideBar>
      )
    }
    renderSidebar(<NestedHarness />)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByText('Child sidebar')).not.toBeInTheDocument()
    expect(screen.getByText('Parent sidebar')).toBeInTheDocument()
  })

  it('blocks dismissal behind an active dialog and preserves outside-click exclusions', () => {
    const onClose = vi.fn()
    const container = document.createElement('button')
    const setting = document.createElement('button')
    const outside = document.createElement('button')
    document.body.append(container, setting, outside)
    renderSidebar(
      <SideBar
        open
        isCloseOutsideClick
        containerRef={{ current: container }}
        sidebarSettingContainer={{ current: setting }}
        onClose={onClose}
      >
        Protected panel
      </SideBar>
    )

    runtime.activeDialog = true
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    fireEvent.click(outside)
    expect(onClose).not.toHaveBeenCalled()
    outside.onclick = () => { runtime.activeDialog = false }
    fireEvent.click(outside)
    expect(onClose).not.toHaveBeenCalled()
    runtime.activeDialog = false
    fireEvent.click(container)
    fireEvent.click(setting)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(outside)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps width persistence, expansion actions, ids and implicit button types', async () => {
    const onClose = vi.fn()
    const { rerender } = renderSidebar(
      <SideBar open sidebarId='fixture-sidebar' defaultSideBarWidth={500} showExpandIcon onClose={onClose}>
        Width panel
      </SideBar>
    )
    const panel = document.getElementById('fixture-sidebar')
    await waitFor(() => expect(panel).toHaveStyle({ width: '500px' }))
    const expand = screen.getByRole('button', { name: 'Click to expand' })
    const close = screen.getByRole('button', { name: 'Close' })
    for (const button of [expand, close]) {
      expect(button).not.toHaveAttribute('type')
      expect(button.type).toBe('submit')
    }
    fireEvent.click(expand)
    expect(panel).toHaveStyle({ width: 'var(--app-width, 100vw)' })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(panel).toHaveStyle({ width: '500px' })

    rerender(
      <ThemeProvider theme={currentTheme}>
        <SideBar open={false} sidebarId='fixture-sidebar' defaultSideBarWidth={500} showExpandIcon onClose={onClose}>Width panel</SideBar>
      </ThemeProvider>
    )
    // (main): a sidebar that stays mounted hides when `open` turns false
    expect(panel).toHaveStyle({ width: '0px' })
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
