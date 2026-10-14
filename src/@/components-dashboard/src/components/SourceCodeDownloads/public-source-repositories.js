// Repository links refer to public sources; deployed versions require separate verification.
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
  repository('ordering-dashboard', 'Dashboard', 'web', { setupPath: 'setup.md' }),
  repository('website-marketplace', 'Website Marketplace', 'web', { setupPath: 'setup.md', submodules: true }),
  repository('ordering-app-marketplace', 'Customer App Marketplace', 'mobile', { submodules: true }),
  repository('ordering-app-business', 'Business App', 'mobile', { submodules: true }),
  repository('ordering-app-driver', 'Driver App', 'mobile', { submodules: true }),
  repository('ordering-website-franchises', 'Franchise Website', 'web', { setupPath: 'setup.md', submodules: true }),
  repository('ordering-app-franchises', 'Franchise App', 'mobile', { submodules: true })
])

export const PUBLIC_SOURCE_TOOLS = Object.freeze([
  repository('ordering-dev-quickstart', 'Developer Quickstart', 'tool', { setupPath: 'SETUP.md' }),
  repository('ordering-mcp-plugin', 'MCP plugin and skill', 'tool')
])

export const QUICKSTART_SETUP_PROMPT = 'Connect me to Ordering.co: clone https://github.com/Ordering-co/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.'
