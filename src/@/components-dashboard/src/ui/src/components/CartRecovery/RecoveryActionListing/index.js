import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { RecoveryActionListing as RecoveryActionListingController, useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { ConfirmDialog, SplitView } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { RuleMessageDialog } from '../RecoveryRules/RuleMessageDialog'
import { RulePanel } from '../RecoveryRules/RulePanel'
import { RulesHeader } from '../RecoveryRules/RulesHeader'
import { RulesColumnManager, RulesTable, useRulesColumns } from '../RecoveryRules/RulesTable'
import '../RecoveryRules/recovery-rules-page.css'

// redesign RA-B5 (decisions 1-6): the cart recovery rules page is a header (title, count, «N of M rules on», search, New rule) and the table,
// beside ONE panel (create or view) in a split view, as /marketing/campaign and /orders. The controller (K/RecoveryActionListing) owns the
// data; this owns what the person sees of it: the URL (?id, ?add, ?tab, ?page, ?pageSize), the rule that is open, the discard guard of the
// create form, the one message dialog, the hidden columns and the focus. The search is not in the URL (as before).

// K/RecoveryActionDetail asks the API again when `action` changes identity, and an empty object means «create» (or «load by id»): the
// empty record must be the same object on every render.
const NO_RECORD = {}

// How long a «Save» of a message waits for the panel's channel actions when the dialog opened before the panel's Messages mounted (a rule
// just created whose first message failed): about a second of frames.
const ACTIONS_WAIT_FRAMES = 60
const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

const RecoveryActionListingUI = (props) => {
  const {
    isUseQuery,
    recoveryActionList,
    paginationProps,
    searchValue,
    channelsByRule,
    statsByRule,
    rulesSummary,
    getRecoveryList,
    handleChangeSearch,
    handleUpdateAction,
    reloadRuleChannels,
    reloadRuleStats,
    setRuleChannels,
    handleSuccessAddRecoveryAction,
    handleSuccessUpdateRecoveryAction,
    handleSuccessDeleteRecoveryAction
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const learnOptions = learnOptionsValues(['cart_recovery'], t)

  const rules = recoveryActionList?.actions ?? []
  const loading = !!recoveryActionList?.loading
  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  const frameRef = useRef(null)

  // ---- the rule that is open: a row, just an id (?id=, the panel loads it) or a new one ----
  // `{ mode: 'new', nonce }` | `{ mode: 'view', id, rule, initialSection? }`
  const [panelState, setPanelState] = useState(null)
  const stateRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  // The row that will take a deleted rule's place, until the panel closes (K/RecoveryActionDetail deletes, then closes)
  const successorRef = useRef(undefined)
  const show = (next) => {
    stateRef.current = next
    setPanelState(next)
  }

  const open = panelState?.mode === 'view' ? panelState : null
  // The list's own version of the open rule when it has one (a switch changed it); else the one we hold (it may have left the page)
  const listRow = open ? rules.find(rule => rule.id === open.id) : undefined
  // A rule opened by ?id= has no row until the list brings it; the row is kept once seen, because K/RecoveryActionDetail loads the rule again
  // whenever `action` goes back to an empty object (the row left the page) and the panel's own switch follows the list's row
  const seenRow = useRef(null)
  if (listRow) seenRow.current = listRow
  else if (!open || seenRow.current?.id !== open.id) seenRow.current = null
  const shownRule = open
    ? (listRow ?? (Object.keys(open.rule).length > 0 ? open.rule : (seenRow.current ?? NO_RECORD)))
    : NO_RECORD

  // A rule opened through ?id= may not be on the page the controller asked the results for: ask for it once, after the page answered (a
  // rule that is on the page gets its results with it). A failed ask leaves an entry (with its error), so this never loops; the panel's
  // «Retry» is what asks again.
  const openId = open?.id
  const hasStats = openId != null && statsByRule?.[openId] != null
  useEffect(() => {
    if (openId != null && !hasStats && !loading) reloadRuleStats?.(openId)
  }, [openId, hasStats, loading])

  // ---- unsaved changes in the create form (RulePanel reports them): opening another row, «New rule» or `?add=1` asks first ----
  // redesign RA-B5 (as CampaignListing's withDraftGuard)
  const draft = useRef(false)
  const [discard, setDiscard] = useState(null) // { go }
  const onDirtyChange = useRef((dirty) => { draft.current = !!dirty }).current
  const withDraftGuard = (go) => (draft.current ? setDiscard({ go }) : go())

  // The page header's «New rule» (the first one in the frame; the empty state repeats it) takes the focus when a delete leaves no row
  const newRuleButton = (frame) => {
    const label = t('RECOVERY_RULES_NEW', 'New rule')
    return Array.from(frame.querySelectorAll('button')).find(button => button.getAttribute('title') === label) ?? null
  }

  const closePanel = () => {
    const closed = stateRef.current
    if (!closed) return // already closed (the panel closes itself after a delete too)
    draft.current = false
    show(null)
    setExpanded(false)
    removeQueryToUrl(['id', 'tab'])
    const deleted = successorRef.current !== undefined
    const focusId = deleted ? successorRef.current : (closed.id ?? null)
    successorRef.current = undefined
    // redesign RA-I3: after a DELETE the browser puts the focus on the table's first row before the first frame, so `takeover` replaces a
    // focus that is on a row (listFocus.settleFocusOn); with no row left it goes to `emptyTarget` (the header's «New rule»)
    settleFocusOn(() => frameRef.current, focusId, deleted ? { takeover: true, emptyTarget: newRuleButton } : undefined)
  }

  // redesign R2-F1 (R1-06): the panel of a rule reports its unsaved edits through the same `draft`, so another row asks first. The row that is
  // already open drops nothing (the panel stays and keeps its edits): it neither asks nor clears the draft
  const openRule = (rule) => {
    const same = stateRef.current?.mode === 'view' && stateRef.current.id === rule.id
    const go = () => {
      if (!same) draft.current = false
      successorRef.current = undefined
      show({ mode: 'view', id: rule.id, rule })
      addQueryToUrl({ id: rule.id })
    }
    if (same) go()
    else withDraftGuard(go)
  }

  // Add mode has no id: don't write `id=undefined`
  const openCreate = () => {
    // a clean create panel that is already open is not replaced by an identical one
    if (stateRef.current?.mode === 'new' && !draft.current) return
    withDraftGuard(() => {
      draft.current = false
      successorRef.current = undefined
      show({ mode: 'new', nonce: (stateRef.current?.nonce ?? 0) + 1 }) // a discarded draft starts over: the panel is a new one
      setExpanded(false)
      removeQueryToUrl(['id'])
    })
  }

  // `?add=1` (command palette) opens the add form like the button
  useOpenFromQuery('add', openCreate)

  // ?id= opens that rule on mount, whatever page it is on (the panel loads it); `?tab=notifications` (an old link) scrolls to Messages
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const id = positiveInt(query.get('id'))
    if (id != null) {
      show({ mode: 'view', id, rule: NO_RECORD, initialSection: query.get('tab') === 'notifications' ? 'messages' : undefined })
    }
  }, [])

  // ---- the switch of a rule: the table and the panel's header use this one, so the list is the source ----
  // redesign R2-F1 (R1-01): the rule the panel shows may have left the list (a search, another page), and then no row of the list is refreshed
  // by the switch. The controller hands back what the API saved; the open rule takes it (over the record the panel passed, which is the latest
  // it showed), so the panel never keeps a version older than what was written
  const onToggle = async (rule, next) => {
    const result = await handleUpdateAction(rule.id, { enabled: next })
    const current = stateRef.current
    if (result?.ok && result.rule && current?.mode === 'view' && current.id === rule.id) {
      const merged = { ...current.rule, ...rule, ...result.rule }
      if (seenRow.current?.id === rule.id) seenRow.current = { ...seenRow.current, ...result.rule }
      show({ ...current, rule: merged })
    }
    return result
  }

  // redesign D-76 (owner, 2026-10-19): turning a rule ON starts sending to customers, so it asks first (the same question for the
  // table's switch and the panel's header switch, which give it to AsyncSwitch as `confirmChange`). Turning OFF stays immediate. The rule is
  // named as the screens name it. The one dialog is rendered below.
  const turnOnStep = useConfirmStep()
  const confirmTurnOn = (rule) => turnOnStep.ask({
    // a rule name is often a question («Did something interrupt your order?»): its own mark stands for the title's
    title: t('RECOVERY_RULES_TURN_ON_TITLE', 'Turn on "_name_"?').replace('_name_', () => (rule?.name || t('RECOVERY_ACTION', 'Recovery action')).replace(/\s*[?？]+\s*$/, '')),
    body: t('RECOVERY_RULES_START_SENDING_BODY', 'Customers who leave a cart start getting its messages.'),
    confirmLabel: t('RECOVERY_RULES_TURN_ON_CONFIRM', 'Turn on rule'),
    tone: 'primary'
  })

  // ---- the columns the person hid (the table is controlled, so the choice outlives its re-renders) ----
  // CM-1: the choice lives here because the manager is in the header's filter bar and the table draws the result. A phone has
  // cards, no columns, so no manager.
  const columnsState = useRulesColumns()
  const isPhone = useIsPhone()

  // ---- what the panel reports back ----
  const handleDeleted = (ruleId) => {
    const index = rules.findIndex(rule => rule.id === ruleId)
    successorRef.current = index === -1 ? null : (rules[index + 1]?.id ?? rules[index - 1]?.id ?? null)
    handleSuccessDeleteRecoveryAction?.(ruleId)
  }

  // The panel of a created rule: the rule (already in the list: K/RecoveryActionDetail told it) replaces the form
  const channelActionsRef = useRef(null)
  const [message, setMessage] = useState({ open: false, mode: 'add', rule: null, channel: null, pending: undefined, channelActions: null })
  const openMessage = (next) => setMessage({ pending: undefined, channelActions: null, ...next, open: true })

  const handleCreated = (rule, extra) => {
    draft.current = false
    successorRef.current = undefined
    show({ mode: 'view', id: rule.id, rule })
    setExpanded(false)
    addQueryToUrl({ id: rule.id })
    // the rule exists but its first message failed: the dialog opens filled in; its actions are the new panel's, which is not mounted yet
    if (extra?.pendingMessage) openMessage({ mode: 'add', rule, channel: null, pending: extra.pendingMessage })
  }

  // ---- the message dialog: one for the page, fed with the channel handlers of the panel that is open ----
  const actionsFor = async () => {
    for (let frame = 0; frame < ACTIONS_WAIT_FRAMES; frame++) {
      const actions = message.channelActions ?? channelActionsRef.current
      if (actions) return actions
      await new Promise(resolve => nextFrame(resolve))
    }
    return null
  }

  // `{ ok: false, error: null }`: the dialog says its own «We couldn't save this message»
  const saveMessage = async ({ channel, title, body }) => {
    const actions = await actionsFor()
    if (!actions) return { ok: false, error: null }
    return message.mode === 'edit' && !message.pending
      ? actions.save(message.channel.id, { title, body })
      : actions.add({ channel, title, body })
  }

  const deleteMessage = async (channel) => {
    const actions = await actionsFor()
    if (!actions) return { ok: false, error: null }
    return actions.remove(channel.id)
  }

  // redesign R2-F1 (R1-05): the dialog that opens without a trigger (the first message of a rule just created failed) and the one that closes
  // after a delete (its «Edit» button is gone) cannot give the focus back to an opener. It goes to «Add message» of the panel of the rule the
  // dialog belongs to; if that is not there (its messages did not load), to the panel's title, which is made able to take it
  const returnMessageFocus = () => {
    if (typeof document === 'undefined') return null
    const ruleId = message.rule?.id
    const section = Array.from(document.querySelectorAll('.odc-ra-messages'))
      .find(candidate => ruleId == null || String(candidate.getAttribute('data-rule-id')) === String(ruleId))
    const label = t('RECOVERY_RULES_ADD_MESSAGE', 'Add message')
    const add = section && Array.from(section.querySelectorAll('button')).find(button => button.textContent.trim() === label)
    if (add) return add
    const title = document.querySelector('.odc-record-title')
    if (title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
    return title
  }

  // ---- the URL: ?page and ?pageSize after each load ----
  useEffect(() => {
    if (!isUseQuery || !currentPage || !pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [isUseQuery, currentPage, pageSize, paginationProps?.totalPages])

  // A page left empty (its rules were deleted) asks again: the same page, or the one before when it was the last
  useEffect(() => {
    const totalPages = paginationProps?.totalPages
    if (loading || recoveryActionList?.error || rules.length > 0 || !(totalPages > 1)) return
    getRecoveryList?.(currentPage !== totalPages ? currentPage : currentPage - 1, pageSize)
  }, [recoveryActionList?.actions, paginationProps])

  const search = searchValue || ''
  const reload = () => getRecoveryList?.(currentPage ?? 1, pageSize ?? 10)

  // redesign RA-I1: «N of M rules on» counts every rule (the controller reads them once, as open carts does), never the page or the
  // search. null holds the line while unknown; a failed read leaves the line out (undefined)
  const summary = rulesSummary?.error ? undefined : (rulesSummary ?? null)

  const listView = (
    <div ref={frameRef} className='odc-root odc-ra-frame'>
      <RulesHeader
        count={paginationProps?.totalItems}
        summary={summary}
        onNew={openCreate}
        onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
        search={search}
        onSearch={handleChangeSearch}
        learnOptions={learnOptions}
        tools={isPhone ? undefined : <RulesColumnManager state={columnsState} />}
      />
      <RulesTable
        rules={rules}
        loading={loading}
        error={recoveryActionList?.error}
        onRetry={reload}
        channelsByRule={channelsByRule}
        onRetryChannels={reloadRuleChannels}
        statsByRule={statsByRule}
        activeId={open?.id ?? null}
        onOpen={openRule}
        onToggle={onToggle}
        confirmTurnOn={confirmTurnOn}
        pagination={paginationProps}
        onPageChange={(page) => getRecoveryList?.(page, pageSize)}
        onPageSizeChange={(size, page) => getRecoveryList?.(page, size)}
        columnsState={columnsState}
        onNew={openCreate}
        searching={search}
      />
    </div>
  )

  const creating = panelState?.mode === 'new'
  const panel = panelState && (
    <RulePanel
      key={creating ? `new-${panelState.nonce}` : panelState.id}
      action={creating ? NO_RECORD : shownRule}
      actionId={creating ? null : panelState.id}
      recoveryActionList={recoveryActionList}
      handleSuccessAddRecoveryAction={handleSuccessAddRecoveryAction}
      handleSuccessUpdateRecoveryAction={handleSuccessUpdateRecoveryAction}
      handleSuccessDeleteRecoveryAction={handleDeleted}
      onToggleRule={onToggle}
      confirmTurnOn={confirmTurnOn}
      onEditMessage={openMessage}
      channelActionsRef={channelActionsRef}
      onChannelsChange={setRuleChannels}
      stats={creating ? undefined : statsByRule?.[panelState.id]}
      onRetryStats={() => reloadRuleStats?.(panelState.id)}
      onCreated={handleCreated}
      onDirtyChange={onDirtyChange}
      initialSection={creating ? undefined : panelState.initialSection}
      onClose={closePanel}
      expanded={expanded}
      onExpandedChange={setExpanded}
    />
  )

  const panelLabel = creating
    ? t('RECOVERY_RULES_NEW', 'New rule')
    : ((listRow ?? open?.rule)?.name || t('RECOVERY_ACTION', 'Recovery action'))

  return (
    <>
      <SplitView
        className='odc-ra-split'
        list={listView}
        panel={panel}
        open={Boolean(panelState)}
        expanded={expanded}
        panelLabel={panelLabel}
        resizeLabel={t('RECOVERY_RULES_RESIZE_PANEL', 'Resize the rule panel')}
        storageKey='odc-ra-panel'
        onClose={closePanel}
      />

      {/* One dialog for every message of every rule; its values and handlers are the ones of the panel that asked */}
      <RuleMessageDialog
        open={message.open}
        mode={message.mode}
        rule={message.rule}
        channel={message.channel}
        pending={message.pending}
        onSave={saveMessage}
        onDelete={deleteMessage}
        returnFocus={returnMessageFocus}
        onOpenChange={(next) => { if (!next) setMessage(current => ({ ...current, open: false })) }}
      />

      {turnOnStep.dialog}

      <ConfirmDialog
        open={!!discard}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          const go = discard?.go
          setDiscard(null)
          draft.current = false
          go?.()
        }}
        onCancel={() => setDiscard(null)}
      >
        {t('CUSTOMERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

export const RecoveryActionListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const recoveryActionsProps = {
    ...props,
    UIComponent: RecoveryActionListingUI,
    isSearchByName: true,
    isSearchByDescription: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      // redesign RA-B5: the page size was gated by `defaultPage` (a link with ?pageSize and no ?page lost it); it is gated by itself.
      // The controller holds it to the pagination's options (10, 25, 50).
      pageSize: props.isUseQuery && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return <RecoveryActionListingController {...recoveryActionsProps} />
}
