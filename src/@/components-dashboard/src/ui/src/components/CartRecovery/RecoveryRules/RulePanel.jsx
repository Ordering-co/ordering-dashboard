import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  RecoveryActionDetail as RecoveryActionDetailController,
  RecoveryNotificationList as RecoveryNotificationListController,
  useLanguage
} from '../../../../../index'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { formatWait, ruleWait } from '../../../../../utils/recoveryRules'
import { CircleAlert, Ellipsis, Maximize2, Minimize2, Trash2, TriangleAlert } from '../../Shared/Icon'
import {
  AsyncSwitch,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  Menu,
  RecordPanel,
  SegmentedControl,
  Skeleton,
  TextArea,
  TextField,
  useSplitView
} from '../../Shared/Product'
// by file, as main did (CartRecovery/SingleRecoveryNotification): it loads its own legacy styles, so it is not part of the Product barrel
import { RichHtmlEditor } from '../../Shared/RichHtmlEditor'
import { MessagePreview } from './MessagePreview'
import { RuleMessages, firstMessage } from './RuleMessages'
import { RESULT_KEYS, ResultFigure, resultLabels, resultsStatus, useResultFormatters } from './RuleResults'
import { RuleWaitField } from './RuleWaitField'
import './recovery-rule-panel.css'

// redesign RA-B3 (decisions 1, 3, 4 and 6; M-RA3, M-RA6, M-RA7, M-RA12, M-RA15, M-RA16): the one panel of /cart-recovery/recovery-actions,
// a RecordPanel inside the page's SplitView (it replaces the two tabs of main and the add page). It is the UIComponent of
// K/RecoveryActionDetail and has three bodies:
//   - create (`isAddMode`): Details, When and the FIRST message with a live facsimile; «Create rule» validates in line (RuleCreate);
//   - a rule: Results, When, Details and Messages in one column (RuleEditor). «Save changes» saves ONLY what changed; Messages are connected to
//     K/RecoveryNotificationList (see MessagesBridge);
//   - loading / failing to load a rule: a skeleton / an error state with «Retry» and «Close».

const CHANNELS = ['email', 'sms', 'notification']
const CHANNEL_NAMES = {
  email: (t) => t('EMAIL', 'Email'),
  sms: (t) => t('SMS', 'SMS'),
  notification: (t) => t('PUSH_NOTIFICATION', 'Push notification')
}

// The one value an empty object stands for: a stable `action` for the controller, which asks the API again whenever it changes
const NO_RULE = Object.freeze({})
const isEmptyObject = (value) => value == null || (typeof value === 'object' && Object.keys(value).length === 0)

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))
const errorText = (t, error, fallback) => translateApiMessage(t, firstMessage(error), fallback)

// What the message holds. An email is HTML: the editor emits '' when it is empty (the old Summernote left `<p><br></p>`, still counted as empty), and a message that is only an image or a video
// is still a message.
const hasContent = (body, channel) => {
  const text = String(body ?? '')
  if (channel !== 'email') return text.trim() !== ''
  if (/<(img|video|iframe|embed|object)\b/i.test(text)) return true
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() !== ''
}

const FieldError = ({ children, id }) => (
  <p id={id} className='odc-ra-field-error' role='alert'>
    <CircleAlert className='odc-icon odc-ra-field-error-icon' aria-hidden='true' />
    <span>{children}</span>
  </p>
)

// The figure goes in a node of its own (`odc-figure`, decision 11); the words around it are the translation's
const withFigures = (template, figures) => {
  const parts = template.split(/(_new_|_old_)/)
  return parts.map((part, index) => (
    part === '_new_' || part === '_old_'
      ? <span key={index} className='odc-figure'>{figures[part]}</span>
      : <React.Fragment key={index}>{part}</React.Fragment>
  ))
}

const focusFirst = (container) => {
  const target = container?.querySelector?.('input, textarea, select, [contenteditable="true"], button')
  if (target && typeof target.focus === 'function') target.focus()
}

const BodySkeleton = ({ label }) => (
  <div className='odc-ra-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

// ---- Results: what the rule has done (sent, recovered, revenue); they load apart from the rule, so they fail apart too ----------------
const RuleResults = ({ stats, onRetry, labelledBy, t }) => {
  const format = useResultFormatters()
  const status = resultsStatus(stats)
  const names = resultLabels(t)
  return (
    <>
      {status === 'error'
        ? (
          <div className='odc-ra-results-error' role='status'>
            <span>{t('RECOVERY_RULES_RESULTS_ERROR', "We couldn't load the results of this rule.")}</span>
            <Button variant='link' size='sm' className='odc-ra-retry' onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>
          </div>
          )
        : (
          <dl className='odc-ra-results' aria-labelledby={labelledBy}>
            {RESULT_KEYS.map(kind => (
              <div key={kind} className='odc-ra-result'>
                <dt className='odc-ra-result-label'>{names[kind]}</dt>
                <dd className='odc-ra-result-figure'>
                  <ResultFigure kind={kind} stats={stats} format={format} t={t} skeletonSize='calc(var(--od-x-type-title-size) * 4)' />
                </dd>
              </div>
            ))}
          </dl>
          )}
      <p className='odc-ra-muted'>
        {t('RECOVERY_RULES_RESULTS_HELP', 'A cart counts as recovered when it became an order after this rule wrote to the customer.')}
      </p>
    </>
  )
}

// ---- Messages: K/RecoveryNotificationList with this as its UIComponent -----------------------------------------------------------------
// The controller holds the channels of ONE rule. This bridge gives RuleMessages its state and handlers, and hands the HOST (the page's
// RuleMessageDialog, RA-B5) the three writes of the controller in `channelActions` — `{ add, save, remove, reload }`, one stable object
// whose functions always call the LATEST handlers of the controller (they close over its state) — both in the payload of
// `onEditMessage` and, for a dialog that opens without a click here (a rule just created whose first message failed), in
// `channelActionsRef.current`, which is set while this section is mounted.
const MessagesBridge = (props) => {
  const {
    rule,
    notificationListState,
    handleUpdateClick,
    handleAddChannel,
    handleSaveChannel,
    handleDeleteChannel,
    reload,
    onEditMessage,
    channelActionsRef,
    sectionRef,
    initialSection
  } = props

  // redesign R2-F1 (R1-09): `?tab=notifications` scrolls to Messages once the messages have LOADED. At mount they are still loading and the
  // panel has no height to scroll, so the scroll waits for the load to end (a load that has not started yet is not a load that ended: the
  // controller flips `loading` right after it mounts) and happens once.
  const loadingNow = Boolean(notificationListState?.loading)
  const sawLoading = useRef(false)
  if (loadingNow) sawLoading.current = true
  const scrolled = useRef(false)
  useEffect(() => {
    if (initialSection !== 'messages' || scrolled.current || loadingNow) return
    const settled = sawLoading.current || (notificationListState?.notifications?.length ?? 0) > 0 || hasError(notificationListState?.error)
    const section = sectionRef?.current
    if (!settled || !section || typeof section.scrollIntoView !== 'function') return
    scrolled.current = true
    section.scrollIntoView({ block: 'start' })
  }, [initialSection, loadingNow, notificationListState, sectionRef])

  const latest = useRef(null)
  latest.current = { handleAddChannel, handleSaveChannel, handleDeleteChannel, reload }
  const actions = useMemo(() => ({
    add: (...args) => latest.current.handleAddChannel(...args),
    save: (...args) => latest.current.handleSaveChannel(...args),
    remove: (...args) => latest.current.handleDeleteChannel(...args),
    reload: (...args) => latest.current.reload(...args)
  }), [])

  useEffect(() => {
    if (!channelActionsRef) return undefined
    channelActionsRef.current = actions
    return () => {
      if (channelActionsRef.current === actions) channelActionsRef.current = null
    }
  }, [actions, channelActionsRef])

  return (
    <RuleMessages
      rule={rule}
      sectionRef={sectionRef}
      channelsState={{
        loading: Boolean(notificationListState?.loading),
        notifications: notificationListState?.notifications ?? [],
        error: notificationListState?.error ?? null
      }}
      onRetry={() => actions.reload()}
      onToggle={(message, next) => handleUpdateClick(message.id, { enabled: next })}
      onEdit={(message) => onEditMessage?.({ mode: 'edit', rule, channel: message, channelActions: actions })}
      onAdd={() => onEditMessage?.({ mode: 'add', rule, channel: null, channelActions: actions })}
    />
  )
}

// ---- create ----------------------------------------------------------------------------------------------------------------------------
const RuleCreate = ({ handleCreateRule, onClose, onCreated, onDirtyChange, headerActions, closeLabel, discard }) => {
  const [, t] = useLanguage()
  const confirmStep = useConfirmStep() // redesign D-76 (owner, 2026-10-19): the question before the rule is created
  const ids = { details: useId(), when: useId(), message: useId(), messageLabel: useId(), bodyError: useId() }
  const panelRef = useRef(null)
  const nameRef = useRef(null)
  const waitRef = useRef(null)
  const channelRef = useRef(null)
  const titleRef = useRef(null)
  const bodyRef = useRef(null)
  const submittingRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [seconds, setSeconds] = useState(null)
  const [channel, setChannel] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)

  // The page asks before it drops a half-typed draft, so it needs to know when there is one; leaving create mode says «clean»
  const dirty = Boolean(name || description || seconds !== null || channel || title || body)
  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  useEffect(() => { dirtyRef.current?.(dirty) }, [dirty])
  useEffect(() => () => { dirtyRef.current?.(false) }, [])

  const required = t('FIELD_REQUIRED', 'This field is required')
  const problems = {
    name: name.trim() === '' ? t('NAME_IS_REQUIRED', 'Name is required') : null,
    wait: seconds === null
      ? t('RECOVERY_RULES_WAIT_REQUIRED', 'Enter how long to wait before sending.')
      : seconds === 0 ? t('RECOVERY_RULES_WAIT_POSITIVE', 'Wait at least 1 second.') : null,
    channel: channel ? null : t('CAMPAIGNS_MISSING_CHANNEL', 'Choose a channel'),
    title: channel && title.trim() === '' ? required : null,
    body: channel && !hasContent(body, channel) ? required : null
  }
  // Once the person has tried, the errors follow what they type
  const errors = attempted ? problems : {}

  const focusers = {
    name: () => nameRef.current?.focus(),
    wait: () => focusFirst(waitRef.current),
    channel: () => focusFirst(channelRef.current),
    title: () => titleRef.current?.focus(),
    body: () => focusFirst(bodyRef.current)
  }

  const onChannel = (next) => {
    if (next === channel) return
    setChannel(next)
    setBody('') // main empties it too: the HTML of an email is not the text of an SMS
  }

  const submit = async () => {
    if (submittingRef.current) return
    setAttempted(true)
    const first = ['name', 'wait', 'channel', 'title', 'body'].find(key => problems[key])
    if (first) {
      focusers[first]()
      return
    }
    // redesign D-76 (owner, 2026-10-19): the rule is created switched on («Starts sending as soon as you create it»), so the
    // question comes BEFORE the controller call. Cancel (or Escape) writes nothing and leaves the form as it was. The ref guards a second
    // press while it asks; the button is not busy until the person says yes.
    submittingRef.current = true
    const confirmed = await confirmStep.ask({
      // a rule name is often a question: drop its mark so the title does not read «…order? and start sending?»
      title: t('RECOVERY_RULES_CREATE_ASK_TITLE', 'Create _name_ and start sending?').replace('_name_', () => name.trim().replace(/\s*[?？]+$/, '')),
      body: t('RECOVERY_RULES_START_SENDING_BODY', 'Customers who leave a cart start getting its messages.'),
      confirmLabel: t('RECOVERY_RULES_CREATE', 'Create rule'),
      tone: 'primary'
    })
    if (!confirmed || !mounted.current) {
      submittingRef.current = false
      return
    }
    setSubmitting(true)
    setFailure(null)
    const message = { channel, title: title.trim(), body }
    let result
    try {
      result = await handleCreateRule({
        rule: { name: name.trim(), description, times: [seconds] },
        channel: message
      })
    } catch (error) {
      result = { ok: false, stage: 'rule', error: [error?.message] }
    }
    submittingRef.current = false
    if (!mounted.current) return
    setSubmitting(false)
    if (result?.ok && result.rule) {
      onCreated?.(result.rule)
    } else if (result?.stage === 'channel' && result.rule) {
      // The rule exists: the page moves the panel to it and opens the message dialog filled in, with this error
      onCreated?.(result.rule, { pendingMessage: { ...message, error: result.error } })
    } else {
      setFailure(errorText(t, result?.error, t('RECOVERY_RULES_CREATE_FAILED', "We couldn't create this rule. Try again.")))
    }
  }

  const body_ = (
    <div className='odc-root odc-ra-form'>
      <section className='odc-ra-section' aria-labelledby={ids.details}>
        <h3 id={ids.details} className='odc-ra-section-title'>{t('RECOVERY_RULES_DETAILS', 'Details')}</h3>
        <TextField ref={nameRef} label={t('NAME', 'Name')} value={name} onChange={setName} error={errors.name || undefined} autoComplete='off' />
        <TextArea label={t('DESCRIPTION', 'Description')} value={description} onChange={setDescription} rows={3} />
      </section>

      <section className='odc-ra-section' aria-labelledby={ids.when}>
        <h3 id={ids.when} className='odc-ra-section-title'>{t('RECOVERY_RULES_WHEN', 'When')}</h3>
        <div ref={waitRef}>
          <RuleWaitField seconds={seconds} onChange={setSeconds} allowZero={false} error={errors.wait || undefined} />
        </div>
      </section>

      <section className='odc-ra-section' aria-labelledby={ids.message}>
        <h3 id={ids.message} className='odc-ra-section-title'>{t('RECOVERY_RULES_FIRST_MESSAGE', 'First message')}</h3>
        <div ref={channelRef} className='odc-ra-channel'>
          <SegmentedControl
            label={t('CHANNEL', 'Channel')}
            value={channel}
            onValueChange={onChannel}
            options={CHANNELS.map(value => ({ value, label: CHANNEL_NAMES[value](t) }))}
          />
          {errors.channel && <FieldError>{errors.channel}</FieldError>}
        </div>
        {channel && (
          <>
            <TextField ref={titleRef} label={t('TITLE', 'Title')} value={title} onChange={setTitle} error={errors.title || undefined} autoComplete='off' />
            {channel === 'email'
              ? (
                <div ref={bodyRef} role='group' aria-labelledby={ids.messageLabel} className='odc-ra-editor'>
                  <span id={ids.messageLabel} className='odc-ra-field-label'>{t('MESSAGE', 'Message')}</span>
                  <RichHtmlEditor
                    label={t('MESSAGE', 'Message')}
                    value={body}
                    onChange={setBody}
                    invalid={Boolean(errors.body)}
                    describedBy={errors.body ? ids.bodyError : undefined}
                  />
                  {errors.body && <FieldError id={ids.bodyError}>{errors.body}</FieldError>}
                </div>
                )
              : <TextArea label={t('MESSAGE', 'Message')} value={body} onChange={setBody} rows={4} error={errors.body || undefined} />}
            <MessagePreview channel={channel} title={title} body={body} />
          </>
        )}
      </section>
    </div>
  )

  const footer = (
    <div className='odc-root odc-ra-foot'>
      {failure && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{failure}</InlineNotice>}
      <div className='odc-ra-foot-row'>
        <p className='odc-ra-foot-note'>{t('RECOVERY_RULES_CREATE_NOTE', 'Starts sending as soon as you create it.')}</p>
        <div className='odc-ra-foot-actions'>
          <Button onClick={() => panelRef.current?.requestClose()}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' busy={submitting} onClick={submit}>{t('RECOVERY_RULES_CREATE', 'Create rule')}</Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <RecordPanel
        ref={panelRef}
        title={t('RECOVERY_RULES_NEW', 'New rule')}
        closeLabel={closeLabel}
        onClose={onClose}
        headerActions={headerActions}
        dirty={dirty}
        footer={footer}
        {...discard}
      >
        {body_}
      </RecordPanel>
      {confirmStep.dialog}
    </>
  )
}

// ---- a rule: view and edit ---------------------------------------------------------------------------------------------------------------
const RuleEditor = ({
  record,
  handleSaveRule,
  handleDeleteRecoveryAction,
  onClose,
  onToggleRule,
  confirmTurnOn,
  onEditMessage,
  onChannelsChange,
  onDirtyChange,
  channelActionsRef,
  initialSection,
  stats,
  onRetryStats,
  expandAction,
  closeLabel,
  discard
}) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code
  const ids = { details: useId(), when: useId(), results: useId() }
  const nameRef = useRef(null)
  const waitRef = useRef(null)
  const messagesRef = useRef(null)
  const savingRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ---- what the person changed: only the fields they touched, against what the rule holds now ----
  const baseline = { name: record.name ?? '', description: record.description ?? '', seconds: ruleWait(record) }
  const [changes, setChanges] = useState({})
  const values = { ...baseline, ...changes }
  const changed = Object.keys(changes).filter(key => changes[key] !== baseline[key])
  const dirty = changed.length > 0
  const setChange = (key, value) => setChanges(current => ({ ...current, [key]: value }))

  // redesign R2-F1 (R1-06): the page asks before it drops edits (another row, «New rule»), so it needs to know when there are some;
  // leaving the rule says «clean»
  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  useEffect(() => { dirtyRef.current?.(dirty) }, [dirty])
  useEffect(() => () => { dirtyRef.current?.(false) }, [])

  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailure, setSaveFailure] = useState(null)

  // A rule may keep a name it has had always (a nameless one), so only a name or a wait the person CHANGED has to be valid
  const problems = {
    name: changed.includes('name') && values.name.trim() === '' ? t('NAME_IS_REQUIRED', 'Name is required') : null,
    // redesign (n.º 17, P-3): a CHANGED wait is validated as creating does (empty, or 0 = «Wait at least 1 second.»)
    wait: !changed.includes('seconds')
      ? null
      : values.seconds === null
        ? t('RECOVERY_RULES_WAIT_REQUIRED', 'Enter how long to wait before sending.')
        : values.seconds === 0 ? t('RECOVERY_RULES_WAIT_POSITIVE', 'Wait at least 1 second.') : null
  }
  const errors = attempted ? problems : {}

  const save = async () => {
    if (savingRef.current || !dirty) return
    setAttempted(true)
    // redesign R2-F1 (R1-10): the focus goes to the first field with an error, in the order of the page (When, then Details), as create does
    if (problems.wait) {
      focusFirst(waitRef.current)
      return
    }
    if (problems.name) {
      nameRef.current?.focus()
      return
    }
    const payload = {}
    if (changed.includes('name')) payload.name = values.name.trim()
    if (changed.includes('description')) payload.description = values.description
    // redesign R2-F1 (R1-10): a changed wait also says it launches by `times`, as General does in main (handleChangeItem({ times, launch_type: 'times' }))
    if (changed.includes('seconds')) {
      payload.times = [values.seconds]
      payload.launch_type = 'times'
    }
    savingRef.current = true
    setSaving(true)
    setSaveFailure(null)
    let result
    try {
      result = await handleSaveRule(payload)
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    savingRef.current = false
    if (!mounted.current) return
    setSaving(false)
    if (result?.ok === false) setSaveFailure(errorText(t, result.error, t('RECOVERY_RULES_SAVE_FAILED', "We couldn't save this rule. Try again.")))
  }

  const cancel = () => {
    setChanges({})
    setAttempted(false)
    setSaveFailure(null)
  }

  // ---- delete (M-RA6, M-RA7) ----
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState(null)
  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    let result
    try {
      result = await handleDeleteRecoveryAction()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    // On ok the controller has told the list and closed the panel; there is nothing left to paint
    if (!mounted.current) return
    setDeleting(false)
    setDeleteOpen(false)
    if (result?.ok === false) setDeleteFailure(errorText(t, result.error, t('RECOVERY_RULES_DELETE_FAILED', "We couldn't delete this rule. Try again.")))
  }

  const name = record.name || t('RECOVERY_ACTION', 'Recovery action')
  // The switch of the header saves ONLY `enabled`, at once (decision 3). The page's `onToggleRule` is the one the table uses, so the list is the source
  const toggle = (next) => (onToggleRule ? onToggleRule(record, next) : handleSaveRule({ enabled: next }))
  const channelRule = useMemo(() => ({ id: record.id }), [record.id]) // a new object makes the controller ask the API for the channels again

  const waitChanged = changed.includes('seconds')
  const reason = waitChanged && withFigures(
    t('RECOVERY_RULES_WAIT_CHANGE', 'Sends _new_ after instead of _old_'),
    { _new_: formatWait(values.seconds, locale) || '—', _old_: formatWait(baseline.seconds, locale) || '—' }
  )

  const headerActions = (
    <>
      <span className='odc-ra-header-switch'>
        <AsyncSwitch
          label={name}
          checked={Boolean(record.enabled)}
          onToggle={toggle}
          // redesign D-76 (owner, 2026-10-19): turning ON asks first, with the page's question (the table's switch asks the same);
          // the switch does not look flipped while it asks, and turning OFF stays immediate
          confirmChange={confirmTurnOn ? (next) => !next || confirmTurnOn(record) : undefined}
          failureText={t('RECOVERY_RULES_TOGGLE_FAILED', "We couldn't change this rule. Try again.")}
        />
      </span>
      {expandAction}
      <Menu
        label={t('MORE_ACTIONS', 'More actions')}
        icon={Ellipsis}
        items={[{
          key: 'delete',
          label: t('DELETE', 'Delete'),
          icon: Trash2,
          tone: 'danger',
          onSelect: () => setDeleteOpen(true)
        }]}
      />
    </>
  )

  const footer = (
    <div className='odc-root odc-ra-foot'>
      {saveFailure && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{saveFailure}</InlineNotice>}
      {reason && <p className='odc-ra-foot-note'>{reason}</p>}
      <div className='odc-ra-foot-row'>
        <div className='odc-ra-foot-actions'>
          {dirty && <Button onClick={cancel}>{t('CANCEL', 'Cancel')}</Button>}
          <Button variant='primary' busy={saving} disabled={!dirty} onClick={save}>{t('SAVE_CHANGES', 'Save changes')}</Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <RecordPanel
        title={name}
        closeLabel={closeLabel}
        onClose={onClose}
        headerActions={headerActions}
        dirty={dirty}
        footer={footer}
        {...discard}
      >
        <div className='odc-root odc-ra-form'>
          {deleteFailure && <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{deleteFailure}</InlineNotice>}

          <section className='odc-ra-section' aria-labelledby={ids.results}>
            <h3 id={ids.results} className='odc-ra-section-title'>{t('RECOVERY_RULES_RESULTS', 'Results')}</h3>
            <RuleResults stats={stats} onRetry={onRetryStats} labelledBy={ids.results} t={t} />
          </section>

          <section className='odc-ra-section' aria-labelledby={ids.when}>
            <h3 id={ids.when} className='odc-ra-section-title'>{t('RECOVERY_RULES_WHEN', 'When')}</h3>
            <div ref={waitRef}>
              <RuleWaitField
                seconds={values.seconds}
                onChange={(next) => setChange('seconds', next)}
                allowZero={!changed.includes('seconds')}
                error={errors.wait || undefined}
              />
            </div>
          </section>

          <section className='odc-ra-section' aria-labelledby={ids.details}>
            <h3 id={ids.details} className='odc-ra-section-title'>{t('RECOVERY_RULES_DETAILS', 'Details')}</h3>
            <TextField
              ref={nameRef}
              label={t('NAME', 'Name')}
              value={values.name}
              onChange={(next) => setChange('name', next)}
              error={errors.name || undefined}
              autoComplete='off'
            />
            <TextArea
              label={t('DESCRIPTION', 'Description')}
              value={values.description}
              onChange={(next) => setChange('description', next)}
              rows={3}
            />
          </section>

          <RecoveryNotificationListController
            action={channelRule}
            rule={record}
            UIComponent={MessagesBridge}
            onChannelsChange={onChannelsChange}
            onEditMessage={onEditMessage}
            channelActionsRef={channelActionsRef}
            sectionRef={messagesRef}
            initialSection={initialSection}
          />
        </div>
      </RecordPanel>

      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={t('RECOVERY_RULES_DELETE_TITLE', 'Delete "_name_"?').replace('_name_', () => name)}
        confirmLabel={t('RECOVERY_RULES_DELETE_CONFIRM', 'Delete rule')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteOpen(false) }}
      >
        {t('RECOVERY_RULES_DELETE_BODY', "Customers stop getting its messages. This can't be undone.")}
      </ConfirmDialog>
    </>
  )
}

// ---- the panel ----------------------------------------------------------------------------------------------------------------------------
const RulePanelUI = (props) => {
  const {
    isAddMode,
    action: row,
    recoveryActionState,
    handleCreateRule,
    onClose,
    onCreated,
    onDirtyChange,
    expanded = false,
    onExpandedChange,
    onRetry
  } = props
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const expandAction = !phone && onExpandedChange && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}
    />
  )
  const closeLabel = phone ? t('BACK', 'Back') : t('CLOSE', 'Close')

  // redesign R2-F1 (R1-01): the record is the LATEST of two sources, each laid over what was held when IT changed: the row of the list (its
  // switch moved, its figures changed) and what the controller loaded or saved (`recoveryActionState.action`). A fixed `{ ...fetched, ...row }`
  // let a row that was never refreshed (the rule left the list) cover what was just saved: the title, the baseline and «Save changes` stayed
  // at the old values. Held in state and updated while rendering (no frame with the old record).
  const fetched = recoveryActionState?.action
  const [stored, setStored] = useState(() => ({ row, fetched, record: { ...(fetched || {}), ...(row || {}) } }))
  let held = stored
  if (stored.row !== row || stored.fetched !== fetched) {
    let next = stored.record
    if (stored.fetched !== fetched) next = { ...next, ...(fetched || {}) }
    if (stored.row !== row) next = { ...next, ...(row || {}) }
    held = { row, fetched, record: next }
    setStored(held)
  }

  const discard = {
    discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
    discardDescription: t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
    discardConfirmLabel: t('DISCARD', 'Discard'),
    keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
  }

  // Create mode is also what the props say (no rule and no id), so the first frame is the form and not a skeleton: the controller only
  // flips `isAddMode` in an effect
  if (isAddMode || (isEmptyObject(row) && props.actionId == null)) {
    return (
      <RuleCreate
        handleCreateRule={handleCreateRule}
        onClose={onClose}
        onCreated={onCreated}
        onDirtyChange={onDirtyChange}
        headerActions={expandAction || undefined}
        closeLabel={closeLabel}
        discard={discard}
      />
    )
  }

  const record = held.record
  const hasRecord = record.id != null
  const failed = !hasRecord && hasError(recoveryActionState?.error)

  if (failed) {
    return (
      <RecordPanel title={t('RECOVERY_ACTION', 'Recovery action')} closeLabel={closeLabel} onClose={onClose} headerActions={expandAction || undefined}>
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('RECOVERY_RULE_LOAD_ERROR', "We couldn't load this rule.")}
          description={errorText(t, recoveryActionState?.error, undefined)}
          action={(
            <span className='odc-ra-state-actions'>
              {onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
              <Button onClick={() => onClose?.()}>{t('CLOSE', 'Close')}</Button>
            </span>
          )}
        />
      </RecordPanel>
    )
  }

  if (!hasRecord) {
    return (
      <RecordPanel
        title={<span className='odc-ra-title-skeleton'><Skeleton /></span>}
        closeLabel={closeLabel}
        onClose={onClose}
        headerActions={expandAction || undefined}
      >
        <BodySkeleton label={t('LOADING', 'Loading')} />
      </RecordPanel>
    )
  }

  return <RuleEditor key={record.id} {...props} record={record} expandAction={expandAction || undefined} closeLabel={closeLabel} discard={discard} />
}

/**
 * The panel of a rule (redesign RA-B3). Props:
 *  - `action`: the row of the list, empty (or missing) for a new rule or when opened by `?id=`; `actionId`: number|null (with `?id=` only the id
 *    is known); `recoveryActionList`, `handleSuccessAddRecoveryAction`, `handleSuccessUpdateRecoveryAction`,
 *    `handleSuccessDeleteRecoveryAction`: the list controller's, forwarded to K/RecoveryActionDetail as the page passes them today;
 *  - `onToggleRule(rule, next)` -> Promise<{ ok, error }>: the switch of the header. The page's, the same one the table uses, so it saves ONLY `enabled`
 *    and the list is the source of the switch (without it the panel saves `enabled` itself);
 *  - `confirmTurnOn(rule)` -> boolean | Promise<boolean>: the page's question before the header switch turns the rule ON (redesign D-76,
 *    owner, 2026-10-19; the switch's `confirmChange`). Turning OFF never asks. Without it the switch saves at once. «Create rule» asks on its own;
 *  - `onEditMessage({ mode: 'add' | 'edit', rule, channel, channelActions })`: «Add message» (`channel` null) and a message's «Edit» (`channel` is the
 *    message `{ id, channel, title, body, enabled }`). The page mounts the RuleMessageDialog; `channelActions` are `{ add, save, remove, reload }`
 *    (the controller's handleAddChannel, handleSaveChannel, handleDeleteChannel and reload, always the latest);
 *  - `channelActionsRef`: optional ref set to `channelActions` while the Messages section is mounted (null when it is not), for a dialog that opens
 *    without a click in the panel;
 *  - `onChannelsChange(ruleId, channels)`: passed to K/RecoveryNotificationList (the page connects it to `setRuleChannels`);
 *  - `onCreated(rule, { pendingMessage }?)`: a new rule exists. Without options the first message was created too; with
 *    `pendingMessage: { channel, title, body, error }` the rule exists but its first message failed (the page moves the panel to the rule and
 *    opens the dialog filled in);
 *  - `onClose()`, `expanded`, `onExpandedChange(next)`;
 *  - `onDirtyChange(dirty)`: the create form's unsaved state (false when the panel leaves create mode or unmounts), for the page's discard guard;
 *  - `initialSection`: `'messages'` (`?tab=notifications`) scrolls to Messages once the rule is on screen.
 * It mounts K/RecoveryActionDetail with `RulePanelUI`. The controller has no refetch: a new `key` mounts it again, which asks the API again.
 */
export const RulePanel = (props) => {
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(count => count + 1), [])
  const { action, actionId } = props
  return (
    <RecoveryActionDetailController
      key={`${action?.id ?? actionId ?? 'new'}:${attempt}`}
      {...props}
      action={isEmptyObject(action) ? NO_RULE : action}
      actionId={actionId ?? null}
      onRetry={retry}
      UIComponent={RulePanelUI}
    />
  )
}
