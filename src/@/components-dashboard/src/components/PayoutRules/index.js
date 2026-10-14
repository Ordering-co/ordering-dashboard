import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { toPayoutRulePayload } from './payoutRuleHelpers'

const toErrorList = (result, fallback) => {
  if (Array.isArray(result)) return result.length ? result.map(String) : [fallback]
  if (typeof result === 'string' && result) return [result]
  return [fallback]
}

/**
 * A payout rule of Stripe Connect, administrators only.
 * Without `ownerId` it is the global rule of the scope. With it, the rule of
 * a business (scope `platform`) or of a driver (scope `driver`): `override`
 * is its own rule, null while it follows the global one, and `rule` is the
 * one that applies to it.
 */
export const PayoutRules = (props) => {
  const {
    UIComponent,
    scope,
    ownerId
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [ruleState, setRuleState] = useState({ loading: true, error: null, rule: null, override: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const controllerRef = useRef(null)

  const path = `/payout_rules/${scope}${ownerId ? `/${ownerId}` : ''}`

  const request = async (options = {}) => {
    const response = await fetch(`${ordering.root}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store',
      signal: controllerRef.current?.signal
    })
    const content = await response.json()
    return { ok: response.ok && !content?.error, content }
  }

  const toRuleState = (result) => ({
    loading: false,
    error: null,
    rule: (ownerId ? result?.effective : result?.rule) || null,
    override: (ownerId && result?.override) || null
  })

  /**
   * Get the rule in force
   */
  const getRule = async () => {
    try {
      setRuleState(prev => ({ ...prev, loading: true, error: null }))
      const { ok, content } = await request()
      if (!ok) {
        setRuleState(prev => ({ ...prev, loading: false, error: toErrorList(content?.result, 'ERROR') }))
        return
      }
      setRuleState(toRuleState(content.result))
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRuleState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  const change = async (options) => {
    try {
      setActionState({ loading: true, error: null })
      const { ok, content } = await request(options)
      if (!ok) {
        const error = toErrorList(content?.result, 'ERROR')
        setActionState({ loading: false, error })
        return { error: true, result: error }
      }
      setRuleState(toRuleState(content.result))
      setActionState({ loading: false, error: null })
      return { error: false, result: content.result }
    } catch (err) {
      if (err?.name === 'AbortError') return { error: true, result: [] }
      setActionState({ loading: false, error: [err.message] })
      return { error: true, result: [err.message] }
    }
  }

  /**
   * Save the rule. The API takes it whole and it applies to the orders placed from then on.
   * @param {Object} values every field of the scope, already validated
   */
  const handleSaveRule = (values) => change({
    method: 'PUT',
    body: JSON.stringify(toPayoutRulePayload(scope, values))
  })

  /**
   * Take away the rule an owner has of its own, so it follows the global one again
   */
  const handleInheritRule = () => change({ method: 'DELETE' })

  useEffect(() => {
    controllerRef.current = new AbortController()
    getRule()
    return () => controllerRef.current?.abort()
  }, [scope, ownerId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          ruleState={ruleState}
          actionState={actionState}
          getRule={getRule}
          handleSaveRule={handleSaveRule}
          handleInheritRule={ownerId ? handleInheritRule : undefined}
        />
      )}
    </>
  )
}

PayoutRules.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Whose share the rule sets
   */
  scope: PropTypes.oneOf(['platform', 'driver']).isRequired,
  /**
   * Business id (scope `platform`) or driver id (scope `driver`) for its own rule
   */
  ownerId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
}
