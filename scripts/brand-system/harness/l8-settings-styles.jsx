import React from 'react'

import {
  CardFooter as AulCardFooter,
  CardHeader as AulCardHeader,
  CardMeta as AulCardMeta,
  CardTitle as AulCardTitle,
  Container as AulContainer,
  EmptyState as AulEmptyState,
  FooterMeta as AulFooterMeta,
  LimitCard as AulLimitCard,
  LimitList as AulLimitList,
  Notice as AulNotice,
  RefreshButton as AulRefreshButton,
  SearchWrapper as AulSearchWrapper,
  StatusBadge as AulStatusBadge,
  Toolbar as AulToolbar,
  ToolbarActions as AulToolbarActions
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/ApiUsageLimits/styles'
import {
  Chip as McpChip,
  CodeBlock as McpCodeBlock,
  ComingSoon as McpComingSoon,
  Container as McpContainer,
  CopyRow as McpCopyRow,
  DataNotice as McpDataNotice,
  EmptyState as McpEmptyState,
  Field as McpField,
  FieldHelp as McpFieldHelp,
  GuideTab as McpGuideTab,
  Header as McpHeader,
  InactiveToggle as McpInactiveToggle,
  LinkAction as McpLinkAction,
  Notice as McpNotice,
  OptionLabel as McpOptionLabel,
  ScopeOption as McpScopeOption,
  ScopePill as McpScopePill,
  Section as McpSection,
  SectionHeader as McpSectionHeader,
  SecretView as McpSecretView,
  StatusBadge as McpStatusBadge,
  Steps as McpSteps,
  TokenCard as McpTokenCard,
  TokenFacts as McpTokenFacts,
  TokenMain as McpTokenMain,
  TokenTitle as McpTokenTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/McpTokens/styles'
import {
  BlockHeader as ScbBlockHeader,
  BlockHelp as ScbBlockHelp,
  BlockTitle as ScbBlockTitle,
  CompactTable as ScbCompactTable,
  Field as ScbField,
  FieldControl as ScbFieldControl,
  FieldError as ScbFieldError,
  FieldHelp as ScbFieldHelp,
  FieldLabel as ScbFieldLabel,
  FieldSelect as ScbFieldSelect,
  PreviewItem as ScbPreviewItem,
  PreviewList as ScbPreviewList,
  Table as ScbTable,
  ToggleRow as ScbToggleRow
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsCustomBlocks/styles'
import {
  LoyaltyBlock as SlsLoyaltyBlock,
  LoyaltyBlockHelp as SlsLoyaltyBlockHelp,
  LoyaltyCard as SlsLoyaltyCard,
  LoyaltyCardHeader as SlsLoyaltyCardHeader,
  LoyaltyCardHelp as SlsLoyaltyCardHelp,
  LoyaltyCardTitle as SlsLoyaltyCardTitle,
  LoyaltyTab as SlsLoyaltyTab,
  LoyaltyTabs as SlsLoyaltyTabs
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsLoyaltyStores/styles'

// Batch fixture for l8-settings (L8 lote 3.1).
//
// It mounts the REAL styled components of the Settings rows that still own styled
// surfaces -- ApiUsageLimits, McpTokens, SettingsCustomBlocks and
// SettingsLoyaltyStores -- and not their controllers. SettingsHub is no longer
// mounted: its look moved to settings-hub.css and the styled
// components this fixture used are gone; neither is the McpTokens CopyButton,
// replaced by the shared Product CopyButton. That is deliberate: the controllers reach the Ordering API
// (usage limits, MCP keys, project configs, loyalty), and a typography test must
// not sit in front of a network or a write surface. Styled components render the
// same CSS with none of that. Every value below is synthetic and obviously fake;
// there is no real key, token or project anywhere in this file.
//
// Every node that carries a `data-testid` exists to place ONE declared site of
// scripts/brand-system/l8-settings-typography-rules.json (63 rules + 1
// preservation = 64 testids) in the exact selector context the rule names. Where
// a context is a direct child (`> h2`) the markup is a direct child; where it is
// a descendant (`h3`) it is a descendant. Getting that wrong makes a spec that
// measures the wrong node and passes anyway.
//
// The markup follows the product's own index.js / McpSetupGuide.js /
// McpTokenForm.js, not an idealised version of it.
//
// Two nodes need a word, because the rule does not name a plain element:
//   - `mcp-steps-step` is the first <li> of Steps. The rule's site is the
//     `> li::before` pseudo-element that numbers the step, so the spec reads it
//     with getComputedStyle(node, '::before') and not with toHaveCSS.
//   - `mcp-steps-dead-code` is the preserved dead selector `Steps > li > code`.
//     The product renders no such node (McpSetupGuide puts only h3, p, a Code
//     block that draws <pre>, OptionLabel and Notice in each <li>). It is mounted
//     here literally, as a direct <code> child of an <li>, only to prove that the
//     selector exists and that its 12.5px survives every role moving. It is
//     fixture-only markup and must never be read as product markup.
//
// Inputs and the search field are plain elements on purpose. ApiUsageLimits wraps
// the shared SearchBar, whose own `> input` rule also sets a font size; mounting
// it would make the measured node answer to two declarations and the spec could
// no longer attribute the size to the rule under test.

const Icon = () => <svg viewBox='0 0 16 16' width='14' height='14' aria-hidden='true'><circle cx='8' cy='8' r='7' /></svg>

export const L8SettingsStylesFixture = () => (
  <div
    data-testid='l8-settings-styles'
    style={{ padding: 24, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, boxSizing: 'border-box' }}
  >

    {/* ApiUsageLimits */}
    <AulContainer>
      <AulToolbar>
        <AulSearchWrapper>
          <div>
            <input data-testid='aul-search-input' type='text' name='search' placeholder='Search limits' defaultValue='orders' />
          </div>
        </AulSearchWrapper>
        <AulToolbarActions>
          <AulRefreshButton type='button' data-testid='aul-refresh'>
            <Icon />
            Refresh
          </AulRefreshButton>
        </AulToolbarActions>
      </AulToolbar>
      <AulNotice role='status' data-testid='aul-notice'>Usage data may be a few minutes old.</AulNotice>
      <AulEmptyState>
        <h3 data-testid='aul-empty-title'>This project has no active usage limits.</h3>
        <p data-testid='aul-empty-text'>When a limit applies to this project, it shows here with its current usage.</p>
      </AulEmptyState>
      <AulLimitList>
        <AulLimitCard>
          <AulCardHeader>
            <div>
              <AulCardTitle data-testid='aul-card-title'>GET /orders · 1 minute</AulCardTitle>
              <AulCardMeta data-testid='aul-card-meta'>Endpoint</AulCardMeta>
            </div>
            <AulStatusBadge $status='ok' data-testid='aul-status-badge'>OK</AulStatusBadge>
          </AulCardHeader>
          <AulCardFooter data-testid='aul-card-footer'>
            <span><strong>120</strong> / 1,000 requests</span>
            <AulFooterMeta data-testid='aul-footer-meta'>Resets in 42 s</AulFooterMeta>
          </AulCardFooter>
        </AulLimitCard>
      </AulLimitList>
    </AulContainer>

    {/* McpTokens */}
    <McpContainer>
      <McpHeader>
        <h1 data-testid='mcp-header-title'>MCP (Claude Code &amp; Codex)</h1>
        <p data-testid='mcp-header-text'>Connect an AI assistant to this project with an MCP key.</p>
      </McpHeader>

      <McpSection>
        <h2 data-testid='mcp-section-title'>Server URL</h2>
        <p data-testid='mcp-section-text'>The address of the MCP server for this project.</p>
        <McpCopyRow>
          <code data-testid='mcp-copy-code'>https://mcp.example.invalid/test-project</code>
        </McpCopyRow>
      </McpSection>

      <McpSection>
        <McpSectionHeader>
          <h2 data-testid='mcp-section-header-title'>Your MCP keys</h2>
          <button type='button' data-testid='mcp-section-header-button'>Create key</button>
        </McpSectionHeader>
        <McpNotice data-testid='mcp-notice' role='status'>
          <span>None of your keys works anymore.</span>
          <button type='button' data-testid='mcp-notice-button'>Create key</button>
        </McpNotice>
        <McpEmptyState>
          <h3 data-testid='mcp-empty-title'>You have no MCP keys yet</h3>
          <p data-testid='mcp-empty-text'>Create a key, then follow the guide below.</p>
          <button type='button' data-testid='mcp-empty-button'>Create key</button>
        </McpEmptyState>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <McpTokenCard>
            <McpTokenMain>
              <McpTokenTitle>
                <h3 data-testid='mcp-token-title'>CI key (synthetic)</h3>
                <McpScopePill data-testid='mcp-scope-pill'>Read</McpScopePill>
              </McpTokenTitle>
              <McpTokenFacts data-testid='mcp-token-facts'>
                <code data-testid='mcp-token-facts-code'>mcp_test_xxx…</code>
                <span title='2026-12-01'>Expires in 2 months</span>
                <span>Never used</span>
              </McpTokenFacts>
            </McpTokenMain>
            <McpStatusBadge $status='active' data-testid='mcp-status-badge'>Active</McpStatusBadge>
            <McpLinkAction type='button' data-testid='mcp-link-action'>Revoke</McpLinkAction>
          </McpTokenCard>
        </ul>
        <McpInactiveToggle type='button' aria-expanded='false' data-testid='mcp-inactive-toggle'>
          <Icon />
          Revoked and expired keys (1)
        </McpInactiveToggle>
      </McpSection>

      <McpComingSoon>
        <span data-testid='mcp-coming-soon-badge'>Coming soon</span>
        <h3 data-testid='mcp-coming-soon-title'>Connect Claude Code and Codex to this project</h3>
        <p data-testid='mcp-coming-soon-text'>The Ordering MCP server lets an AI assistant work with this project. It can:</p>
        <ul>
          <li>Search and read orders, businesses, menus, reports and users.</li>
        </ul>
      </McpComingSoon>

      <McpSection>
        <h2>Setup guide</h2>
        <div role='tablist' style={{ display: 'flex', gap: 4 }}>
          <McpGuideTab type='button' role='tab' aria-selected='true' $active data-testid='mcp-guide-tab'>Claude Code</McpGuideTab>
          <McpGuideTab type='button' role='tab' aria-selected='false'>Codex</McpGuideTab>
        </div>
        <McpSteps>
          <li data-testid='mcp-steps-step'>
            <h3 data-testid='mcp-steps-title'>Save your key in an environment variable</h3>
            <p data-testid='mcp-steps-text'>Add this line to your shell profile, then open a new terminal.</p>
            <McpCodeBlock>
              <pre data-testid='mcp-code-block-pre'>export ORDERING_MCP_KEY=mcp_test_xxx</pre>
            </McpCodeBlock>
          </li>
          <li>
            <h3>Add the Ordering server</h3>
            <McpOptionLabel data-testid='mcp-option-label'>Or run this command in the project folder</McpOptionLabel>
            {/* Preserved dead selector `Steps > li > code`: fixture-only node, see the header. */}
            <code data-testid='mcp-steps-dead-code'>claude mcp add ordering-test</code>
          </li>
        </McpSteps>
      </McpSection>

      {/* Create form (McpTokenForm) */}
      <McpField>
        <label htmlFor='l8-settings-mcp-name' data-testid='mcp-field-label'>Name</label>
        <input id='l8-settings-mcp-name' type='text' defaultValue='Claude Code – laptop' />
        <McpFieldHelp data-testid='mcp-field-help'>A label to recognize the key in your list.</McpFieldHelp>
      </McpField>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <McpChip type='button' $active aria-pressed='true' data-testid='mcp-chip'>7 days</McpChip>
        <McpChip type='button' aria-pressed='false'>30 days</McpChip>
      </div>
      <McpScopeOption $active>
        <input type='radio' name='l8-settings-mcp-scope' defaultChecked />
        <div>
          <strong data-testid='mcp-scope-option-title'>Read</strong>
          <span data-testid='mcp-scope-option-text'>The assistant can read data but not change it.</span>
        </div>
      </McpScopeOption>
      <McpDataNotice data-testid='mcp-data-notice'>
        <h3 data-testid='mcp-data-notice-title'>Before you create a key</h3>
        <p>The assistant works with your permissions.</p>
        <label>
          <input type='checkbox' />
          <span>I understand</span>
        </label>
      </McpDataNotice>

      {/* One-time secret (McpTokenForm) */}
      <McpSecretView>
        <McpNotice role='alert'>
          <strong>Copy this key now. You will not see this key again.</strong>
        </McpNotice>
        <McpCopyRow>
          <code data-testid='mcp-secret-code'>mcp_test_xxx_not_a_real_key</code>
        </McpCopyRow>
        <p data-testid='mcp-secret-text'>Treat this key like a password. Do not share it.</p>
      </McpSecretView>
    </McpContainer>

    {/* SettingsCustomBlocks */}
    <section>
      <ScbBlockHeader>
        <ScbBlockTitle data-testid='scb-block-title'>Date and time</ScbBlockTitle>
        <ScbBlockHelp data-testid='scb-block-help'>How dates are shown across the dashboard.</ScbBlockHelp>
      </ScbBlockHeader>
      <ScbField>
        <ScbFieldLabel htmlFor='l8-settings-scb-format' data-testid='scb-field-label'>Date format</ScbFieldLabel>
        <ScbFieldHelp data-testid='scb-field-help'>Pick how a date reads.</ScbFieldHelp>
        <ScbFieldControl id='l8-settings-scb-format' type='text' defaultValue='YYYY-MM-DD' data-testid='scb-field-control' />
        <ScbFieldError data-testid='scb-field-error'>Enter a valid format.</ScbFieldError>
        <ScbFieldSelect aria-label='Date format preset' defaultValue='iso' data-testid='scb-field-select'>
          <option value='iso'>YYYY-MM-DD</option>
          <option value='custom'>Custom</option>
        </ScbFieldSelect>
      </ScbField>
      <ScbPreviewList>
        <ScbPreviewItem data-testid='scb-preview-item'>
          <span>Date</span>
          <span>2026-09-19</span>
        </ScbPreviewItem>
      </ScbPreviewList>
      <ScbToggleRow data-testid='scb-toggle-row'>
        <input type='checkbox' defaultChecked />
        Require location checks
      </ScbToggleRow>
      <ScbCompactTable>
        <ScbTable data-testid='scb-table'>
          <thead>
            <tr>
              <th data-testid='scb-table-th'>Status</th>
              <th>Min distance (m)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pending</td>
              <td>
                <input type='text' aria-label='Min distance' defaultValue='100' data-testid='scb-table-input' />
              </td>
            </tr>
          </tbody>
        </ScbTable>
      </ScbCompactTable>
    </section>

    {/* SettingsLoyaltyStores */}
    <SlsLoyaltyCard>
      <SlsLoyaltyCardHeader>
        <SlsLoyaltyCardTitle data-testid='sls-card-title'>Points wallet</SlsLoyaltyCardTitle>
        <SlsLoyaltyCardHelp data-testid='sls-card-help'>Reward customers with points on every order.</SlsLoyaltyCardHelp>
      </SlsLoyaltyCardHeader>
      <SlsLoyaltyTabs role='tablist' aria-label='Points wallet'>
        <SlsLoyaltyTab type='button' role='tab' aria-selected='true' active data-testid='sls-tab'>Stores</SlsLoyaltyTab>
        <SlsLoyaltyTab type='button' role='tab' aria-selected='false'>Levels</SlsLoyaltyTab>
      </SlsLoyaltyTabs>
      <SlsLoyaltyBlock>
        <SlsLoyaltyBlockHelp data-testid='sls-block-help'>Choose the stores that join the program.</SlsLoyaltyBlockHelp>
      </SlsLoyaltyBlock>
    </SlsLoyaltyCard>
  </div>
)
