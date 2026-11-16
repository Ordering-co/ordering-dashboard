import React, { useEffect, useId, useRef, useState } from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { AlertDialog, Button, InlineNotice, RadioGroup, Skeleton, TextField } from '../../Shared/Product'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { describeDateFormat, formatDay, formatVisibleDay } from '../../../../../utils/dateRange'
import { CampaignEmail } from '../CampaignEmail'
import { CampaignSMS } from '../CampaignSMS'
import { CampaignNotification } from '../CampaignNotification'
import { AUDIENCE_TYPES, CREATABLE_CHANNELS, RULE_TYPES, audienceLabel, channelLabel, formatCount } from './campaignData'
import {
  actionOf,
  buildOverrides,
  conditionsKey,
  dateSettings,
  fixedOperatorProblem,
  incompleteRule,
  isDirty,
  missingForSend,
  ruleProblem,
  splitStamp,
  stampOf,
  toDraft
} from './campaignDraft'
import { CampaignDelivery } from './CampaignDelivery'
import { CampaignRules } from './CampaignRules'
import { CampaignSendConfirm } from './CampaignSendConfirm'
import './campaign-form.css'

// redesign CA-B5 (decision 3, decision 5, decision 7; M-CA1, M-CA2, M-CA7, M-CA9, M-CA12, M-CA13): the create form of a campaign. One column,
// no <form> element (the embedded settings list of the channel editors has its own saves and must not end up inside one):
//   Name · Channel · Audience (rules + the reach) · Message (the editor of the channel, ONCE) · Delivery (after an audience)
// and ONE button that says what it does: «Send now» (fixed, as soon as possible: it asks first), «Schedule campaign» (fixed, later) or
// «Create campaign» (dynamic). redesign D-6 (owner, 2026-10-19): a dynamic campaign that is ACTIVE also asks first («Create and
// activate»), because it starts sending to whoever already matches the rules; with «Active» off it is created without a dialog.
//
// HOW THE FOOTER REACHES RecordPanel (CA-B6 depends on this): RecordPanel pins `footer` under its body, outside its `children`, so the form
// cannot put the footer there by itself. `children` of this component is a RENDER PROP:
//
//     <CampaignCreateForm {...controllerProps} onDirtyChange={...} onCancel={...}>
//       {({ body, footer, dirty }) => (
//         <RecordPanel title=... closeLabel=... dirty={dirty} footer={footer} ...discardTexts>{body}</RecordPanel>
//       )}
//     </CampaignCreateForm>
//
// `body` holds the sections and the dialogs (the confirmation and the error), `footer` the reason line, «Cancel» and the one button, `dirty`
// the same boolean as `onDirtyChange`. Without a render prop the form draws `body` and then `footer`. It needs no `footerHost`.
//
// Props: everything K/CampaignDetail gives its UI (`formState`, `contactState`, `audienceState`, `categoryList`, `handleChangeInput`,
// `handleChangeItem`, `handleChangeType`, `handleChangeData`, `handleChangeContact`, `handleAddCampaign`, …) plus
//   - `onDirtyChange(bool)`: true as soon as any field has a value (name, title, body, a rule, a date);
//   - `onCancel()`: «Cancel» asks the host to close (the host's discard guard applies); without it, `onClose` of the controller.

const EDITORS = { email: CampaignEmail, sms: CampaignSMS, notification: CampaignNotification }

// The first thing that is missing, in words. A map of LITERAL t() calls (never a built key).
const REASONS = {
  name: (t) => t('CAMPAIGNS_MISSING_NAME', 'Add a name'),
  rules: (t) => t('CAMPAIGNS_MISSING_RULES', 'Add at least one rule'),
  end_date: (t) => t('CAMPAIGNS_MISSING_END_DATE', 'Choose an end date'),
  channel: (t) => t('CAMPAIGNS_MISSING_CHANNEL', 'Choose a channel'),
  audience: (t) => t('CAMPAIGNS_MISSING_AUDIENCE', 'Choose an audience: Fixed or Dynamic'),
  title: (t) => t('CAMPAIGNS_MISSING_TITLE', 'Add a title'),
  body: (t) => t('CAMPAIGNS_MISSING_BODY', 'Write the message'),
  schedule_date: (t) => t('REQUIRED_SCHEDULED_DATE', 'Scheduled date is required')
}

const ACTIONS = {
  send: (t) => t('CAMPAIGNS_ACTION_SEND_NOW', 'Send now'),
  schedule: (t) => t('CAMPAIGNS_ACTION_SCHEDULE', 'Schedule campaign'),
  create: (t) => t('CAMPAIGNS_ACTION_CREATE', 'Create campaign')
}

const REACH = {
  one: (t) => t('CAMPAIGNS_REACH_ONE', 'Reaches _count_ customer'),
  other: (t) => t('CAMPAIGNS_REACH_OTHER', 'Reaches _count_ customers')
}

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

// The messages of an error of the API: a string, a list of strings, or a list of lists
const messagesOf = (error) => {
  if (typeof error === 'string') return error.trim() ? [error] : []
  if (!Array.isArray(error)) return []
  return error.flat().filter(item => typeof item === 'string' && item.trim())
}

// The number of customers the audience endpoint counted, or null
const countOf = (audienceState) => {
  const total = audienceState?.pagination?.total
  if (total === null || total === undefined || total === '') return null
  const number = Number(total)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export const CampaignCreateForm = (props) => {
  const { children, onDirtyChange, onCancel, ...controller } = props
  const {
    formState,
    contactState,
    audienceState,
    categoryList,
    handleChangeInput,
    handleChangeItem,
    handleChangeType,
    handleAddCampaign,
    onClose
  } = controller

  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code // redesign CA-R1 (live check): the reach is written in the person's number format
  const [{ configs } = {}] = useConfig() || []
  const [{ parseDate } = {}] = useUtils() || []
  const { ask, dialog: activateDialog } = useConfirmStep() // redesign D-6: «create and start sending»
  const ids = { name: useId(), channel: useId(), audience: useId(), message: useId(), delivery: useId(), reason: useId() }

  // What only the form knows (see toDraft). The ASAP / later choice lives HERE, not in the delivery section, so no change of channel,
  // audience or section can lose it (M-CA12).
  const [delivery, setDelivery] = useState({ when: 'asap', scheduledTime: undefined, endTime: undefined })
  const [rows, setRows] = useState(() => (Array.isArray(formState?.changes?.conditions) ? formState.changes.conditions : []))
  const [configured, setConfigured] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const submittingRef = useRef(false)
  const messageHeading = useRef(null)

  const draft = toDraft(formState, contactState, {
    when: delivery.when,
    scheduledTime: delivery.scheduledTime,
    endTime: delivery.endTime,
    conditions: rows,
    isConfigured: configured
  })
  const missing = missingForSend(draft)
  const action = actionOf(draft)
  const dirty = isDirty(draft)

  useEffect(() => {
    if (typeof onDirtyChange === 'function') onDirtyChange(dirty)
  }, [dirty])

  // ---- the reach: a count is shown only while it is FRESH (auditor #3) --------------------------------------------------------------
  // The controller counts only when the rules change and there is at least one. The count is the answer for the rules and the channel
  // that were in the form when `loading` turned true; any other state of the form has no count to show.
  const loading = !!audienceState?.loading
  const controllerKey = conditionsKey(formState?.changes?.conditions)
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    if (loading) setSnapshot({ key: controllerKey, channel: draft.channel })
  }, [loading])
  const count = countOf(audienceState)
  const fresh = !loading && !audienceState?.error && snapshot !== null && snapshot.key === controllerKey && snapshot.channel === draft.channel && count !== null

  // ---- writes to the controller: ONE call per user action (its handlers close over the state of the last render) -------------------
  const onName = (value) => handleChangeInput({ target: { name: 'name', value } })

  const onChannel = (value) => {
    setConfigured(null) // the editor of the new channel tells it again when it mounts
    handleChangeType('contact_type', value)
  }

  const onAudience = (value) => handleChangeItem('audience_type', value)

  const onRules = (next) => {
    setRows(next)
    // the controller counts and sends what it holds: only the finished rules. Copies, because it deletes null keys in place before counting.
    const finished = next.filter(row => !ruleProblem(row)).map(row => ({ ...row }))
    if (conditionsKey(finished) !== controllerKey) handleChangeItem('conditions', finished)
  }

  const onDelivery = (patch) => {
    if ('when' in patch) {
      setDelivery(current => ({ ...current, when: patch.when }))
      if (patch.when === 'asap' && draft.scheduledAt) handleChangeItem('scheduled_at', null)
    } else if ('scheduledDay' in patch) {
      handleChangeItem('scheduled_at', patch.scheduledDay ? stampOf(patch.scheduledDay, draft.scheduledTime) : null)
    } else if ('scheduledTime' in patch) {
      setDelivery(current => ({ ...current, scheduledTime: patch.scheduledTime }))
      const { day } = splitStamp(draft.scheduledAt)
      if (day) handleChangeItem('scheduled_at', stampOf(day, patch.scheduledTime))
    } else if ('enabled' in patch) {
      handleChangeItem('enabled', patch.enabled)
    } else if ('endDay' in patch) {
      handleChangeItem('end_at', patch.endDay ? stampOf(patch.endDay, draft.endTime) : null)
    } else if ('endTime' in patch) {
      setDelivery(current => ({ ...current, endTime: patch.endTime }))
      const { day } = splitStamp(draft.endAt)
      if (day) handleChangeItem('end_at', stampOf(day, patch.endTime))
    }
  }

  // ---- send -------------------------------------------------------------------------------------------------------------------------
  const send = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const result = await handleAddCampaign(buildOverrides(draft))
      setConfirmOpen(false)
      if (result && result.ok === false) {
        const messages = messagesOf(result.error)
        setFailure({ content: messages.length ? messages : [t('CAMPAIGNS_CREATE_FAILED', 'The campaign could not be created.')] })
      }
    } catch (error) {
      setConfirmOpen(false)
      const messages = messagesOf(error?.message)
      setFailure({ content: messages.length ? messages : [t('CAMPAIGNS_CREATE_FAILED', 'The campaign could not be created.')] })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // The button. A campaign that goes out NOW never reaches `send` without the confirmation: this is the only way in for «Send now», and
  // the dialog's own confirm button the only one that calls `send` (M-CA1, decision 25).
  // redesign D-6 (owner, 2026-10-19): the same for a dynamic campaign that is Active (it starts sending to whoever matches the
  // rules and messages can't be unsent). Dynamic with «Active» off and fixed + later are created without a dialog, as main.
  const press = async () => {
    if (missing.length > 0 || submittingRef.current || formState?.loading) return
    if (action === 'send') {
      setConfirmOpen(true)
      return
    }
    if (draft.audience === 'dynamic' && draft.enabled !== false) {
      const label = draft.name.trim()
      const confirmed = await ask({
        title: label
          ? t('CAMPAIGNS_CREATE_ACTIVE_TITLE', 'Create "_name_" and start sending?').replace('_name_', () => label)
          : t('CAMPAIGNS_CREATE_ACTIVE_TITLE_UNNAMED', 'Create this campaign and start sending?'),
        body: t('CAMPAIGNS_ACTIVATE_BODY', 'It starts sending to the customers who match its rules. Sent messages can\'t be undone.'),
        confirmLabel: t('CAMPAIGNS_CREATE_ACTIVE_CONFIRM', 'Create and activate'),
        tone: 'primary'
      })
      if (!confirmed) return
    }
    send()
  }

  const goToSetup = () => {
    const heading = messageHeading.current
    if (!heading) return
    if (typeof heading.scrollIntoView === 'function') heading.scrollIntoView({ block: 'start' })
    heading.focus()
  }

  // ---- words ------------------------------------------------------------------------------------------------------------------------
  const channelName = draft.channel ? channelLabel(t, draft.channel) : ''
  const setupText = t('CAMPAIGNS_SETUP_NEEDED', 'Set up _channel_ before you can send').replace('_channel_', () => channelName)

  const reasonText = (id) => {
    if (id === 'setup') return setupText
    if (id === 'rule_incomplete') {
      const rule = incompleteRule(draft)
      const rule_ = rule ? ruleLabelOf(rule.type, t) : ''
      return t('CAMPAIGNS_MISSING_RULE', 'Finish the rule "_rule_"').replace('_rule_', () => rule_)
    }
    if (id === 'rule_fixed_operator') {
      const rule = draft.conditions.find(condition => fixedOperatorProblem(condition))
      return fixedOperatorProblem(rule) === 'count'
        ? t('REQUIRED_MORE_OR_LESS_OPTION_WHEN_FIXED', 'when audience type is Fixed, order condition is required More or Less option')
        : t('REQUIRED_BEFORE_OR_RANGE_OPTION_WHEN_FIXED', 'when audience type is Fixed, date condition is required Before or Date range option')
    }
    return Object.prototype.hasOwnProperty.call(REASONS, id) ? REASONS[id](t) : ''
  }
  const reason = missing.length > 0 ? reasonText(missing[0]) : ''

  // ---- date helpers for the rules ---------------------------------------------------------------------------------------------------
  const { dateFormat } = dateSettings(configs)
  const spec = describeDateFormat(dateFormat)
  const formatDate = (stamp) => {
    const day = typeof stamp === 'string' ? stamp.slice(0, 10) : ''
    return parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec)
  }

  // ---- the sections -----------------------------------------------------------------------------------------------------------------
  const Editor = EDITORS[draft.channel]
  const reachLine = (() => {
    if (loading) {
      return (
        <p className='odc-campaign-reach' aria-busy='true'>
          <Skeleton size='40%' />
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        </p>
      )
    }
    if (snapshot === null) return null
    if (audienceState?.error) return <p className='odc-campaign-reach'>{t('CAMPAIGNS_REACH_ERROR', 'Couldn\'t count the audience')}</p>
    if (!fresh) return <p className='odc-campaign-reach'>{t('CAMPAIGNS_REACH_UNAVAILABLE', 'Count not available')}</p>
    return <p className='odc-campaign-reach'>{withFigure(REACH[count === 1 ? 'one' : 'other'](t), formatCount(count, locale))}</p>
  })()

  const body = (
    <div className='odc-root odc-campaign-form'>
      <section className='odc-campaign-section' aria-labelledby={ids.name}>
        <h3 id={ids.name} className='odc-campaign-section-title'>{t('NAME', 'Name')}</h3>
        <TextField aria-label={t('NAME', 'Name')} value={draft.name} onChange={onName} />
      </section>

      <section className='odc-campaign-section' aria-labelledby={ids.channel}>
        <h3 id={ids.channel} className='odc-campaign-section-title'>{t('CHANNEL', 'Channel')}</h3>
        <RadioGroup
          hideLabel
          label={t('CHANNEL', 'Channel')}
          value={draft.channel}
          onValueChange={onChannel}
          options={CREATABLE_CHANNELS.map(channel => ({ value: channel, label: channelLabel(t, channel) }))}
        />
        {draft.channel && configured === false && !categoryList?.loading && (
          <InlineNotice
            tone='warning'
            action={<Button variant='link' onClick={goToSetup}>{t('CAMPAIGNS_GO_TO_SETUP', 'Go to setup')}</Button>}
          >
            {setupText}
          </InlineNotice>
        )}
      </section>

      <section className='odc-campaign-section' aria-labelledby={ids.audience}>
        <h3 id={ids.audience} className='odc-campaign-section-title'>{t('AUDIENCE', 'Audience')}</h3>
        <RadioGroup
          hideLabel
          label={t('AUDIENCE', 'Audience')}
          value={draft.audience}
          onValueChange={onAudience}
          options={AUDIENCE_TYPES.map(type => ({
            value: type,
            label: audienceLabel(t, type),
            description: type === 'fixed'
              ? t('CAMPAIGN_FIXED_DESCRIPTION', 'Only people who match rules right now')
              : t('CAMPAIGN_DYNAMIC_DESCRIPTION', 'People who match rules now and in the future')
          }))}
        />
        <CampaignRules conditions={rows} onChange={onRules} formatDate={formatDate} />
        {reachLine}
      </section>

      <section className='odc-campaign-section' aria-labelledby={ids.message}>
        <h3 id={ids.message} ref={messageHeading} tabIndex={-1} className='odc-campaign-section-title'>{t('MESSAGE', 'Message')}</h3>
        {Editor
          // one editor, one embedded settings list: it keeps its own gate, «Tech Support» and the help link (decision 34)
          ? <Editor key={draft.channel} {...controller} hideActions onConfigStateChange={setConfigured} />
          : <p className='odc-campaign-muted'>{t('CAMPAIGNS_CHOOSE_CHANNEL_FIRST', 'Choose a channel first')}</p>}
      </section>

      {draft.audience && (
        <section className='odc-campaign-section' aria-labelledby={ids.delivery}>
          <h3 id={ids.delivery} className='odc-campaign-section-title'>{t('DELIVERY', 'Delivery')}</h3>
          <CampaignDelivery audienceType={draft.audience} draft={draft} onChange={onDelivery} />
        </section>
      )}

      <CampaignSendConfirm
        open={confirmOpen}
        name={draft.name}
        channel={draft.channel}
        count={fresh ? count : null}
        busy={submitting || !!formState?.loading}
        onConfirm={send}
        onCancel={() => setConfirmOpen(false)}
      />
      {activateDialog}
      <AlertDialog
        open={failure !== null}
        title={t('CAMPAIGN', 'Campaign')}
        content={failure?.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={() => setFailure(null)}
      />
    </div>
  )

  const footer = (
    // redesign CA-R2 (P1): `odc-campaign-foot` is the table's pagination foot; the form's footer has its own class
    <div className='odc-root odc-campaign-form-foot'>
      {reason && <p id={ids.reason} className='odc-campaign-form-foot-reason'>{reason}</p>}
      <div className='odc-campaign-form-foot-actions'>
        <Button onClick={onCancel || onClose}>{t('CANCEL', 'Cancel')}</Button>
        <Button
          variant='primary'
          busy={submitting || !!formState?.loading}
          disabled={missing.length > 0}
          aria-describedby={reason ? ids.reason : undefined}
          onClick={press}
        >
          {ACTIONS[action](t)}
        </Button>
      </div>
    </div>
  )

  if (typeof children === 'function') return children({ body, footer, dirty })
  return (
    <>
      {body}
      {footer}
    </>
  )
}

// The name of a rule type for the reason line (the same words the rows use)
const ruleLabelOf = (type, t) => RULE_TYPES.find(rule => rule.type === type)?.label(t) ?? t('CAMPAIGNS_RULE_UNKNOWN', 'Rule')
