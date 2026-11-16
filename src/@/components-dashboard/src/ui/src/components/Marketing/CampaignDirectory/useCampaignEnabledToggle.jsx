import { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { asConditions } from './campaignData'

// redesign CA-B4 (decision 2; defect M-CA6, owner proposal P-1): the switch of a dynamic campaign (Active / Paused).
// redesign D-6 (owner, 2026-10-19; decision 25 · C8): turning it ON asks first, because it starts sending to whoever already
// matches the rules and sent messages can't be undone. Cancel writes nothing and the switch stays Paused. Turning it OFF stays immediate:
// the change goes to the controller at once. The controller (`handleUpdateCampaign`, CA-B1) resolves `{ ok, error }`;
// when it says `ok: false` (or throws) the host's AlertDialog tells the person. The switch is controlled by `campaign.enabled`,
// which only changes on success, so a failure leaves it where it was: the interface never lies. A controller that resolves
// nothing (the legacy one) counts as done.
//
// Returns `{ pendingIds, setEnabled(campaign, next), alert, dialog }` and renders nothing itself. `pendingIds` are the campaigns
// whose call is in flight (their switch shows busy). `alert` is `null` or `{ title, content, close }` for the host's
// `P/AlertDialog` (its `content` are plain strings; the dialog runs the API ones through `translateApiMessage`). `dialog` is the
// confirmation of «turn on» (from useConfirmStep): a node the host renders ONCE, for the table and the panel alike.

// Plain strings out of what the controller left as `error` (a string, a list, a list of lists); empty means «say the default»
const messagesOf = (error) => {
  const list = Array.isArray(error) ? error.flat(Infinity) : [error]
  return list.filter(item => typeof item === 'string' && item.trim() !== '')
}

export const useCampaignEnabledToggle = ({ handleUpdateCampaign } = {}) => {
  const [, t] = useLanguage()
  const { ask, dialog } = useConfirmStep()
  const [pendingIds, setPendingIds] = useState([])
  const [failure, setFailure] = useState(null)
  const inFlight = useRef(new Set()) // synchronous: a second press before the render still finds the first one
  const handleRef = useRef(handleUpdateCampaign)
  handleRef.current = handleUpdateCampaign
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const setEnabled = async (campaign, next) => {
    if (!campaign || inFlight.current.has(campaign.id)) return
    if (next) {
      // redesign D-6 (owner, 2026-10-19): the confirmation comes BEFORE the call and before the switch shows busy
      const name = typeof campaign.name === 'string' ? campaign.name.trim() : ''
      // only a campaign KNOWN to have no rules says so; a row that carries no conditions at all gets the usual sentence
      const noRules = (Array.isArray(campaign.conditions) || typeof campaign.conditions === 'string') && asConditions(campaign.conditions).length === 0
      const confirmed = await ask({
        title: name
          ? t('CAMPAIGNS_ACTIVATE_TITLE', 'Activate "_name_"?').replace('_name_', () => name)
          : t('CAMPAIGNS_ACTIVATE_TITLE_UNNAMED', 'Activate this campaign?'),
        body: noRules
          ? t('CAMPAIGNS_ACTIVATE_BODY_NO_RULES', 'This campaign has no rules: it starts sending to all your customers. Sent messages can\'t be undone.')
          : t('CAMPAIGNS_ACTIVATE_BODY', 'It starts sending to the customers who match its rules. Sent messages can\'t be undone.'),
        confirmLabel: t('CAMPAIGNS_ACTIVATE_CONFIRM', 'Activate campaign'),
        tone: 'primary'
      })
      if (!confirmed || !mounted.current || inFlight.current.has(campaign.id)) return
    }
    inFlight.current.add(campaign.id)
    setPendingIds(ids => [...ids, campaign.id])
    let result
    try {
      result = await handleRef.current?.(campaign.id, { enabled: next })
    } catch (error) {
      result = { ok: false, error: null }
    }
    inFlight.current.delete(campaign.id)
    if (!mounted.current) return
    setPendingIds(ids => ids.filter(id => id !== campaign.id))
    if (result && result.ok === false) {
      const messages = messagesOf(result.error)
      setFailure({
        title: t('CAMPAIGNS_TOGGLE_FAILED', "We couldn't change the campaign"),
        content: messages.length > 0 ? messages : [t('CAMPAIGNS_TOGGLE_ERROR', 'Something went wrong. Try again.')]
      })
    }
  }

  const alert = failure ? { ...failure, close: () => setFailure(null) } : null

  return { pendingIds, setEnabled, alert, dialog }
}
