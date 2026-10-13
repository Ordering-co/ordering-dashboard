import React, { useEffect, useRef, useState } from 'react'
import { Clipboard, Check2 } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { CopyButton } from './styles'

/** Copy button that says "Copied" for a moment. Never logs what it copies. */
export const McpCopyButton = ({ text, label, buttonText }) => {
  const [, t] = useLanguage()
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const [feedbackText, setFeedbackText] = useState(text)
  const timerRef = useRef(null)
  const generationRef = useRef(0)

  if (text !== feedbackText) {
    setFeedbackText(text)
    setCopied(false)
    setFailed(false)
    setPending(false)
  }

  useEffect(() => () => {
    generationRef.current += 1
    clearTimeout(timerRef.current)
  }, [text])

  const handleCopy = async () => {
    const generation = ++generationRef.current
    clearTimeout(timerRef.current)
    setCopied(false)
    setFailed(false)
    setPending(true)
    try {
      await navigator.clipboard.writeText(text)
      if (generation !== generationRef.current) return
      setCopied(true)
      timerRef.current = setTimeout(() => {
        if (generation !== generationRef.current) return
        setCopied(false)
      }, 2000)
    } catch {
      if (generation !== generationRef.current) return
      setFailed(true)
    } finally {
      if (generation === generationRef.current) setPending(false)
    }
  }

  return (
    <CopyButton type='button' onClick={handleCopy} disabled={pending} $copied={copied} aria-label={label || buttonText || t('COPY_BUTTON', 'Copy')}>
      {copied ? <Check2 aria-hidden='true' /> : <Clipboard aria-hidden='true' />}
      <span aria-live='polite'>
        {failed ? t('MCP_COPY_FAILED', 'Copy failed. Try again.') : copied ? t('MCP_COPIED', 'Copied') : buttonText || t('COPY_BUTTON', 'Copy')}
      </span>
    </CopyButton>
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
