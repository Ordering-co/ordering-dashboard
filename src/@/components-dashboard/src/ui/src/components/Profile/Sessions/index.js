import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLanguage, useSession, useUtils, Sessions as SessionsController } from '../../../../../index'
import {
  AlertDialog,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  Pagination,
  Skeleton,
  Status
} from '../../Shared/Product'
import { CircleAlert, X as Close } from '../../Shared/Icon'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { isNetworkFailure } from '../../../../../utils/networkFailure'
import {
  SESSIONS_PAGE_SIZE,
  countOtherSessions,
  pageSessions,
  sortSessionsNewestFirst
} from '../profileView'
import '../ProfilePage/profile-page.css' // the card (border, radius, title) is shared with the account card
import './profile-sessions.css'

// redesign (D2 A, D3 A, D4, D7): the sessions card of /profile on the Product wrappers. The whole list lives in
// the card, paginated by 10, newest first, with the current one marked; «More info» and its modal are gone.

const SKELETON_ROWS = 5

// «_from_–_to_ of _total_» with each number in the `.odc-figure` node Pagination gives (decision 11)
const fillTemplate = (template, values, figure) => String(template).split(/(_[a-z]+_)/).map((part, index) => {
  const match = /^_([a-z]+)_$/.exec(part)
  if (!match || !(match[1] in values)) return part
  return <React.Fragment key={index}>{figure(values[match[1]])}</React.Fragment>
})

export const SessionsUI = (props) => {
  const {
    sessionsList,
    actionState,
    handleDeleteSession,
    handleDeleteAllSessions,
    handleReloadSessions
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ parseDate }] = useUtils()
  const titleId = useId()

  const [page, setPage] = useState(1)
  // `kind` is what the dialog is about: session, current, others, all or enable (the jwt strategy). The rest of the state
  // stays while the dialog fades out, so its text does not change under the person's eyes.
  const [confirm, setConfirm] = useState({ open: false, kind: null, session: null, count: 0 })
  const [alertOpen, setAlertOpen] = useState(false)
  // review r1 (F3): which action is running, so only its own control says it is working
  const [running, setRunning] = useState(null)
  // review r1 (F1): where the keyboard focus goes once an action ends and its dialog is gone (the ✕ that was pressed
  // leaves with its row, and a disabled button cannot keep the focus): { kind: 'row', index } or { kind: 'heading' }
  const pendingFocusRef = useRef(null)
  const listRef = useRef(null)
  const headingRef = useRef(null)

  const sessions = sessionsList?.sessions
  const sorted = useMemo(() => sortSessionsNewestFirst(sessions), [sessions])
  const total = sorted.length
  const lastPage = Math.max(1, Math.ceil(total / SESSIONS_PAGE_SIZE))
  // closing sessions can leave the page the person is on without rows: show the last one that exists
  const currentPage = Math.min(page, lastPage)
  const visible = pageSessions(sorted, currentPage, SESSIONS_PAGE_SIZE)
  const otherCount = countOtherSessions(sorted)
  const isLoading = !!sessionsList?.loading
  const isBusy = !!actionState?.loading

  // a new error of an action opens the alert again, as in main
  useEffect(() => {
    if (actionState?.error) setAlertOpen(true)
  }, [actionState?.error])

  // review r1 (F2): the dialog keeps the count it opened with while it fades out
  const openConfirm = (kind, session = null) => setConfirm({ open: true, kind, session, count: countOtherSessions(sorted) })
  const closeConfirm = () => setConfirm(previous => ({ ...previous, open: false }))

  const describeConfirm = ({ kind, session, count }) => {
    switch (kind) {
      case 'session':
        return {
          title: t('LOG_OUT_SESSION_TITLE', 'Log out this session?'),
          body: t('SIGN_OUT_SESSION_BODY', 'The session that started on _date_ ends now. Anyone using it has to sign in again.')
            .replace('_date_', parseDate(session?.created_at)),
          confirmLabel: t('LOG_OUT_SESSION', 'Log out session'),
          tone: 'danger',
          run: () => {
            pendingFocusRef.current = { kind: 'row', index: Math.max(0, visible.findIndex(item => item.id === session?.id)) }
            setRunning({ kind: 'session', id: session?.id })
            handleDeleteSession(session)
          }
        }
      case 'current':
        return {
          title: t('LOG_OUT_THIS_BROWSER_TITLE', 'Log out this browser?'),
          body: t('SIGN_OUT_THIS_BROWSER_BODY', 'This is the session you are using. You will go back to the sign-in page.'),
          confirmLabel: t('LOG_OUT', 'Log out'),
          tone: 'danger',
          run: () => handleDeleteSession(session)
        }
      case 'others':
        return {
          title: count === 1
            ? t('LOG_OUT_OTHER_SESSIONS_TITLE_ONE', 'Log out 1 other session?')
            : t('LOG_OUT_OTHER_SESSIONS_TITLE', 'Log out _count_ other sessions?').replace('_count_', String(count)),
          body: t('SIGN_OUT_OTHER_SESSIONS_BODY', 'You stay signed in here.'),
          confirmLabel: t('LOG_OUT_OTHER_SESSIONS', 'Log out other sessions'),
          tone: 'danger',
          run: () => {
            pendingFocusRef.current = { kind: 'heading' }
            setRunning({ kind: 'others' })
            handleDeleteAllSessions(false)
            setPage(1)
          }
        }
      case 'all':
        return {
          title: t('LOG_OUT_EVERYWHERE_TITLE', 'Log out everywhere?'),
          body: t('SIGN_OUT_EVERYWHERE_BODY', 'All your sessions end, this one too. You will go back to the sign-in page.'),
          confirmLabel: t('LOG_OUT_EVERYWHERE', 'Log out everywhere'),
          tone: 'danger',
          run: () => {
            setRunning({ kind: 'all' })
            handleDeleteAllSessions(true)
          }
        }
      case 'enable':
        // the same call main made (handleDeleteAllSessions(false)); it only turns tracking on, so it is not a destructive action
        return {
          title: t('ACTIVE_SESSIONS', 'Active sessions'),
          body: t('QUESTION_ENABLE_ALL_SESSIONS', 'Are you sure to enable all sessions?'),
          confirmLabel: t('ACTIVE_SESSIONS', 'Active sessions'),
          tone: 'primary',
          run: () => {
            pendingFocusRef.current = { kind: 'heading' }
            setRunning({ kind: 'enable' })
            handleDeleteAllSessions(false)
          }
        }
      default:
        return null
    }
  }
  const dialog = describeConfirm(confirm)

  useEffect(() => {
    if (!isBusy) setRunning(null)
  }, [isBusy])

  // review r1 (F1): once nothing runs, nothing loads and the dialog has left the page, put the focus back in the card
  useEffect(() => {
    if (!pendingFocusRef.current || isBusy || isLoading || confirm.open) return
    let frame = null
    let tries = 0
    const place = () => {
      const target = pendingFocusRef.current
      if (!target) return
      // the dialog fades out (the slow role) and gives the focus back on its way out: wait until it is gone
      if (document.querySelector('[role="alertdialog"]') && tries < 120) {
        tries += 1
        frame = window.requestAnimationFrame(place)
        return
      }
      pendingFocusRef.current = null
      const buttons = Array.from(listRef.current?.querySelectorAll("[data-slot='profile-session'] button") ?? [])
      const next = target.kind === 'row' && buttons.length
        ? buttons[Math.min(target.index, buttons.length - 1)]
        : headingRef.current
      next?.focus()
    }
    place()
    return () => { if (frame) window.cancelAnimationFrame(frame) }
  }, [isBusy, isLoading, confirm.open, visible])

  // (a): a request that never reached the API rejects with the browser's own text («Failed to fetch»); it reads as words.
  // Messages the API sends keep going through the dictionary as before.
  const networkFailureText = () => t('SESSIONS_NETWORK_ERROR_HELP', 'Check your connection and try again.')
  const readError = sessionsList?.error
  const readMessage = Array.isArray(readError) ? readError[0] : readError
  const readErrorText = isNetworkFailure(readMessage) ? networkFailureText() : translateApiMessage(t, readMessage, null)
  const actionError = actionState?.error
  const actionErrorContent = Array.isArray(actionError)
    ? actionError.map(message => isNetworkFailure(message) ? networkFailureText() : message)
    : (isNetworkFailure(actionError) ? networkFailureText() : actionError)

  // (b): the sign-out ✕ names must tell the rows apart. Sessions that share the minute get their place in the list
  // (newest first, the order on screen); the one of this browser says so. The visible text of the rows does not change.
  const startedCount = {}
  for (const item of sorted) {
    const key = parseDate(item.created_at)
    startedCount[key] = (startedCount[key] || 0) + 1
  }
  const closeLabel = (session, startedAt) => {
    if (session.current) {
      return t('LOG_OUT_THIS_BROWSER_STARTED', 'Log out this browser (session started _date_)').replace('_date_', startedAt)
    }
    if (startedCount[startedAt] > 1) {
      return t('LOG_OUT_SESSION_STARTED_NUMBERED', 'Log out the session started _date_ (session _number_ of _total_)')
        .replace('_date_', startedAt)
        .replace('_number_', String(sorted.indexOf(session) + 1))
        .replace('_total_', String(total))
    }
    return t('LOG_OUT_SESSION_STARTED', 'Log out the session started _date_').replace('_date_', startedAt)
  }

  const renderBody = () => {
    if (user?.session_strategy !== 'jwt_session') {
      return (
        <div className='odc-profile-tracking'>
          <InlineNotice tone='info'>
            {t('YOU_DONT_HAVE_ENABLED_THE_SESSIONS', 'You don\'t have enabled the sessions, please active them to have a better control of your sessions.')}
          </InlineNotice>
          <div>
            <Button onClick={() => openConfirm('enable')}>{t('ACTIVE_SESSIONS', 'Active sessions')}</Button>
          </div>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className='odc-profile-sessions-loading' aria-busy='true'>
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className='odc-profile-session' data-slot='profile-session-skeleton'>
              <div className='odc-profile-session-dates'>
                <Skeleton size='60%' />
                <Skeleton size='60%' />
              </div>
              <Skeleton size='var(--od-x-control-height)' block='var(--od-x-control-height)' shape='box' />
            </div>
          ))}
        </div>
      )
    }

    // PF-02: a failed read is not «no sessions»
    if (readError) {
      return (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          title={t('SESSIONS_LOAD_ERROR', 'We couldn\'t load your sessions')}
          description={readErrorText}
          action={handleReloadSessions
            ? (
              <Button
                onClick={() => {
                  pendingFocusRef.current = { kind: 'heading' } // review r1 (F1)
                  handleReloadSessions()
                }}
              >
                {t('TRY_AGAIN', 'Try again')}
              </Button>
              )
            : undefined}
        />
      )
    }

    if (total === 0) {
      return <p className='odc-profile-empty'>{t('YOU_DONT_HAVE_ANY_SESSIONS', 'You don\'t have any sessions')}</p>
    }

    return (
      <>
        <p className='odc-profile-summary'>
          <span className='odc-figure odc-profile-total'>{total}</span>
          {' '}
          <span>
            {total === 1
              ? t('SIGNED_IN_SESSIONS_ONE', 'signed-in session')
              : t('SIGNED_IN_SESSIONS_OTHER', 'signed-in sessions')}
          </span>
        </p>
        <ul ref={listRef} className='odc-profile-session-list' role='list'>
          {visible.map(session => {
            const startedAt = parseDate(session.created_at)
            return (
              <li
                key={session.id}
                className='odc-profile-session'
                data-slot='profile-session'
                data-current={session.current ? 'true' : undefined}
              >
                <div className='odc-profile-session-dates'>
                  <span className='odc-profile-session-date'>
                    <span className='odc-profile-session-label'>{t('STARTED', 'Started')}</span>
                    {' '}
                    <time className='odc-figure' dateTime={session.created_at}>{startedAt}</time>
                  </span>
                  <span className='odc-profile-session-date'>
                    <span className='odc-profile-session-label'>{t('EXPIRES', 'Expires')}</span>
                    {' '}
                    <time className='odc-figure' dateTime={session.valid_thru}>{parseDate(session.valid_thru)}</time>
                  </span>
                </div>
                {session.current && <Status family='done' label={t('THIS_BROWSER', 'This browser')} />}
                <IconButton
                  icon={Close}
                  label={closeLabel(session, startedAt)}
                  disabled={isBusy}
                  aria-busy={(isBusy && running?.kind === 'session' && running.id === session.id) || undefined}
                  onClick={() => openConfirm(session.current ? 'current' : 'session', session)}
                />
              </li>
            )
          })}
        </ul>
        <div className='odc-profile-foot'>
          <Pagination
            className='odc-profile-pagination'
            page={currentPage}
            pageSize={SESSIONS_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            showPageInput
            label={t('SESSIONS_PAGINATION', 'Sessions pages')}
            previousLabel={t('PREVIOUS', 'Previous')}
            nextLabel={t('NEXT', 'Next')}
            pageLabel={t('PAGE', 'Page')}
            rangeLabel={(from, to, count, figure) => fillTemplate(t('SESSIONS_RANGE', '_from_–_to_ of _total_'), { from, to, total: count }, figure)}
            pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages))}
          />
          <div className='odc-profile-actions'>
            <Button
              disabled={isBusy || otherCount === 0}
              busy={isBusy && running?.kind === 'others'}
              onClick={() => openConfirm('others')}
            >
              {t('LOG_OUT_OTHER_SESSIONS', 'Log out other sessions')}
            </Button>
            <Button
              variant='danger'
              disabled={isBusy}
              busy={isBusy && running?.kind === 'all'}
              onClick={() => openConfirm('all')}
            >
              {t('LOG_OUT_EVERYWHERE', 'Log out everywhere')}
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <section className='odc-root odc-profile-card odc-profile-sessions' data-slot='profile-sessions' aria-labelledby={titleId}>
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className='odc-profile-card-title'>{t('SESSIONS', 'Sessions')}</h2>
        {renderBody()}
      </section>
      <ConfirmDialog
        open={confirm.open}
        title={dialog?.title ?? ''}
        confirmLabel={dialog?.confirmLabel ?? ''}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone={dialog?.tone ?? 'danger'}
        onCancel={closeConfirm}
        onConfirm={() => {
          dialog?.run()
          closeConfirm()
        }}
      >
        {dialog?.body}
      </ConfirmDialog>
      <AlertDialog
        open={alertOpen}
        title={t('SESSIONS', 'Sessions')}
        content={actionErrorContent}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={() => setAlertOpen(false)}
      />
    </>
  )
}

export const Sessions = (props) => {
  const sessionsProps = {
    ...props,
    UIComponent: SessionsUI
  }
  return <SessionsController {...sessionsProps} />
}
