import React from 'react'

import { useLanguage } from '../../../../../index'
import { CopyButton } from '../../Shared/Product'

/**
 * Copy button that says "Copied" for a moment. Never logs what it copies.
 * redesign stores 5.18: P/CopyButton (from 5.15a) with the same words: `buttonText` or «Copy», «Copied», and «Copy
 * failed. Try again.» (now beside the button). It copies over http too (the piece falls back to a selected text).
 */
export const McpCopyButton = ({ text, label, buttonText }) => {
  const [, t] = useLanguage()
  const word = buttonText || t('COPY_BUTTON', 'Copy')
  return (
    <CopyButton
      text={text}
      label={label || word}
      copyLabel={word}
      copiedLabel={t('MCP_COPIED', 'Copied')}
      failedLabel={t('MCP_COPY_FAILED', 'Copy failed. Try again.')}
    />
  )
}

export const useMcpErrorText = () => {
  const [, t] = useLanguage()
  return (message) => {
    if (!message || message === 'ERROR') return t('MCP_REQUEST_ERROR', 'Something went wrong. Try again in a moment.')
    if (message === 'ERROR_MCP_TOKEN_NOT_FOUND') {
      return t('ERROR_MCP_TOKEN_NOT_FOUND', 'This MCP key does not exist or is already revoked.')
    }
    return /^[A-Z][A-Z0-9_]+$/.test(message) ? t(message, message) : message
  }
}
