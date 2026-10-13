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
  Section,
  Steps
} from './styles'

const Code = ({ children }) => (
  <CodeBlock>
    <pre>{children}</pre>
    <McpCopyButton text={children} />
  </CodeBlock>
)

/**
 * Setup guide for Claude Code and Codex, with the project's MCP URL filled in.
 * The key is always read from an environment variable, never written in a config.
 */
export const McpSetupGuide = ({ status }) => {
  const [, t] = useLanguage()
  const [client, setClient] = useState('claude')
  const url = status.url

  const envStep = (
    <li>
      <h3>{t('MCP_GUIDE_ENV_TITLE', 'Save your key in an environment variable')}</h3>
      <p>
        {t('MCP_GUIDE_ENV_HELP', 'Add this line to your shell profile (~/.zshrc or ~/.bashrc) with your key, then open a new terminal. Replace it when the key expires.')}
      </p>
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
      <Section>
        <h2>{t('MCP_GUIDE_TITLE', 'Setup guide')}</h2>
        <p>{t('MCP_GUIDE_HELP', 'Pick your assistant. The steps already use the URL of this project.')}</p>
        <p>{t('MCP_COPY_TO_LLM_HELP', 'Paste this prompt into your selected assistant. It will guide the setup and ask you to enter your MCP key privately on your computer.')}</p>
        <GuideActions>
          <GuideTabs role='tablist'>
            <GuideTab
              type='button'
              role='tab'
              aria-selected={client === 'claude'}
              $active={client === 'claude'}
              onClick={() => setClient('claude')}
            >
              Claude Code
            </GuideTab>
            <GuideTab
              type='button'
              role='tab'
              aria-selected={client === 'codex'}
              $active={client === 'codex'}
              onClick={() => setClient('codex')}
            >
              Codex
            </GuideTab>
          </GuideTabs>
          <McpCopyButton
            text={buildMcpSetupPrompt({ client, url })}
            buttonText={t('MCP_COPY_TO_LLM', 'Copy to LLM')}
          />
        </GuideActions>
        {clients[client]}
      </Section>

      <Section>
        <h2>{t('MCP_GUIDE_FIRST_REQUEST', 'Your first request')}</h2>
        <p>{t('MCP_GUIDE_FIRST_REQUEST_HELP', 'Ask your assistant one of these. If it answers with your user and your latest orders, you are connected.')}</p>
        {prompts.map(prompt => (
          <PromptRow key={prompt}>
            <code>{prompt}</code>
            <McpCopyButton text={prompt} />
          </PromptRow>
        ))}
        {status.tools?.length > 0 && (
          <p>
            {t('MCP_GUIDE_TOOLS', 'Tools the assistant gets: _tools_.').replace('_tools_', status.tools.join(', '))}
          </p>
        )}
      </Section>
    </>
  )
}
