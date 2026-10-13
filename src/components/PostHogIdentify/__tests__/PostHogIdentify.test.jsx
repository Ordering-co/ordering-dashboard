import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  configState: { configs: {} },
  projectStatus: { project: {}, plan: null },
  session: { auth: true, user: null },
  posthog: {
    __loaded: true,
    group: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    reset: vi.fn(),
    setPersonPropertiesForFlags: vi.fn()
  }
}))

vi.mock('posthog-js/react', () => ({
  usePostHog: () => mocks.posthog
}))

vi.mock('~components', () => ({
  useConfig: () => [mocks.configState],
  useSession: () => [mocks.session]
}))

vi.mock('~ui', async () => {
  const React = await import('react')
  return {
    ConfigFileContext: React.createContext(),
    useProjectState: () => [mocks.projectStatus]
  }
})

import { ConfigFileContext } from '~ui'
import { PostHogIdentify } from '..'

const user = {
  id: 7,
  email: 'owner@example.com',
  name: 'Ada',
  lastname: 'Lovelace',
  cellphone: '5551234',
  country_phone_code: '+1',
  level: 0,
  created_at: '2024-01-02T03:04:05Z',
  user_system_id: 99,
  email_verified: true,
  language_id: 1
}

const renderIdentify = (config = { project: 'orderingplus' }) => render(
  <ConfigFileContext.Provider value={[config, vi.fn()]}>
    <PostHogIdentify />
  </ConfigFileContext.Provider>
)

describe('PostHogIdentify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.session = { auth: true, user: { ...user } }
    mocks.projectStatus = { project: {}, plan: null }
    mocks.configState = { configs: {} }
  })

  it('identifies with the legacy user id and keeps project-code flags when project status is unavailable', async () => {
    renderIdentify()

    await waitFor(() => expect(mocks.posthog.identify).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({
        email: 'owner@example.com',
        dashboard_user_id: 7,
        user_level: 0,
        project_code: 'orderingplus'
      })
    ))
    expect(mocks.posthog.setPersonPropertiesForFlags).toHaveBeenCalledWith({
      project_code: 'orderingplus'
    }, false)
    expect(mocks.posthog.group).not.toHaveBeenCalled()
  })

  it('restores the projects group and does not repeat calls for replacement objects with unchanged scalar values', async () => {
    mocks.projectStatus = {
      project: {
        id: 12,
        code: 'demo',
        current_status: 'active',
        project_current_status_until: '2026-12-31'
      },
      plan: { id: 401 }
    }
    mocks.configState = {
      configs: {
        addon_connect: { value: '1' },
        addon_disabled: { value: '0' }
      }
    }

    const view = renderIdentify({ project: 'fallback' })

    await waitFor(() => expect(mocks.posthog.group).toHaveBeenCalledWith(
      'projects',
      'demo (12)',
      expect.objectContaining({
        project_code: 'demo',
        project_plan: 401,
        project_addons: ['addon_connect']
      })
    ))
    expect(mocks.posthog.identify).toHaveBeenCalledTimes(1)
    expect(mocks.posthog.group).toHaveBeenCalledTimes(1)

    mocks.session = { auth: true, user: { ...user } }
    mocks.projectStatus = {
      project: { ...mocks.projectStatus.project },
      plan: { id: 401 }
    }
    mocks.configState = {
      configs: {
        addon_connect: { value: '1' },
        addon_disabled: { value: '0' }
      }
    }
    view.rerender(
      <ConfigFileContext.Provider value={[{ project: 'fallback' }, vi.fn()]}>
        <PostHogIdentify />
      </ConfigFileContext.Provider>
    )

    expect(mocks.posthog.identify).toHaveBeenCalledTimes(1)
    expect(mocks.posthog.group).toHaveBeenCalledTimes(1)
  })
})
