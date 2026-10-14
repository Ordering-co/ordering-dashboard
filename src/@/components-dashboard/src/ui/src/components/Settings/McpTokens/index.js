import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ChevronDown, ChevronRight } from 'react-bootstrap-icons'

import { useLanguage, useUtils, McpTokens as McpTokensController } from '../../../../../index'
import { Button } from '../../../styles'
import { Alert, Confirm, Modal } from '../../Shared'
import { McpTokenForm } from './McpTokenForm'
import { getMcpDataNotice } from '../../../../../components/McpTokens/notice'
import { McpSetupGuide } from './McpSetupGuide'
import { McpCopyButton, useMcpErrorText } from './shared'
import { formatMcpRelative, getMcpTokenStatus, isMcpTokenExpiringSoon } from './utils'
import {
  ComingSoon,
  Container,
  CopyRow,
  EmptyState,
  Header,
  InactiveToggle,
  LinkAction,
  LoadMore,
  Notice,
  ScopePill,
  Section,
  SectionHeader,
  StatusBadge,
  TokenCard,
  TokenFacts,
  TokenList,
  TokenMain,
  TokenSide,
  TokenTitle,
  Warn
} from './styles'

const McpTokensUI = (props) => {
  const {
    isAllowed,
    statusState,
    noticeOutdated,
    tokensState,
    actionState,
    reload,
    loadMoreTokens,
    handleCreateToken,
    handleRevokeToken,
    cleanActionError
  } = props

  const [languageState, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const locale = languageState?.language?.code || 'en'
  const errorText = useMcpErrorText()

  // `null` when closed; otherwise the initial values of the form (a replacement copies name and scope).
  const [createForm, setCreateForm] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [showInactive, setShowInactive] = useState(null)

  const status = statusState.result
  const tokens = tokensState.tokens || []
  const now = Date.now()
  const activeTokens = tokens.filter(item => getMcpTokenStatus(item, now) === 'active')
  const inactiveTokens = tokens.filter(item => getMcpTokenStatus(item, now) !== 'active')
  const hasActive = activeTokens.length > 0
  // Revoked and expired keys stay folded while there is an active one.
  const isInactiveOpen = showInactive ?? !hasActive
  const pagination = tokensState.pagination
  const hasMore = !!pagination && (pagination.current_page || 1) < (pagination.total_pages || 1)

  const statusLabels = {
    active: t('MCP_TOKEN_ACTIVE', 'Active'),
    expired: t('MCP_TOKEN_EXPIRED', 'Expired'),
    revoked: t('MCP_TOKEN_REVOKED', 'Revoked')
  }

  // Scope names are fixed in code, like the notice that describes them
  const { scopes } = getMcpDataNotice(languageState?.language?.code)
  const scopeLabels = { read: scopes.read.title, write: scopes.write.title }

  const openCreate = (initial = {}) => {
    cleanActionError()
    setCreateForm(initial)
  }

  const onRevoke = (item) => {
    setConfirm({
      open: true,
      content: t('MCP_REVOKE_CONFIRM', 'Revoke the key "_name_"? Any client that uses it stops working right away. This cannot be undone.').replace('_name_', item.name),
      handleOnAccept: async () => {
        setConfirm({ open: false, content: null, handleOnAccept: null })
        setRevoking(item.id)
        const response = await handleRevokeToken(item.id)
        setRevoking(null)
        if (response?.error) {
          setAlertState({ open: true, content: response.result.map(errorText) })
        }
      }
    })
  }

  const renderHeader = () => (
    <Header>
      <h1>{t('MCP_TITLE', 'MCP (Claude Code & Codex)')}</h1>
      <p>{t('MCP_DESCRIPTION', 'Connect an AI assistant like Claude Code or Codex to this project with an MCP key. The assistant works with your permissions.')}</p>
    </Header>
  )

  if (!isAllowed) {
    return (
      <Container>
        {renderHeader()}
        <Notice role='status'>
          {t('MCP_NOT_ALLOWED', 'Only administrators and business managers can use MCP keys.')}
        </Notice>
      </Container>
    )
  }

  if (statusState.loading) {
    return (
      <Container>
        {renderHeader()}
        <Skeleton height={20} width={180} />
        <Skeleton height={38} />
        <Skeleton height={90} count={2} style={{ marginBottom: 10 }} />
      </Container>
    )
  }

  if (statusState.error || !status) {
    return (
      <Container>
        {renderHeader()}
        <Notice $tone='danger' role='alert'>
          <span>{t('MCP_STATUS_ERROR', 'We could not load the MCP status of this project.')} {(statusState.error || []).map(errorText).join(' ')}</span>
          <Button color='primary' borderRadius='7.6px' onClick={() => reload()}>{t('RETRY', 'Retry')}</Button>
        </Notice>
      </Container>
    )
  }

  if (!status.enabled) {
    return (
      <Container>
        {renderHeader()}
        <ComingSoon data-testid='mcp-coming-soon'>
          <span>{t('MCP_COMING_SOON', 'Coming soon')}</span>
          <h3>{t('MCP_COMING_SOON_TITLE', 'Connect Claude Code and Codex to this project')}</h3>
          <p>{t('MCP_COMING_SOON_DESCRIPTION', 'The Ordering MCP server lets an AI assistant work with this project using your permissions. It can:')}</p>
          <ul>
            <li>{t('MCP_COMING_SOON_READ', 'Search and read orders, businesses, menus, reports and users.')}</li>
            <li>{t('MCP_COMING_SOON_WRITE', 'If you allow it, update menus, products, businesses, order statuses and offers, always asking you first.')}</li>
          </ul>
          <p>{t('MCP_COMING_SOON_HELP', 'It is not available for this project yet. It will be available soon, and this page will show your keys and the setup guide as soon as it is.')}</p>
        </ComingSoon>
      </Container>
    )
  }

  const renderToken = (item) => {
    const tokenStatus = getMcpTokenStatus(item, now)
    const isActive = tokenStatus === 'active'
    const expiringSoon = isMcpTokenExpiringSoon(item, now)
    const relative = (value) => formatMcpRelative(value, { now, locale })

    // One line of facts. The exact date is in the tooltip of each one.
    const lifecycle = tokenStatus === 'revoked'
      ? { key: 'revoked', date: item.revoked_at, text: t('MCP_REVOKED_RELATIVE', 'Revoked _time_') }
      : tokenStatus === 'expired'
        ? { key: 'expired', date: item.expires_at, text: t('MCP_EXPIRED_RELATIVE', 'Expired _time_') }
        : { key: 'expires', date: item.expires_at, text: t('MCP_EXPIRES_RELATIVE', 'Expires _time_') }

    return (
      <TokenCard key={item.id} $inactive={!isActive} data-testid='mcp-token'>
        <TokenMain>
          <TokenTitle>
            <h3 title={item.created_at ? t('MCP_CREATED_ON', 'Created _date_').replace('_date_', parseDate(item.created_at)) : undefined}>
              {item.name}
            </h3>
            <ScopePill $write={item.scope === 'write'}>{scopeLabels[item.scope] || item.scope}</ScopePill>
          </TokenTitle>
          <TokenFacts>
            <code>{item.prefix}…</code>
            {!!lifecycle.date && (
              <span title={parseDate(lifecycle.date)} data-testid={`mcp-token-${lifecycle.key}`}>
                {expiringSoon ? <Warn>{lifecycle.text.replace('_time_', relative(lifecycle.date))}</Warn> : lifecycle.text.replace('_time_', relative(lifecycle.date))}
              </span>
            )}
            <span title={item.last_used_at ? parseDate(item.last_used_at) : undefined}>
              {item.last_used_at
                ? t('MCP_LAST_USED_RELATIVE', 'Last used _time_').replace('_time_', relative(item.last_used_at))
                : t('MCP_NEVER_USED', 'Never used')}
            </span>
          </TokenFacts>
        </TokenMain>
        <TokenSide>
          <StatusBadge $status={tokenStatus}>{statusLabels[tokenStatus]}</StatusBadge>
          {isActive && (
            <LinkAction type='button' $danger disabled={revoking === item.id} onClick={() => onRevoke(item)}>
              {revoking === item.id ? t('MCP_REVOKING', 'Revoking') : t('MCP_REVOKE', 'Revoke')}
            </LinkAction>
          )}
          {tokenStatus === 'expired' && (
            <LinkAction type='button' onClick={() => openCreate({ name: item.name, scope: item.scope })}>
              {t('MCP_CREATE_REPLACEMENT', 'Create a replacement')}
            </LinkAction>
          )}
        </TokenSide>
      </TokenCard>
    )
  }

  return (
    <>
      <Container>
        {renderHeader()}
        <McpSetupGuide status={status} />

        <Section>
          <h2>{t('MCP_SERVER_URL', 'Server URL')}</h2>
          <p>{t('MCP_SERVER_URL_HELP', 'The MCP endpoint for this project, for manual setup. Automatic connection confirms the project during sign-in.')}</p>
          <CopyRow>
            <code data-testid='mcp-server-url'>{status.url}</code>
            <McpCopyButton text={status.url} label={t('MCP_COPY_URL', 'Copy the server URL')} />
          </CopyRow>
        </Section>

        <Section>
          <SectionHeader>
            <h2>{t('MCP_YOUR_KEYS', 'Your MCP keys')}</h2>
            <Button color='lightPrimary' borderRadius='7.6px' onClick={() => openCreate()}>
              {t('MCP_CREATE_KEY', 'Create key')}
            </Button>
          </SectionHeader>
          <p>{t('MCP_YOUR_KEYS_HELP', 'Only you can see and use your keys. A key works only through the MCP server, not against the API directly.')}</p>

          {!!tokensState.error && (
            <Notice $tone='danger' role='alert'>
              <span>{tokensState.error.map(errorText).join(' ')}</span>
              <Button color='primary' borderRadius='7.6px' onClick={() => reload()}>{t('RETRY', 'Retry')}</Button>
            </Notice>
          )}

          {tokensState.loading && tokens.length === 0 && (
            <Skeleton height={90} count={2} style={{ marginBottom: 10 }} />
          )}

          {!tokensState.loading && !tokensState.error && tokens.length === 0 && (
            <EmptyState>
              <h3>{t('MCP_NO_KEYS', 'You have no MCP keys yet')}</h3>
              <p>{t('MCP_NO_KEYS_HELP', 'Copy the prompt above to sign in and create your MCP credential. You can also create a key manually as an alternative.')}</p>
              <Button color='primary' borderRadius='7.6px' onClick={() => openCreate()}>
                {t('MCP_CREATE_KEY', 'Create key')}
              </Button>
            </EmptyState>
          )}

          {tokens.length > 0 && !hasActive && (
            <Notice role='status'>
              <span>{t('MCP_NO_ACTIVE_KEYS', 'None of your keys works anymore. Create a new one and put it in ORDERING_MCP_KEY in place of the old one.')}</span>
              <Button color='primary' borderRadius='7.6px' onClick={() => openCreate()}>
                {t('MCP_CREATE_KEY', 'Create key')}
              </Button>
            </Notice>
          )}

          {activeTokens.length > 0 && (
            <TokenList>
              {activeTokens.map(renderToken)}
            </TokenList>
          )}

          {inactiveTokens.length > 0 && (
            <>
              <InactiveToggle
                type='button'
                aria-expanded={isInactiveOpen}
                onClick={() => setShowInactive(!isInactiveOpen)}
              >
                {isInactiveOpen ? <ChevronDown /> : <ChevronRight />}
                {t('MCP_INACTIVE_KEYS', 'Revoked and expired keys (_count_)').replace('_count_', inactiveTokens.length)}
              </InactiveToggle>
              {isInactiveOpen && (
                <TokenList data-testid='mcp-inactive-tokens'>
                  {inactiveTokens.map(renderToken)}
                </TokenList>
              )}
            </>
          )}

          {hasMore && (
            <LoadMore>
              <Button color='secundary' borderRadius='7.6px' disabled={tokensState.loading} onClick={() => loadMoreTokens()}>
                {tokensState.loading ? t('LOADING', 'Loading') : t('MCP_LOAD_MORE', 'Show more keys')}
              </Button>
            </LoadMore>
          )}
        </Section>

      </Container>

      {createForm && (
        <Modal
          width='640px'
          padding='30px'
          open={!!createForm}
          onClose={() => setCreateForm(null)}
          closeOnBackdrop={false}
        >
          <McpTokenForm
            status={status}
            noticeOutdated={noticeOutdated}
            initialValues={createForm}
            actionState={actionState}
            handleCreateToken={handleCreateToken}
            onClose={() => setCreateForm(null)}
          />
        </Modal>
      )}

      <Alert
        title={t('MCP_TITLE', 'MCP (Claude Code & Codex)')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      <Confirm
        title={t('MCP_REVOKE_KEY', 'Revoke key')}
        content={confirm.content}
        acceptText={t('MCP_REVOKE', 'Revoke')}
        open={confirm.open}
        onClose={() => setConfirm({ open: false, content: null, handleOnAccept: null })}
        onCancel={() => setConfirm({ open: false, content: null, handleOnAccept: null })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const McpTokens = (props) => {
  const mcpTokensProps = {
    ...props,
    UIComponent: McpTokensUI
  }

  return <McpTokensController {...mcpTokensProps} />
}
