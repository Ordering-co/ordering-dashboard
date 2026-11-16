/* eslint-disable import/first */
import React, { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  hideToast: vi.fn(),
  toastConfig: null,
  subdomain: 'ordering'
}))

vi.mock('../../../../../index', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useApi: () => [null, { configurations: { subdomain: state.subdomain } }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useToast: () => [state.toastConfig, { hideToast: state.hideToast }]
}))

import { DisabledFeatureAlert } from './DisabledFeatureAlert'
import { NotFoundSource } from './NotFoundSource'
import { ProgressRing } from './ProgressRing'
import { SimpleSpinner } from './SimpleSpinner'
import { SpinnerLoader } from './SpinnerLoader'
import { Toast } from './Toast'
import * as disabledStyles from './disabled-feature-alert-styles'
import * as notFoundStyles from './not-found-source-styles'
import * as spinnerStyles from './spinner-loader-styles'

const theme = {
  rtl: false,
  colors: {
    backgroundPage: '#ffffff',
    borderColor: '#dedede',
    danger: '#bb2020',
    headingColor: '#111111',
    lightDanger: '#fff0f0',
    lightGreen: '#edfff5',
    lightPrimary: '#eef4ff',
    primary: '#125bd8',
    primaryContrast: '#ffffff',
    secundary: '#f5f5f5',
    secundaryContrast: '#555555',
    textBlackContrast: '#111111',
    warning: '#e59a00',
    warning100: '#fff5dc'
  },
  fonts: { primary: { family: 'Fixture Sans' } },
  images: {
    general: {
      notFound: '/not-found.svg'
    }
  },
  ordering: {
    semantic: {
      action: {
        default: '#266df0',
        foreground: '#ffffff',
        content: '#1f5fd1',
        hover: '#1f5fd1',
        soft: '#edf3ff',
        focus: '#266df0'
      },
      border: { default: '#dee0e3', strong: '#989aa0' },
      surface: { default: '#ffffff', subtle: '#f6f7f7', strong: '#0b0c0d' },
      text: { default: '#0b0c0d', muted: '#3f4145', subtle: '#707278', inverse: '#ffffff' },
      state: {
        danger: { signal: '#eb3b3b', functional: '#c92929', soft: '#fdebec' },
        success: { signal: '#00d17e', functional: '#0b0c0d', soft: '#e7f8f0' },
        warning: { signal: '#f5a300', functional: '#0b0c0d', soft: '#fff3d6' }
      }
    },
    component: {
      density: { compactControlHeight: '32px', iconSize: '16px', touchTargetMinimum: '44px' },
      focusRing: { width: '2px', offset: '2px' }
    },
    font: { family: { sans: 'Ordering Sans' }, size: { productContent: '14px', productUi: '13px' }, weight: { medium: 500 } },
    motion: { duration: { fast: '120ms', base: '180ms' }, easing: { standard: [0.32, 0.72, 0, 1] } },
    radius: { control: '4px', component: '6px', panel: '10px', round: '999px' },
    shadow: { 1: '0 1px 2px rgb(0 0 0 / 0.05)', 2: '0 12px 32px -20px rgb(0 0 0 / 0.26)' }
  }
}

const renderUI = node => render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)

beforeEach(() => {
  state.hideToast.mockReset()
  state.toastConfig = null
  state.subdomain = 'ordering'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Ordering.co feedback and loading owners', () => {
  it('keeps the empty-state image, heading, callback precedence and fixed identity', () => {
    const onClickButton = vi.fn()
    const { rerender } = renderUI(<NotFoundSource />)

    expect(screen.getByAltText('Not Found')).toHaveAttribute('src', '/not-found.svg')
    expect(document.getElementById('not-found-source')).toHaveClass('od-not-found-source')
    expect(screen.getByRole('heading')).toBeEmptyDOMElement()

    rerender(
      <ThemeProvider theme={theme}>
        <NotFoundSource content='No results' btnTitle='Retry' onClickButton={onClickButton}>
          <a href='/fallback'>Fallback action</a>
        </NotFoundSource>
      </ThemeProvider>
    )
    expect(screen.getByRole('heading', { name: 'No results' })).toBeInTheDocument()
    expect(screen.queryByText('Fallback action')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onClickButton).toHaveBeenCalledWith()
  })

  it('preserves raw ProgressRing geometry, labels, caller colors and root data', () => {
    renderUI(
      <ProgressRing
        data-testid='ring'
        className='consumer-ring'
        percent={125.6}
        size={70}
        lineWidth={8}
        progressColor='#123456'
        trackColor='#654321'
        caps='round'
        isShowPercent
        spin
        transitionDuration={200}
        percentColor='#abcdef'
        fontSize='15px'
      />
    )

    const radius = 31
    const length = radius * 2 * Math.PI
    const circles = document.querySelectorAll('circle')
    expect(screen.getByTestId('ring')).toHaveAttribute('role', 'img')
    expect(screen.getByTestId('ring')).toHaveClass('od-progress-ring', 'consumer-ring')
    expect(screen.getByTestId('ring')).toHaveAccessibleName('126%')
    expect(screen.getByTestId('ring')).toHaveStyle({ width: '70px', height: '70px' })
    expect(circles[0]).toHaveAttribute('r', String(radius))
    expect(circles[0]).toHaveAttribute('stroke', '#654321')
    expect(circles[1]).toHaveAttribute('stroke', '#123456')
    expect(circles[1]).toHaveAttribute('stroke-linecap', 'round')
    expect(circles[1]).toHaveAttribute('stroke-dasharray', String(length))
    expect(circles[1].style.strokeDashoffset).toBe(String(length * (1 - 125.6 / 100)))
    expect(circles[1].style.transition).toBe('200ms stroke-dashoffset')
    expect(screen.getByText('126%')).toHaveClass('od-progress-ring-label')
    expect(getComputedStyle(screen.getByTestId('ring')).getPropertyValue('--od-progress-ring-label-color')).toBe('#abcdef')
    expect(screen.getByTestId('ring').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('ring').querySelector('svg')).toHaveAttribute('data-spin', 'true')

    const { container } = renderUI(
      <ProgressRing percent={-25} size={80} lineWidth={8} progressColor='#123456' trackColor='#654321' isShowPercent fontSize={18} />
    )
    expect(container.querySelector('.od-progress-ring')).toHaveAccessibleName('-25%')
    expect(getComputedStyle(container.querySelector('.od-progress-ring')).getPropertyValue('--od-progress-ring-label-size')).toBe('18px')

    const decorative = renderUI(
      <ProgressRing data-testid='decorative-ring' percent={25} size={40} lineWidth={4} fontSize={0} />
    )
    expect(screen.getByTestId('decorative-ring')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('decorative-ring')).not.toHaveAttribute('role')
    expect(getComputedStyle(screen.getByTestId('decorative-ring')).getPropertyValue('--od-progress-ring-label-size')).toBe('14px')
    decorative.unmount()
  })

  it('keeps SimpleSpinner sizing hooks and gives SpinnerLoader one live status owner', () => {
    renderUI(
      <>
        <SimpleSpinner id='consumer-id' width='20px' height='22px' btc='#ff00aa' style={{ marginTop: '7px' }} />
        <SpinnerLoader primary content='Loading orders' logotype='/tenant-logo.svg' style={{ height: 90, width: 170 }} />
      </>
    )

    const simple = document.getElementById('loading')
    expect(simple).toHaveClass('od-simple-spinner')
    expect(simple).toHaveAttribute('aria-hidden', 'true')
    expect(simple).toHaveStyle({ marginTop: '7px' })
    expect(getComputedStyle(simple).getPropertyValue('--od-simple-spinner-width')).toBe('20px')
    expect(getComputedStyle(simple).getPropertyValue('--od-simple-spinner-height')).toBe('22px')
    expect(getComputedStyle(simple).getPropertyValue('--od-simple-spinner-color')).toBe('#ff00aa')

    const owner = screen.getByRole('status')
    expect(owner).toHaveAttribute('data-primary', 'true')
    expect(owner).toHaveAttribute('aria-live', 'polite')
    expect(owner).toHaveAttribute('aria-busy', 'true')
    expect(owner).toHaveStyle({ height: '90px', width: '170px' })
    expect(screen.getByText('Loading orders')).toBeInTheDocument()
    expect(screen.getByAltText('logo')).toHaveAttribute('src', '/tenant-logo.svg')
    expect(owner.querySelector('.spinner')).toHaveAttribute('aria-hidden', 'true')
    expect(owner.querySelector('.spinner-content')).toBeInTheDocument()
  })

  // tanda N: the message is text, never HTML. Some messages are API errors; no toast passes markup on purpose
  // (inventory in redesign/pages/bugs-n-toast-text/tracker.md)
  it('paints the message as text, so markup from the API never reaches the DOM', () => {
    // jsdom loads no images, so the guard is the DOM itself: no <img>, no <strong>, one text node
    state.toastConfig = { type: 'ERROR', message: '<img src=x onerror="alert(1)"><strong>Could not save</strong> &amp;', duration: 1000 }
    const { unmount } = renderUI(<Toast />)

    const toast = document.querySelector('.toast-bar')
    expect(toast.querySelector('img')).toBeNull()
    expect(toast.querySelector('strong')).toBeNull()
    expect(toast.childNodes).toHaveLength(1)
    expect(toast.firstChild.nodeType).toBe(Node.TEXT_NODE)
    expect(toast).toHaveTextContent('<img src=x onerror="alert(1)"><strong>Could not save</strong> &amp;')
    unmount()
  })

  // tanda O: a toast raised with no message (a catch passing err.message of nothing) must not read «undefined»
  it('reads «Error» when the message is undefined, and stays empty for null', () => {
    state.toastConfig = { type: 'ERROR', message: undefined, duration: 1000 }
    const { rerender, unmount } = renderUI(<Toast />)

    expect(document.querySelector('.toast-bar')).toHaveTextContent(/^Error$/)

    act(() => {
      state.toastConfig = { type: 'ERROR', message: null, duration: 1000 }
      rerender(<ThemeProvider theme={theme}><Toast /></ThemeProvider>)
    })
    expect(document.querySelector('.toast-bar')).toHaveTextContent(/^$/)
    unmount()
  })

  it('replaces toast DOM and timers while preserving message coercion', () => {
    vi.useFakeTimers()
    state.toastConfig = { type: 'ERROR', message: 'Could not save', duration: 1000 }
    const { rerender, unmount } = renderUI(<Toast />)

    let toast = document.querySelector('.toast-bar')
    expect(toast).toHaveAttribute('role', 'alert')
    expect(toast).toHaveAttribute('aria-live', 'assertive')
    expect(toast).toHaveTextContent('Could not save')
    expect(document.querySelectorAll('.toast-bar')).toHaveLength(1)

    act(() => {
      state.toastConfig = { type: 'SUCCESS', message: ['Saved', 'Again'], duration: 2000 }
      rerender(<ThemeProvider theme={theme}><Toast /></ThemeProvider>)
    })
    toast = document.querySelector('.toast-bar')
    expect(toast).toHaveAttribute('role', 'status')
    expect(toast).toHaveTextContent('Saved,Again')
    expect(document.querySelectorAll('.toast-bar')).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(state.hideToast).not.toHaveBeenCalled()
    expect(document.querySelector('.toast-bar')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(state.hideToast).toHaveBeenCalledOnce()
    expect(document.querySelector('.toast-bar')).not.toBeInTheDocument()

    act(() => {
      state.toastConfig = { type: 'SUCCESS', message: null, duration: 1000 }
      rerender(<ThemeProvider theme={theme}><Toast /></ThemeProvider>)
    })
    expect(document.querySelector('.toast-bar')).toHaveTextContent('')
    act(() => {
      state.toastConfig = { type: 'SUCCESS', message: 3, duration: 1000 }
      rerender(<ThemeProvider theme={theme}><Toast /></ThemeProvider>)
    })
    expect(document.querySelector('.toast-bar')).toHaveTextContent('3')

    state.hideToast.mockReset()
    state.toastConfig = { type: 'UNKNOWN', message: 'Unknown type', duration: 1000 }
    rerender(<ThemeProvider theme={theme}><Toast /></ThemeProvider>)
    expect(document.querySelector('.toast-bar')).toHaveAttribute('role', 'status')
    unmount()
    act(() => { vi.runAllTimers() })
    expect(state.hideToast).not.toHaveBeenCalled()
  })

  it('sends «Get this feature» to the Ordering.co pricing page when the project has no subdomain ()', () => {
    state.subdomain = undefined
    renderUI(<DisabledFeatureAlert />)
    const link = screen.getByRole('link', { name: 'Get this feature' })
    expect(link).toHaveAttribute('href', 'https://www.ordering.co/pricing/')
    expect(link.getAttribute('href')).not.toContain('undefined')
  })

  // redesign C: the notices (past due, websocket) and the offline state left Shared/UI for
  // components/Banners, components/WebsocketConnectionBanner and components/NotNetworkConnectivity (Product);
  // their own tests and components/__tests__/shellComponents.test.jsx cover them

  it('keeps public informational fallbacks responsive and theme-backed', () => {
    renderUI(<DisabledFeatureAlert />)
    const disabled = screen.getByRole('status')
    expect(disabled).toHaveAttribute('data-slot', 'disabled-feature-alert')
    expect(screen.getByRole('link', { name: 'Get this feature' })).toHaveAttribute(
      'href',
      'https://www.ordering.co/pricing/'
    )
    expect(screen.getByRole('link', { name: 'Get this feature' })).toHaveAttribute('target', '_blank')
    expect(getComputedStyle(disabled).getPropertyValue('--od-disabled-feature-soft')).toBe('#edf3ff')
    expect(getComputedStyle(disabled).getPropertyValue('--od-disabled-feature-focus-width')).toBe('2px')
    expect(getComputedStyle(disabled).getPropertyValue('--od-disabled-feature-focus-offset')).toBe('2px')

    // redesign NF: the 404 left Shared/UI for components/PageNotFound (Product); its own test covers it
  })

  it('preserves exported styled identities, polymorphism, refs and final attrs themes', () => {
    const ref = createRef()
    const dark = {
      ...theme,
      ordering: {
        ...theme.ordering,
        semantic: {
          ...theme.ordering.semantic,
          surface: { default: '#17181a', subtle: '#212224', strong: '#ffffff' },
          text: { default: '#ffffff', muted: '#c4c6ca', subtle: '#989aa0', inverse: '#0b0c0d' }
        }
      }
    }
    const Derived = styled(notFoundStyles.NotFound).attrs({ theme: dark })``

    renderUI(<Derived as='section' ref={ref} data-testid='derived' />)
    expect(ref.current.tagName).toBe('SECTION')
    expect(ref.current).toHaveClass('od-not-found-source')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-not-found-text')).toBe('#ffffff')

    for (const Component of [
      notFoundStyles.NotFound,
      notFoundStyles.NotFoundImage,
      spinnerStyles.Container,
      spinnerStyles.Logo,
      spinnerStyles.Content,
      spinnerStyles.Spinner,
      disabledStyles.DisabledFeatureAlertContainer,
      disabledStyles.Wrapper,
      disabledStyles.CommentContainer,
      disabledStyles.Comment,
      disabledStyles.MoreInfo
    ]) expect(Component).toHaveProperty('styledComponentId')
  })
})
