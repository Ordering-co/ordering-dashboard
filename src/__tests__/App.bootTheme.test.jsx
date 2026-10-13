import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useDashboardBootReveal } from '../utils/useDashboardBootReveal'

const defaultTheme = {
  colors: {
    primary: '#2C7BE5',
    headingColor: '#344050'
  }
}

describe('useDashboardBootReveal', () => {
  it('keeps the skeleton while configs are loading', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useDashboardBootReveal({
      sessionLoading: false,
      configLoading: true,
      configs: {},
      theme: defaultTheme,
      update
    }))

    expect(result.current).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('applies tenant primary before revealing', () => {
    const update = vi.fn()
    const { rerender, result } = renderHook(
      ({ configLoading, configs, theme }) => useDashboardBootReveal({
        sessionLoading: false,
        configLoading,
        configs,
        theme,
        update
      }),
      {
        initialProps: {
          configLoading: true,
          configs: {},
          theme: defaultTheme
        }
      }
    )

    expect(result.current).toBe(false)

    rerender({
      configLoading: false,
      configs: { dashboard_buttons_colors: { value: '#FF5500' } },
      theme: defaultTheme
    })

    expect(result.current).toBe(false)
    expect(update).toHaveBeenCalledWith({
      colors: {
        primary: '#FF5500',
        headingColor: '#344050'
      }
    })

    rerender({
      configLoading: false,
      configs: { dashboard_buttons_colors: { value: '#FF5500' } },
      theme: update.mock.calls[0][0]
    })

    expect(result.current).toBe(true)
  })

  it('reveals with the default primary when configs have no custom color', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useDashboardBootReveal({
      sessionLoading: false,
      configLoading: false,
      configs: {},
      theme: defaultTheme,
      update
    }))

    expect(result.current).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it('updates primary after reveal when configs change', () => {
    const update = vi.fn()
    const { rerender, result } = renderHook(
      ({ configs, theme }) => useDashboardBootReveal({
        sessionLoading: false,
        configLoading: false,
        configs,
        theme,
        update
      }),
      {
        initialProps: {
          configs: {},
          theme: defaultTheme
        }
      }
    )

    expect(result.current).toBe(true)

    rerender({
      configs: { dashboard_buttons_colors: { value: '#00AA88' } },
      theme: defaultTheme
    })

    expect(result.current).toBe(true)
    expect(update).toHaveBeenCalledWith({
      colors: {
        primary: '#00AA88',
        headingColor: '#344050'
      }
    })
  })
})
