// Repository links refer to public sources; deployed versions require separate verification.
// Setup prompts mirror the public READMEs; no release metadata is inferred.
const repository = (id, name, platform, options = {}) => {
  const url = `https://github.com/Ordering-co/${id}`
  return Object.freeze({
    id,
    name,
    platform,
    url,
    readmeUrl: `${url}/blob/main/README.md`,
    setupUrl: options.setupPath ? `${url}/blob/main/${options.setupPath}` : null,
    forkUrl: `${url}/fork`,
    cloneCommand: `git clone ${options.submodules ? '--recurse-submodules ' : ''}${url}.git`,
    ...options
  })
}

export const PUBLIC_SOURCE_PRODUCTS = Object.freeze([
  repository('ordering-dashboard', 'Dashboard', 'web', { setupPath: 'setup.md', setupPrompt: 'Set up https://github.com/Ordering-co/ordering-dashboard.git locally. Read setup.md, reuse this checkout if it exists, help me confirm my Ordering project, then open the Dashboard and guide me through one simple visible edit.' }),
  repository('website-marketplace', 'Website Marketplace', 'web', { setupPath: 'setup.md', submodules: true, setupPrompt: 'Get https://github.com/Ordering-co/website-marketplace.git, reusing any existing checkout. Read setup.md and follow it to connect my confirmed Ordering project, start the marketplace, and show one simple visible edit. Preserve my changes.' }),
  repository('ordering-app-marketplace', 'Customer App Marketplace', 'mobile', { setupPath: 'setup.md', submodules: true, setupPrompt: 'Get https://github.com/Ordering-co/ordering-app-marketplace.git and read setup.md. Follow its instructions to configure my Ordering project, open the app locally, and verify my first visible edit through Fast Refresh.' }),
  repository('ordering-app-business', 'Business App', 'mobile', { setupPath: 'docs/onboarding.md', submodules: true, setupPrompt: 'Open https://github.com/Ordering-co/ordering-app-business.git and read docs/onboarding.md. Help me run Business App locally for my Ordering project, confirm the selected project on screen, and make one visible change.' }),
  repository('ordering-app-driver', 'Driver App', 'mobile', { setupPath: 'docs/onboarding.md', submodules: true, setupPrompt: 'Open https://github.com/Ordering-co/ordering-app-driver.git and read docs/onboarding.md. Help me run Driver App locally for my Ordering project, confirm the selected project on screen, and make one visible change.' }),
  repository('ordering-website-franchises', 'Franchise Website', 'web', { setupPath: 'setup.md', submodules: true, setupPrompt: 'Set up https://github.com/Ordering-co/ordering-website-franchises.git using setup.md. Reuse my checkout if available. Help me confirm my project and franchise, open the website, and make a first visible edit. Do not publish or deploy.' }),
  repository('ordering-app-franchises', 'Franchise App', 'mobile', { setupPath: 'setup.md', submodules: true, setupPrompt: 'Get https://github.com/Ordering-co/ordering-app-franchises.git and read setup.md. Follow its instructions to configure my Ordering project and explicitly chosen franchise, open the app locally, and verify my first visible edit through Fast Refresh.' })
])

export const PUBLIC_SOURCE_TOOLS = Object.freeze([
  repository('ordering-dev-quickstart', 'Dev Quick Start', 'tool', { setupPath: 'SETUP.md' }),
  repository('ordering-mcp-plugin', 'MCP plugin and skill', 'tool')
])

export const QUICKSTART_SETUP_PROMPT = 'Connect me to Ordering.co: get or safely update https://github.com/Ordering-co/ordering-dev-quickstart in ~/ordering-dev-quickstart, preserving my existing changes. Read SETUP.md and follow it step by step.'
