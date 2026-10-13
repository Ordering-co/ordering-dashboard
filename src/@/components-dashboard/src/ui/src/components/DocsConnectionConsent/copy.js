/**
 * Purpose-specific copy for the docs-connect consent page. `purpose` comes
 * from a whitelist (see DocsConnection/mode.js); anything else gets the docs
 * copy. Keys stay literal so `pnpm i18n:generate` can find them.
 */
export const getDocsConnectCopy = (purpose, t) => purpose === 'agent'
  ? {
      title: t('DOCS_CONNECT_PAGE_TITLE_AGENT', 'Connect your AI agent'),
      scope: t('DOCS_CONNECT_SCOPE_AGENT', 'Create an MCP key for your AI agent with the access you choose')
    }
  : {
      title: t('DOCS_CONNECT_PAGE_TITLE_DOCS', 'Connect to Ordering.co docs'),
      scope: t('DOCS_CONNECT_SCOPE_DOCS', 'Test API requests and manage your API keys with your current permissions')
    }

/** "docs.ordering.co · {project} · {email}", skipping the parts that are missing. */
export const getDocsConnectContext = (project, email) => ['docs.ordering.co', project, email]
  .filter(part => typeof part === 'string' && part.trim())
  .join(' · ')
