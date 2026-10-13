import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { AssistantPanel, AssistantPage } from '../AssistantPanel'
import { useAssistantViewport } from '../../../hooks/useAssistantViewport'
import { getAssistantOffset } from '../../../utils/assistantDock'
import { setAssistantIntercomHidden } from '../../../utils/assistantIntercom'
import { setIntercomSettings } from '~/components/Utils'
import { InfoShareProvider, useInfoShare } from '../../../contexts/InfoShareContext'

const assistant = vi.hoisted(() => ({
  isAllowed: true,
  isAvailable: true,
  isOpen: true,
  status: {},
  items: [],
  setOpen: vi.fn()
}))

vi.mock('../../../../../index', () => ({
  useAssistant: () => assistant,
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../AssistantChat', () => ({
  ASSISTANT_ROUTE: '/assistant',
  AssistantChat: () => <div>Chat</div>
}))

beforeEach(() => {
  assistant.isOpen = true
  assistant.isAllowed = true
  assistant.isAvailable = true
  assistant.setOpen.mockClear()
  window.Intercom = vi.fn()
  window.intercomSettings = { hide_default_launcher: false, hide_notifications: true }
  vi.stubGlobal('innerWidth', 390)
})

afterEach(() => {
  cleanup()
  setAssistantIntercomHidden(false)
  delete window.Intercom
  delete window.intercomSettings
  vi.unstubAllGlobals()
})

describe('assistant and support visibility', () => {
  it('keeps Intercom on the left through boot, identity updates, docking and closing', () => {
    assistant.isOpen = false
    setIntercomSettings({ email: 'demo@example.test', alignment: 'right', horizontal_padding: 400 })
    expect(window.Intercom).toHaveBeenLastCalledWith('boot', expect.objectContaining({ alignment: 'left', horizontal_padding: 20 }))
    vi.stubGlobal('innerWidth', 1600)
    const view = renderWithProviders(<AssistantPanel />, { theme })
    assistant.isOpen = true
    view.rerender(<AssistantPanel />)
    setIntercomSettings({ user_hash: 'test-hash' })
    expect(window.Intercom).toHaveBeenCalledWith('boot', expect.objectContaining({ alignment: 'left', horizontal_padding: 20, hide_default_launcher: true }))
    assistant.isOpen = false
    view.rerender(<AssistantPanel />)
    expect(window.intercomSettings).toMatchObject({ alignment: 'left', horizontal_padding: 20, hide_default_launcher: false })
    expect(window.Intercom).not.toHaveBeenCalledWith('update', { horizontal_padding: 400 })
  })

  it('hides support in a floating panel and restores the prior visibility on close', () => {
    const view = renderWithProviders(<AssistantPanel />, { theme })
    expect(window.Intercom).toHaveBeenCalledWith('hide')
    expect(window.intercomSettings).toMatchObject({ hide_default_launcher: true, hide_notifications: true })
    assistant.isOpen = false
    view.rerender(<AssistantPanel />)
    expect(window.Intercom).toHaveBeenLastCalledWith('update', { hide_default_launcher: false, hide_notifications: true })
  })

  it('keeps support hidden across dock breakpoints without visibility updates on every resize', () => {
    renderWithProviders(<AssistantPanel />, { theme })
    window.Intercom.mockClear()
    act(() => {
      window.innerWidth = 1200
      window.dispatchEvent(new Event('resize'))
    })
    expect(document.documentElement.style.getPropertyValue('--assistant-offset')).toBe('380px')
    expect(window.intercomSettings.hide_default_launcher).toBe(true)
    expect(window.Intercom).toHaveBeenCalledTimes(1)
    expect(window.Intercom).toHaveBeenCalledWith('update', { horizontal_padding: 400 })
    act(() => {
      window.innerWidth = 1300
      window.dispatchEvent(new Event('resize'))
    })
    expect(window.Intercom).toHaveBeenCalledTimes(1)
  })

  it('hides support on the full page even with the side panel closed, then restores on unmount', () => {
    assistant.isOpen = false
    const view = renderWithProviders(<><AssistantPage /><AssistantPanel /></>, { theme, initialEntries: ['/assistant'] })
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(window.Intercom).toHaveBeenCalledWith('hide')
    view.unmount()
    expect(window.intercomSettings.hide_default_launcher).toBe(false)
  })

  it('applies visibility when Intercom boots late and after its identity hash arrives', () => {
    delete window.Intercom
    renderWithProviders(<AssistantPanel />, { theme })
    window.Intercom = vi.fn()
    setIntercomSettings({ email: 'demo@example.test' })
    expect(window.Intercom).toHaveBeenCalledWith('boot', expect.objectContaining({ hide_default_launcher: true, hide_notifications: true }))
    setIntercomSettings({ user_hash: 'test-hash' })
    expect(window.Intercom).toHaveBeenLastCalledWith('hide')
    expect(window.intercomSettings).toMatchObject({ user_hash: 'test-hash', hide_default_launcher: true })
  })
})

describe('assistant launcher', () => {
  it.each([320, 390, 900, 1600])('opens Mia and returns after closing at %ipx', (width) => {
    vi.stubGlobal('innerWidth', width)
    assistant.isOpen = false
    const view = renderWithProviders(<AssistantPanel />, { theme })
    fireEvent.click(screen.getByRole('button', { name: 'Mia' }))
    expect(assistant.setOpen).toHaveBeenCalledWith(true)
    assistant.isOpen = true
    view.rerender(<AssistantPanel />)
    expect(screen.queryByRole('button', { name: 'Mia' })).toBeNull()
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }))
    expect(assistant.setOpen).toHaveBeenLastCalledWith(false)
    assistant.isOpen = false
    view.rerender(<AssistantPanel />)
    expect(screen.getByRole('button', { name: 'Mia' })).toBeInTheDocument()
  })

  it('does not show a launcher for unavailable projects or on the full page', () => {
    assistant.isOpen = false
    assistant.isAvailable = false
    const view = renderWithProviders(<AssistantPanel />, { theme })
    expect(screen.queryByRole('button', { name: 'Mia' })).toBeNull()
    view.unmount()
    assistant.isAvailable = true
    renderWithProviders(<AssistantPanel />, { theme, initialEntries: ['/assistant'] })
    expect(screen.queryByRole('button', { name: 'Mia' })).toBeNull()
  })
})

const MenuState = () => {
  const [{ isCollapse }] = useInfoShare()
  return <output data-testid='menu-state'>{isCollapse ? 'closed' : 'open'}</output>
}

describe('maximizing the assistant from the navigation menu', () => {
  it.each([390, 767, 768, 1600])('handles the open menu at %ipx and preserves the return route', (width) => {
    vi.stubGlobal('innerWidth', width)
    window.history.replaceState(null, '', '/orders?status=in_progress')
    renderWithProviders(
      <InfoShareProvider>
        <MenuState />
        <AssistantPanel />
        <Route path='/assistant'><AssistantPage /></Route>
        <Route path='/orders'><div>Orders page</div></Route>
      </InfoShareProvider>,
      { theme, initialEntries: ['/orders?status=in_progress'] }
    )
    expect(screen.getByTestId('menu-state')).toHaveTextContent('open')
    fireEvent.click(screen.getByRole('button', { name: 'Open full page' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.getByTestId('menu-state')).toHaveTextContent(width < 768 ? 'closed' : 'open')
    expect(screen.queryByText('Orders page')).toBeNull()
    expect(getAssistantOffset()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Back to the side panel' }))
    expect(screen.getByText('Orders page')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    window.history.replaceState(null, '', '/')
  })
})

const Viewport = ({ fixed = true }) => {
  const ref = useAssistantViewport(true, fixed)
  return <div ref={ref} data-testid='viewport' />
}

describe('assistant visual viewport', () => {
  it('tracks keyboard resize and viewport pan, and cleans up listeners', () => {
    const viewport = new EventTarget()
    viewport.height = 700
    viewport.offsetTop = 0
    const remove = vi.spyOn(viewport, 'removeEventListener')
    vi.stubGlobal('visualViewport', viewport)
    const view = render(<Viewport />)
    const element = screen.getByTestId('viewport')
    expect(element.style.getPropertyValue('--assistant-viewport-height')).toBe('700px')
    act(() => {
      viewport.height = 320
      viewport.offsetTop = 35
      viewport.dispatchEvent(new Event('resize'))
      viewport.dispatchEvent(new Event('scroll'))
    })
    expect(element.style.getPropertyValue('--assistant-viewport-height')).toBe('320px')
    expect(element.style.getPropertyValue('--assistant-viewport-top')).toBe('35px')
    view.unmount()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('subtracts the page position and falls back to window height without VisualViewport', () => {
    vi.stubGlobal('visualViewport', undefined)
    vi.stubGlobal('innerHeight', 800)
    render(<Viewport fixed={false} />)
    const element = screen.getByTestId('viewport')
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: 70 })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(element.style.getPropertyValue('--assistant-viewport-height')).toBe('730px')
  })
})
