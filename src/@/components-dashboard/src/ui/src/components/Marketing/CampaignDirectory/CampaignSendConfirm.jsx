import React from 'react'

import { useLanguage } from '../../../../../index'
import { ConfirmDialog } from '../../Shared/Product'
import { formatCount } from './campaignData'

// redesign CA-B5 (decision 5, decision 25 · C8; M-CA1): the confirmation of «Send now», the only button that creates a fixed campaign that
// goes out at once. It names the campaign, says what happens with the channel and the number of customers, and starts on «Cancel» (the
// contract of ConfirmDialog). The number is only given while it is FRESH (the host decides): without it the text says «every customer who
// matches the rules», never a stale figure.
//
// @param {boolean}      props.open
// @param {string}       [props.name]       The name of the campaign; empty or blank gives «Send this campaign now?».
// @param {string}       props.channel      `contact_type`: email, sms, notification. Another channel is «campaign».
// @param {number|null}  [props.count]     Customers that match the rules right now, or null/undefined when it is not known or not fresh.
// @param {boolean}      [props.hasRules]   redesign CA-R2 (M1): the campaign has at least one finished rule (default true, as before). Without
//                                          rules the text says so and that it goes to ALL the customers; no count is ever shown then.
// @param {boolean}      [props.busy]       The campaign is being sent: neither button answers.
// @param {Function}     props.onConfirm
// @param {Function}     props.onCancel

// Every word is a LITERAL t() call in a map of functions, so the key scanner sees it (a built key would stay in English in every language)
// redesign CA-R2 (M1): `noRules` is the text of a campaign with no rules at all («all your customers»), one key per channel
const BODY = {
  notification: {
    one: (t) => t('CAMPAIGNS_SEND_BODY_NOTIFICATION_ONE', 'This sends a push notification to _count_ customer who matches the rules. It can\'t be undone.'),
    other: (t) => t('CAMPAIGNS_SEND_BODY_NOTIFICATION_OTHER', 'This sends a push notification to _count_ customers who match the rules. It can\'t be undone.'),
    none: (t) => t('CAMPAIGNS_SEND_BODY_NOTIFICATION', 'This sends a push notification to every customer who matches the rules. It can\'t be undone.'),
    noRules: (t) => t('CAMPAIGNS_SEND_BODY_NOTIFICATION_NO_RULES', 'This campaign has no rules: it sends a push notification to all your customers. It can\'t be undone.')
  },
  email: {
    one: (t) => t('CAMPAIGNS_SEND_BODY_EMAIL_ONE', 'This sends an email to _count_ customer who matches the rules. It can\'t be undone.'),
    other: (t) => t('CAMPAIGNS_SEND_BODY_EMAIL_OTHER', 'This sends an email to _count_ customers who match the rules. It can\'t be undone.'),
    none: (t) => t('CAMPAIGNS_SEND_BODY_EMAIL', 'This sends an email to every customer who matches the rules. It can\'t be undone.'),
    noRules: (t) => t('CAMPAIGNS_SEND_BODY_EMAIL_NO_RULES', 'This campaign has no rules: it sends an email to all your customers. It can\'t be undone.')
  },
  sms: {
    one: (t) => t('CAMPAIGNS_SEND_BODY_SMS_ONE', 'This sends a text message to _count_ customer who matches the rules. It can\'t be undone.'),
    other: (t) => t('CAMPAIGNS_SEND_BODY_SMS_OTHER', 'This sends a text message to _count_ customers who match the rules. It can\'t be undone.'),
    none: (t) => t('CAMPAIGNS_SEND_BODY_SMS', 'This sends a text message to every customer who matches the rules. It can\'t be undone.'),
    noRules: (t) => t('CAMPAIGNS_SEND_BODY_SMS_NO_RULES', 'This campaign has no rules: it sends a text message to all your customers. It can\'t be undone.')
  },
  generic: {
    one: (t) => t('CAMPAIGNS_SEND_BODY_GENERIC_ONE', 'This sends the campaign to _count_ customer who matches the rules. It can\'t be undone.'),
    other: (t) => t('CAMPAIGNS_SEND_BODY_GENERIC_OTHER', 'This sends the campaign to _count_ customers who match the rules. It can\'t be undone.'),
    none: (t) => t('CAMPAIGNS_SEND_BODY_GENERIC', 'This sends the campaign to every customer who matches the rules. It can\'t be undone.'),
    noRules: (t) => t('CAMPAIGNS_SEND_BODY_GENERIC_NO_RULES', 'This campaign has no rules: it sends the campaign to all your customers. It can\'t be undone.')
  }
}

const CONFIRM_NONE = {
  notification: (t) => t('CAMPAIGNS_SEND_CONFIRM_NOTIFICATION', 'Send push notification'),
  email: (t) => t('CAMPAIGNS_SEND_CONFIRM_EMAIL', 'Send email'),
  sms: (t) => t('CAMPAIGNS_SEND_CONFIRM_SMS', 'Send text message'),
  generic: (t) => t('CAMPAIGNS_SEND_CONFIRM_GENERIC', 'Send campaign')
}

// Own property only: a channel such as `constructor` must not find a function on the prototype of the map
const own = (map, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key)

// The figure goes in a node of its own (`odc-figure`, decision 11); the text around it is the translation's
const withFigure = (template, figure) => {
  const [before, ...rest] = template.split('_count_')
  if (rest.length === 0) return template
  return (
    <>
      {before}
      <span className='odc-figure'>{figure}</span>
      {rest.join('_count_')}
    </>
  )
}

export const CampaignSendConfirm = ({ open = false, name, channel, count, hasRules = true, busy = false, onConfirm, onCancel }) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code // redesign CA-R1 (live check): the count is written at render; `count` stays a number
  const key = own(BODY, channel) && channel !== 'generic' ? channel : 'generic'
  // redesign CA-R2 (M1): without rules there is nothing to count (the controller never asks), so a figure is never shown
  const known = hasRules && typeof count === 'number' && Number.isFinite(count) && count >= 0
  const plural = count === 1 ? 'one' : 'other'
  const label = typeof name === 'string' ? name.trim() : ''

  const title = label
    ? t('CAMPAIGNS_SEND_TITLE', 'Send "_name_" now?').replace('_name_', () => label)
    : t('CAMPAIGNS_SEND_TITLE_UNNAMED', 'Send this campaign now?')

  const shown = known ? formatCount(count, locale) : null
  const description = known ? withFigure(BODY[key][plural](t), shown) : hasRules ? BODY[key].none(t) : BODY[key].noRules(t)

  const confirmLabel = known
    ? withFigure(count === 1 ? t('CAMPAIGNS_SEND_CONFIRM_ONE', 'Send to _count_ customer') : t('CAMPAIGNS_SEND_CONFIRM_OTHER', 'Send to _count_ customers'), shown)
    : CONFIRM_NONE[key](t)

  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={t('CANCEL', 'Cancel')}
      closeLabel={t('CLOSE', 'Close')}
      tone='primary'
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {description}
    </ConfirmDialog>
  )
}
