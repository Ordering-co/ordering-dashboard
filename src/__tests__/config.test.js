import { afterEach, describe, expect, it } from 'vitest'

describe('config merge', () => {
  afterEach(() => {
    delete window.__CONFIG__
    // Force module re-evaluation on next import is awkward with ESM cache;
    // assert against the already-loaded default for the static shape.
  })

  it('exports merged api and socket settings from config.json', async () => {
    const { default: settings } = await import('~/config')
    expect(settings.api).toBeTruthy()
    expect(settings.socket).toBeTruthy()
    expect(settings.project).toBeTruthy()
  })
  it('ships the trial-extension offer enabled', async () => {
    const { default: baseConfig } = await import('~/config.json')
    expect(baseConfig.trial_extension).toBeTruthy()
    expect(baseConfig.trial_extension.enabled).toBe(true)
    expect(baseConfig.is_white_label).toBe(false)
  })
})
