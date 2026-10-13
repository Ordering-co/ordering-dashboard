import React, { useState } from 'react'
import moment from 'moment'

import { useLanguage } from '../../../../../index'
import { getMcpDataNotice, getMcpDataNoticeLanguage } from '../../../../../components/McpTokens/notice'
import { Button, Input } from '../../../styles'
import { McpCopyButton, useMcpErrorText } from './shared'
import {
  MCP_ENV_VAR,
  buildEnvExport,
  clampMcpExpirationDays,
  getMcpExpirationOptions
} from './utils'
import {
  Chip,
  Chips,
  CodeBlock,
  CopyRow,
  DataNotice,
  Field,
  FieldHelp,
  Form,
  FormActions,
  Notice,
  ScopeOption,
  ScopeOptions,
  SecretView
} from './styles'

const NAME_MAX_LENGTH = 100

/**
 * Create form for an MCP key, then the one-time secret. The secret lives only
 * in this component's state: closing the modal unmounts it and drops it.
 */
export const McpTokenForm = (props) => {
  const {
    status,
    noticeOutdated,
    initialValues,
    actionState,
    handleCreateToken,
    onClose
  } = props

  const [languageState, t] = useLanguage()
  const errorText = useMcpErrorText()
  // The notice and scope text is fixed in code, not in translations; see components/McpTokens/notice.js
  const languageCode = languageState?.language?.code
  const notice = getMcpDataNotice(languageCode)

  const maxDays = status?.expires_in_days?.max || 365
  const defaultDays = Math.min(status?.expires_in_days?.default || 7, maxDays)
  const scopes = status?.scopes?.length ? status.scopes : ['read']
  const expirationOptions = getMcpExpirationOptions({ defaultDays, maxDays })

  const [name, setName] = useState(initialValues?.name || '')
  const [days, setDays] = useState(defaultDays)
  const [customDays, setCustomDays] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [scope, setScope] = useState(scopes.includes(initialValues?.scope) ? initialValues.scope : (scopes.includes('read') ? 'read' : scopes[0]))
  const [accepted, setAccepted] = useState(false)
  const [created, setCreated] = useState(null)

  const expiresInDays = isCustom ? clampMcpExpirationDays(customDays, maxDays) : days
  const trimmedName = name.trim()
  const canSubmit = !!trimmedName && trimmedName.length <= NAME_MAX_LENGTH && !!expiresInDays && !!scope && accepted && !noticeOutdated && !actionState?.loading

  const scopeCopy = notice.scopes

  const dayLabel = (value) => value === 365
    ? t('MCP_EXPIRATION_ONE_YEAR', '1 year')
    : t('MCP_EXPIRATION_DAYS', '_days_ days').replace('_days_', value)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    const response = await handleCreateToken({ name: trimmedName, expiresInDays, scope, noticeLanguage: getMcpDataNoticeLanguage(languageCode) })
    if (!response?.error && response?.result?.token) {
      setCreated({ name: response.result.name, token: response.result.token, expiresAt: response.result.expires_at })
    }
  }

  if (created) {
    return (
      <SecretView data-testid='mcp-secret'>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('MCP_KEY_CREATED', 'Your new MCP key')}</h2>
        <Notice role='alert'>
          <strong>{t('MCP_KEY_SHOWN_ONCE', 'Copy this key now. You will not see this key again.')}</strong>
        </Notice>
        <CopyRow>
          <code data-testid='mcp-secret-value'>{created.token}</code>
          <McpCopyButton text={created.token} label={t('MCP_COPY_KEY', 'Copy the key')} />
        </CopyRow>
        <p>
          {t('MCP_KEY_PASSWORD', 'Treat this key like a password. Do not share it, do not commit it to a repository and do not paste it in a chat. If it leaks, revoke it on this page.')}
        </p>
        <p>
          {t('MCP_KEY_ENV_HELP', 'Save it in the _env_ environment variable, for example in your shell profile (~/.zshrc or ~/.bashrc), then open a new terminal:').replace('_env_', MCP_ENV_VAR)}
        </p>
        <CodeBlock>
          <pre>{buildEnvExport()}</pre>
        </CodeBlock>
        <FormActions>
          <Button type='button' color='primary' borderRadius='7.6px' onClick={onClose}>
            {t('MCP_KEY_SAVED', 'I saved my key')}
          </Button>
        </FormActions>
      </SecretView>
    )
  }

  return (
    <Form onSubmit={onSubmit} noValidate data-testid='mcp-create-form'>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('MCP_CREATE_KEY_TITLE', 'Create an MCP key')}</h2>

      <Field>
        <label htmlFor='mcp-token-name'>{t('NAME', 'Name')}</label>
        <Input
          id='mcp-token-name'
          type='text'
          value={name}
          maxLength={NAME_MAX_LENGTH}
          autoComplete='off'
          data-1p-ignore
          data-lpignore='true'
          placeholder={t('MCP_KEY_NAME_PLACEHOLDER', 'For example, Claude Code – laptop')}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <FieldHelp>{t('MCP_KEY_NAME_HELP', 'A label to recognize the key in your list.')}</FieldHelp>
      </Field>

      <Field role='group' aria-labelledby='mcp-token-expiration'>
        <span id='mcp-token-expiration'>{t('MCP_EXPIRATION', 'Expiration')}</span>
        <Chips>
          {expirationOptions.map(value => (
            <Chip
              key={value}
              type='button'
              $active={!isCustom && days === value}
              aria-pressed={!isCustom && days === value}
              onClick={() => { setIsCustom(false); setDays(value) }}
            >
              {dayLabel(value)}
            </Chip>
          ))}
          <Chip
            type='button'
            $active={isCustom}
            aria-pressed={isCustom}
            onClick={() => { setIsCustom(true); setCustomDays(customDays || String(days)) }}
          >
            {t('MCP_EXPIRATION_CUSTOM', 'Custom')}
          </Chip>
          {isCustom && (
            <Input
              type='number'
              min={1}
              max={maxDays}
              step={1}
              value={customDays}
              aria-label={t('MCP_EXPIRATION_CUSTOM_DAYS', 'Days until the key expires')}
              onChange={e => setCustomDays(e.target.value)}
            />
          )}
        </Chips>
        <FieldHelp $error={isCustom && !expiresInDays}>
          {isCustom && !expiresInDays
            ? t('MCP_EXPIRATION_INVALID', 'Enter a whole number of days between 1 and _max_.').replace('_max_', maxDays)
            : t('MCP_EXPIRATION_HELP', 'The key stops working on _date_. There is no key that never expires: when it expires, create a new one.')
              .replace('_date_', moment().add(expiresInDays, 'days').format('YYYY-MM-DD'))}
        </FieldHelp>
      </Field>

      <Field role='radiogroup' aria-labelledby='mcp-token-scope'>
        <span id='mcp-token-scope'>{t('MCP_TOKEN_SCOPE', 'Scope')}</span>
        <ScopeOptions>
          {scopes.map(value => (
            <ScopeOption key={value} $active={scope === value}>
              <input
                type='radio'
                name='mcp-token-scope'
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
              />
              <div>
                <strong>{scopeCopy[value]?.title || value}</strong>
                {scopeCopy[value]?.description && <span>{scopeCopy[value].description}</span>}
              </div>
            </ScopeOption>
          ))}
        </ScopeOptions>
      </Field>

      <DataNotice data-testid='mcp-data-notice'>
        <h3>{notice.title}</h3>
        <p>{notice.intro}</p>
        <ul>
          {notice.points.map(point => (
            <li key={point.label}>
              <strong>{point.label}</strong>{' '}
              {point.text}
            </li>
          ))}
        </ul>
        <label>
          <input
            type='checkbox'
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
          />
          <span>{notice.accept}</span>
        </label>
      </DataNotice>

      {noticeOutdated && (
        <Notice $tone='danger' role='alert'>
          {notice.outdated}
        </Notice>
      )}

      {!!actionState?.error && (
        <Notice $tone='danger' role='alert'>
          {actionState.error.map(errorText).join(' ')}
        </Notice>
      )}

      <FormActions>
        <Button type='button' color='secundary' borderRadius='7.6px' onClick={onClose}>
          {t('CANCEL', 'Cancel')}
        </Button>
        <Button type='submit' color='primary' borderRadius='7.6px' disabled={!canSubmit}>
          {actionState?.loading ? t('MCP_CREATING', 'Creating') : t('MCP_CREATE', 'Create')}
        </Button>
      </FormActions>
    </Form>
  )
}
