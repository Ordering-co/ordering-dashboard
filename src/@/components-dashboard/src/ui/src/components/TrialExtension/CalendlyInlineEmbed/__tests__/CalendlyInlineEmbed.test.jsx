/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { CalendlyInlineEmbed } from '..'

const EMBED_URL = 'https://calendly.com/orderingteam/ordering-demo?embed_domain=localhost&embed_type=Inline'
const FALLBACK_URL = 'https://calendly.com/orderingteam/ordering-demo'

const dispatchCalendlyMessage = (iframeWindow, data) => {
  const event = new MessageEvent('message', { origin: 'https://calendly.com', source: iframeWindow, data })
  fireEvent(window, event)
}

const getIframeWindow = (container) => container.querySelector('iframe').contentWindow

describe('CalendlyInlineEmbed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the iframe with a title and the embed url', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('src')).toBe(EMBED_URL)
    expect(iframe.getAttribute('title')).toBe('Book a call with our team')
  })

  it('always shows a secondary "open in a new tab" link to the fallback url', () => {
    renderWithProviders(<CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />)
    const link = screen.getByText('Open in a new tab')
    expect(link.getAttribute('href')).toBe(FALLBACK_URL)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('shows a loading status until Calendly reports the page height', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading the calendar…')

    fireEvent(window, new MessageEvent('message', {
      origin: 'https://calendly.com',
      source: getIframeWindow(container),
      data: { event: 'calendly.page_height', payload: { height: '711px' } }
    }))

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ignores postMessage events from other origins or windows', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    fireEvent(window, new MessageEvent('message', {
      origin: 'https://evil.example',
      source: getIframeWindow(container),
      data: { event: 'calendly.page_height', payload: { height: '711px' } }
    }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent(window, new MessageEvent('message', {
      origin: 'https://calendly.com',
      source: {},
      data: { event: 'calendly.page_height', payload: { height: '711px' } }
    }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('marks itself loaded on calendly.event_type_viewed even without a height yet', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    dispatchCalendlyMessage(getIframeWindow(container), { event: 'calendly.event_type_viewed' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('calls onScheduled once when calendly.event_scheduled fires, even if it fires twice', () => {
    const onScheduled = vi.fn()
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} onScheduled={onScheduled} />
    )
    const payload = { event: { uri: 'https://api.calendly.com/scheduled_events/123' } }
    dispatchCalendlyMessage(getIframeWindow(container), { event: 'calendly.event_scheduled', payload })
    dispatchCalendlyMessage(getIframeWindow(container), { event: 'calendly.event_scheduled', payload })

    expect(onScheduled).toHaveBeenCalledTimes(1)
    expect(onScheduled).toHaveBeenCalledWith(payload)
  })

  it('shows a prominent fallback link after a 12s load timeout', () => {
    renderWithProviders(<CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />)
    expect(screen.queryByRole('alert')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(12000)
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    const prominentLink = screen.getByText('Open the calendar in a new tab')
    expect(prominentLink.getAttribute('href')).toBe(FALLBACK_URL)
    expect(prominentLink.getAttribute('target')).toBe('_blank')
  })

  it('does not fail after the timeout once the embed already loaded', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    dispatchCalendlyMessage(getIframeWindow(container), { event: 'calendly.event_type_viewed' })

    act(() => {
      vi.advanceTimersByTime(12000)
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('clears the error notice when Calendly answers after the 12s timeout', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    act(() => {
      vi.advanceTimersByTime(12000)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    dispatchCalendlyMessage(getIframeWindow(container), { event: 'calendly.page_height', payload: { height: '711px' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('clears the error notice on a late calendly.event_type_viewed too', () => {
    const { container } = renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />
    )
    act(() => {
      vi.advanceTimersByTime(12000)
    })
    dispatchCalendlyMessage(getIframeWindow(container), { event: 'calendly.event_type_viewed' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not offer "I\'ve booked my call" until the calendar is opened in a new tab', () => {
    renderWithProviders(<CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />)
    expect(screen.queryByRole('button', { name: "I've booked my call" })).toBeNull()
  })

  it('offers "I\'ve booked my call" after the prominent fallback link is used, calling onScheduled once', () => {
    const onScheduled = vi.fn()
    renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} onScheduled={onScheduled} />
    )
    act(() => {
      vi.advanceTimersByTime(12000)
    })

    fireEvent.click(screen.getByText('Open the calendar in a new tab'))
    const bookedButton = screen.getByRole('button', { name: "I've booked my call" })

    fireEvent.click(bookedButton)
    fireEvent.click(bookedButton)
    expect(onScheduled).toHaveBeenCalledTimes(1)
  })

  it('offers "I\'ve booked my call" after the secondary new-tab link is used', () => {
    const onScheduled = vi.fn()
    renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} onScheduled={onScheduled} />
    )
    fireEvent.click(screen.getByText('Open in a new tab'))
    fireEvent.click(screen.getByRole('button', { name: "I've booked my call" }))
    expect(onScheduled).toHaveBeenCalledTimes(1)
  })

  it('offers "I\'ve booked my call" after a middle click (auxclick) on the new-tab link, only once', () => {
    const onScheduled = vi.fn()
    renderWithProviders(
      <CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} onScheduled={onScheduled} />
    )
    const link = screen.getByText('Open in a new tab')
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))

    expect(screen.getAllByRole('button', { name: "I've booked my call" })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: "I've booked my call" }))
    expect(onScheduled).toHaveBeenCalledTimes(1)
  })

  it('offers "I\'ve booked my call" after a middle click on the prominent fallback link', () => {
    renderWithProviders(<CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />)
    act(() => {
      vi.advanceTimersByTime(12000)
    })
    fireEvent(screen.getByText('Open the calendar in a new tab'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(screen.getByRole('button', { name: "I've booked my call" })).toBeInTheDocument()
  })

  it('offers "I\'ve booked my call" when the new-tab link\'s context menu opens', () => {
    renderWithProviders(<CalendlyInlineEmbed embedUrl={EMBED_URL} fallbackUrl={FALLBACK_URL} />)
    fireEvent.contextMenu(screen.getByText('Open in a new tab'))
    expect(screen.getByRole('button', { name: "I've booked my call" })).toBeInTheDocument()
  })
})
