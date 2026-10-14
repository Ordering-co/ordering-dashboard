import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { McpCopyButton } from './shared'
import { buildMcpSetupPrompt } from './setupPrompt'
import {
  MCP_ENV_VAR,
  MCP_SERVER_NAME,
  buildClaudeCodeCommand,
  buildClaudeCodeJson,
  buildCodexCommand,
  buildCodexToml,
  buildEnvExport
} from './utils'
import {
  CodeBlock,
  GuideTab,
  GuideTabs,
  GuideActions,
  Notice,
  OptionLabel,
  PromptRow,
  SetupSection,
  Steps
} from './styles'

const Code = ({ children }) => (
  <CodeBlock>
    <pre tabIndex={0}>{children}</pre>
    <McpCopyButton text={children} />
  </CodeBlock>
)

/**
 * Setup guide for Claude Code and Codex, with the project's MCP URL filled in.
 * The key is always read from an environment variable, never written in a config.
 */
export const McpSetupGuide = ({ status }) => {
  const [languageState, t] = useLanguage()
  const [client, setClient] = useState('claude')
  const url = status.url

  const envStep = (
    <li>
      <h3>{t('MCP_GUIDE_ENV_TITLE', 'Save your key in an environment variable')}</h3>
      <p>{t('MCP_PRIVATE_KEY_INPUT', 'Enter the key yourself at the hidden terminal prompt. Never put it in chat or command arguments. Start the client from that terminal.')}</p>
      <Code>{buildEnvExport()}</Code>
    </li>
  )

  const clients = {
    claude: (
      <Steps data-testid='mcp-guide-claude'>
        {envStep}
        <li>
          <h3>{t('MCP_GUIDE_ADD_SERVER_TITLE', 'Add the Ordering server')}</h3>
          <p>{t('MCP_GUIDE_CLAUDE_JSON_HELP', 'Create a .mcp.json file at the root of your project:')}</p>
          <Code>{buildClaudeCodeJson(url)}</Code>
          <OptionLabel>{t('MCP_GUIDE_CLAUDE_COMMAND_HELP', 'Or run this command in the project folder')}</OptionLabel>
          <Code>{buildClaudeCodeCommand(url)}</Code>
          <Notice $tone='info'>
            {t('MCP_GUIDE_CLAUDE_HEADER_WARNING', 'Do not paste the key itself in --header: it stays in your shell history. The single quotes keep _env_ as it is, and Claude Code reads the variable when it connects.').replace('_env_', `\${${MCP_ENV_VAR}}`)}
          </Notice>
        </li>
        <li>
          <h3>{t('MCP_GUIDE_CHECK_TITLE', 'Check the connection')}</h3>
          <p>
            {t('MCP_GUIDE_CLAUDE_CHECK_HELP', 'Start Claude Code in that folder, approve the _server_ server when it asks, and run /mcp. _server_ should show as connected.').replaceAll('_server_', MCP_SERVER_NAME)}
          </p>
        </li>
      </Steps>
    ),
    codex: (
      <Steps data-testid='mcp-guide-codex'>
        {envStep}
        <li>
          <h3>{t('MCP_GUIDE_ADD_SERVER_TITLE', 'Add the Ordering server')}</h3>
          <p>{t('MCP_GUIDE_CODEX_TOML_HELP', 'Add this to ~/.codex/config.toml (or to .codex/config.toml in a trusted project):')}</p>
          <Code>{buildCodexToml(url)}</Code>
          <OptionLabel>{t('MCP_GUIDE_CODEX_COMMAND_HELP', 'Or run this command')}</OptionLabel>
          <Code>{buildCodexCommand(url)}</Code>
          <Notice $tone='info'>
            {t('MCP_GUIDE_CODEX_ENV_NOTE', 'Codex reads the key from _env_ on every request and sends it as a bearer token. The key is not written in config.toml.').replace('_env_', MCP_ENV_VAR)}
          </Notice>
        </li>
        <li>
          <h3>{t('MCP_GUIDE_CHECK_TITLE', 'Check the connection')}</h3>
          <p>
            {t('MCP_GUIDE_CODEX_CHECK_HELP', 'Run codex mcp list, or /mcp inside Codex. _server_ should be listed.').replace('_server_', MCP_SERVER_NAME)}
          </p>
        </li>
      </Steps>
    )
  }

  const prompts = [
    t('MCP_GUIDE_PROMPT_WHOAMI', 'Who am I in Ordering?'),
    t('MCP_GUIDE_PROMPT_ORDERS', 'List the last 5 orders')
  ]

  return (
    <>
      <SetupSection data-testid='mcp-automatic-setup'>
        <h2>{t('MCP_CONNECT_ASSISTANT', 'Connect with my assistant')}</h2>
        <p>{t('MCP_AUTOMATIC_STEPS', 'Paste the prompt in your terminal agent, sign in in the browser, review permissions, then wait for the installer, reload your client and ask whoami.')}</p>
        <GuideActions>
          <McpCopyButton text={buildMcpSetupPrompt()} buttonText={t('MCP_COPY_CONNECT_PROMPT', 'Copy prompt to connect')} />
        </GuideActions>
        <Notice $tone='info'>
          {t('MCP_INSTALL_BOUNDARY', 'Browser success confirms credential delivery. The terminal verifies detected client registrations; only a tool call in your client proves the connection. A remote installer configures its own machine.')}
        </Notice>
        <p>{t('MCP_REST_OPTION', 'MCP read is the default. REST is a separate option checked by default, with broad user permissions and no expiry. Uncheck it if unnecessary; MCP read does not restrict REST.')}</p>
        <p>
          <a href={languageState?.language?.code === 'es' ? 'https://docs.ordering.co/es/docs/developers/mcp/' : 'https://docs.ordering.co/docs/developers/mcp/'} target='_blank' rel='noopener noreferrer'>{t('MCP_FULL_GUIDE', 'Complete guide')}</a>
          {' · '}
          <a href='https://github.com/Ordering-co/ordering-dev-quickstart' target='_blank' rel='noopener noreferrer'>Quickstart</a>
          {' · '}
          <a href='https://github.com/Ordering-co/ordering-mcp-plugin' target='_blank' rel='noopener noreferrer'>Plugin / skill (Claude Code / Codex)</a>
        </p>
        <p>{t('MCP_REPO_ACCESS', 'Quickstart installs MCP; the optional plugin adds platform knowledge separately. Repository access is required if GitHub reports that either repo is private.')}</p>
        <details>
          <summary>{t('MCP_MANUAL_SETUP', 'Manual configuration')}</summary>
          <p>{t('MCP_GUIDE_HELP', 'Pick your assistant. The steps already use the URL of this project.')}</p>
          <GuideTabs>
            <GuideTab type='button' aria-pressed={client === 'claude'} $active={client === 'claude'} onClick={() => setClient('claude')}>Claude Code</GuideTab>
            <GuideTab type='button' aria-pressed={client === 'codex'} $active={client === 'codex'} onClick={() => setClient('codex')}>Codex</GuideTab>
          </GuideTabs>
          {clients[client]}
        </details>
      </SetupSection>

      <SetupSection>
        <h2>{t('MCP_GUIDE_FIRST_REQUEST', 'Your first request')}</h2>
        <p>{t('MCP_GUIDE_FIRST_REQUEST_HELP', 'Ask your assistant to call whoami and read the latest orders. Confirm actual tool calls and the intended project before reporting connected.')}</p>
        {prompts.map(prompt => (
          <PromptRow key={prompt}>
            <code>{prompt}</code>
            <McpCopyButton text={prompt} />
          </PromptRow>
        ))}
        {status.tools?.length > 0 && (
          <p>
            {t('MCP_GUIDE_TOOLS', 'Server tool catalog: _tools_. write_operation requires write scope and supported fields.').replace('_tools_', status.tools.join(', '))}
          </p>
        )}
      </SetupSection>
    </>
  )
}
