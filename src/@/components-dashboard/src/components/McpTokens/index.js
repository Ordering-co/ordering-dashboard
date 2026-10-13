import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { MCP_DATA_NOTICE_VERSION } from './notice'

/** Levels that can create and use MCP keys (the API enforces it too). */
export const MCP_ALLOWED_LEVELS = [0, 2]

const PAGE_SIZE = 20

const toErrorList = (result, fallback) => {
  if (Array.isArray(result)) return result.length ? result.map(String) : [fallback]
  if (typeof result === 'string' && result) return [result]
  return [fallback]
}

/**
 * MCP keys of the logged-in user and the MCP status of the project.
 * A user only sees and manages their own keys: every request goes to
 * `/users/{session user}/mcp_tokens`.
 * The secret of a new key is returned to the caller of `handleCreateToken` and
 * never kept in this state.
 */
export const McpTokens = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ user, token }] = useSession()

  const [statusState, setStatusState] = useState({ loading: true, error: null, result: null })
  const [tokensState, setTokensState] = useState({ loading: false, error: null, tokens: [], pagination: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const controllerRef = useRef(null)

  const isAllowed = MCP_ALLOWED_LEVELS.includes(user?.level)
  // apiv4 asks for another notice version than the text in this build: one side was deployed without the other
  const dataNoticeVersion = statusState.result?.data_notice_version
  const noticeOutdated = !!dataNoticeVersion && dataNoticeVersion !== MCP_DATA_NOTICE_VERSION

  const request = async (path, options = {}) => {
    const response = await fetch(`${ordering.root}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      },
      cache: 'no-store',
      signal: controllerRef.current?.signal
    })
    const content = await response.json()
    return { ok: response.ok && !content?.error, content }
  }

  /**
   * Get the MCP status of the project: whether it is on, its URL and what a new key can be
   */
  const getStatus = async () => {
    try {
      setStatusState(prev => ({ ...prev, loading: true, error: null }))
      const { ok, content } = await request('/mcp/status')
      if (!ok) {
        setStatusState({ loading: false, error: toErrorList(content?.result, 'ERROR'), result: null })
        return null
      }
      setStatusState({ loading: false, error: null, result: content.result })
      return content.result
    } catch (err) {
      if (err?.name === 'AbortError') return null
      setStatusState({ loading: false, error: [err.message], result: null })
      return null
    }
  }

  /**
   * Get one page of the MCP keys of the user, newest first
   * @param {Number} page page to load; page 1 replaces the list, the next ones append
   */
  const getTokens = async (page = 1) => {
    try {
      setTokensState(prev => ({ ...prev, loading: true, error: null }))
      const query = new URLSearchParams({ page, page_size: PAGE_SIZE, orderBy: '-id' })
      const { ok, content } = await request(`/users/${user.id}/mcp_tokens?${query}`)
      if (!ok) {
        setTokensState(prev => ({ ...prev, loading: false, error: toErrorList(content?.result, 'ERROR') }))
        return
      }
      setTokensState(prev => ({
        loading: false,
        error: null,
        tokens: page > 1 ? [...prev.tokens, ...content.result] : content.result,
        pagination: content.pagination || null
      }))
    } catch (err) {
      if (err?.name === 'AbortError') return
      setTokensState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  const loadMoreTokens = () => {
    const current = tokensState.pagination?.current_page || 1
    getTokens(current + 1)
  }

  /**
   * Create an MCP key, accepting the data notice text of this build. Resolves
   * `{ error, result }`; on success `result.token` is the full secret, which the
   * API returns only here.
   * @param {Object} values `{ name, expiresInDays, scope, noticeLanguage }`; `noticeLanguage`
   *   is the language of the notice text shown
   */
  const handleCreateToken = async ({ name, expiresInDays, scope, noticeLanguage }) => {
    // The form shows why and does not submit; this only guards other callers
    if (noticeOutdated) return { error: true, result: ['ERROR'] }
    try {
      setActionState({ loading: true, error: null })
      const { ok, content } = await request(`/users/${user.id}/mcp_tokens`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          expires_in_days: expiresInDays,
          scope,
          data_notice_version: MCP_DATA_NOTICE_VERSION,
          data_notice_language: noticeLanguage
        })
      })
      if (!ok) {
        const error = toErrorList(content?.result, 'ERROR')
        setActionState({ loading: false, error })
        return { error: true, result: error }
      }
      const { token: secret, ...created } = content.result
      setTokensState(prev => ({
        ...prev,
        tokens: [created, ...prev.tokens.filter(item => item.id !== created.id)],
        pagination: prev.pagination ? { ...prev.pagination, total: (prev.pagination.total || 0) + 1 } : prev.pagination
      }))
      setActionState({ loading: false, error: null })
      return { error: false, result: { ...created, token: secret } }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { error: true, result: [err.message] }
    }
  }

  /**
   * Revoke an MCP key. The key stays in the list with `revoked_at` set.
   * @param {Number} tokenId id of the key to revoke
   */
  const handleRevokeToken = async (tokenId) => {
    try {
      setActionState({ loading: true, error: null })
      const { ok, content } = await request(`/users/${user.id}/mcp_tokens/${tokenId}`, { method: 'DELETE' })
      if (!ok) {
        const error = toErrorList(content?.result, 'ERROR')
        setActionState({ loading: false, error })
        return { error: true, result: error }
      }
      setTokensState(prev => ({
        ...prev,
        tokens: prev.tokens.map(item => item.id === tokenId ? { ...item, ...content.result } : item)
      }))
      setActionState({ loading: false, error: null })
      return { error: false, result: content.result }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { error: true, result: [err.message] }
    }
  }

  const cleanActionError = () => setActionState(prev => ({ ...prev, error: null }))

  const loadAll = async () => {
    const status = await getStatus()
    if (status?.enabled) getTokens(1)
  }

  useEffect(() => {
    if (!user?.id || !isAllowed) return
    controllerRef.current = typeof AbortController !== 'undefined' ? new AbortController() : null
    loadAll()
    return () => controllerRef.current?.abort()
  }, [user?.id, isAllowed])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          isAllowed={isAllowed}
          statusState={statusState}
          noticeOutdated={noticeOutdated}
          tokensState={tokensState}
          actionState={actionState}
          reload={loadAll}
          loadMoreTokens={loadMoreTokens}
          handleCreateToken={handleCreateToken}
          handleRevokeToken={handleRevokeToken}
          cleanActionError={cleanActionError}
        />
      )}
    </>
  )
}

McpTokens.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
