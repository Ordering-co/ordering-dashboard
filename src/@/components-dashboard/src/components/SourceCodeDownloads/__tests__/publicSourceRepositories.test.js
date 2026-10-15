import { describe, expect, it } from 'vitest'
import { PUBLIC_SOURCE_PRODUCTS, QUICKSTART_SETUP_PROMPT } from '../public-source-repositories'

// Exact public README prompts are a release contract, kept local for offline rendering.
const expectedProducts = [
  {
    id: 'ordering-dashboard',
    setupPath: 'setup.md',
    setupPrompt: 'Set up https://github.com/Ordering-co/ordering-dashboard.git locally. Read setup.md, reuse this checkout if it exists, help me confirm my Ordering project, then open the Dashboard and guide me through one simple visible edit.'
  },
  {
    id: 'website-marketplace',
    setupPath: 'setup.md',
    setupPrompt: 'Get https://github.com/Ordering-co/website-marketplace.git, reusing any existing checkout. Read setup.md and follow it to connect my confirmed Ordering project, start the marketplace, and show one simple visible edit. Preserve my changes.'
  },
  {
    id: 'ordering-app-marketplace',
    setupPath: 'setup.md',
    setupPrompt: 'Get https://github.com/Ordering-co/ordering-app-marketplace.git and read setup.md. Follow its instructions to configure my Ordering project, open the app locally, and verify my first visible edit through Fast Refresh.'
  },
  {
    id: 'ordering-app-business',
    setupPath: 'docs/onboarding.md',
    setupPrompt: 'Open https://github.com/Ordering-co/ordering-app-business.git and read docs/onboarding.md. Help me run Business App locally for my Ordering project, confirm the selected project on screen, and make one visible change.'
  },
  {
    id: 'ordering-app-driver',
    setupPath: 'docs/onboarding.md',
    setupPrompt: 'Open https://github.com/Ordering-co/ordering-app-driver.git and read docs/onboarding.md. Help me run Driver App locally for my Ordering project, confirm the selected project on screen, and make one visible change.'
  },
  {
    id: 'ordering-website-franchises',
    setupPath: 'setup.md',
    setupPrompt: 'Set up https://github.com/Ordering-co/ordering-website-franchises.git using setup.md. Reuse my checkout if available. Help me confirm my project and franchise, open the website, and make a first visible edit. Do not publish or deploy.'
  },
  {
    id: 'ordering-app-franchises',
    setupPath: 'setup.md',
    setupPrompt: 'Get https://github.com/Ordering-co/ordering-app-franchises.git and read setup.md. Follow its instructions to configure my Ordering project and explicitly chosen franchise, open the app locally, and verify my first visible edit through Fast Refresh.'
  }
]

describe('public product setup contract', () => {
  it.each(expectedProducts)('keeps the published README prompt and actual runbook for $id', expected => {
    const product = PUBLIC_SOURCE_PRODUCTS.find(product => product.id === expected.id)
    expect(product.setupPrompt).toBe(expected.setupPrompt)
    expect(product.setupUrl).toBe(`https://github.com/Ordering-co/${expected.id}/blob/main/${expected.setupPath}`)
    expect(product.setupPrompt).toContain(`https://github.com/Ordering-co/${expected.id}.git`)
    expect(product.setupPrompt).toContain(expected.setupPath)
  })

  it('uses the canonical connection prompt while preserving existing changes', () => {
    expect(QUICKSTART_SETUP_PROMPT).toBe('Connect me to Ordering.co: get or safely update https://github.com/Ordering-co/ordering-dev-quickstart in ~/ordering-dev-quickstart, preserving my existing changes. Read SETUP.md and follow it step by step.')
  })
})
