import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, useAssistant } from '../../../../index'
import { ASSISTANT_NAME, ASSISTANT_STAGE } from '../../../../contexts/AssistantContext/name'
import { ASSISTANT_DOCK_MIN_WIDTH, ASSISTANT_PANEL_WIDTH, setAssistantLauncherSpace, setAssistantOffset } from '../../utils/assistantDock'
import { setAssistantIntercomHidden } from '../../utils/assistantIntercom'
import { useAssistantViewport } from '../../hooks/useAssistantViewport'
import { useLegacyPlanUpgrade } from '../../contexts/LegacyPlanUpgradeContext'
import { useInfoShare } from '../../contexts/InfoShareContext'
import { Button, ConfirmDialog, IconButton, Menu as ActionMenu, useProductDir } from '../Shared/Product'
import { Ellipsis, Maximize2, Menu, MessageSquare, Minimize2, Plus, Trash2, X } from '../Shared/Icon'
import { AssistantChat, ASSISTANT_ROUTE } from './AssistantChat'
import './assistant.css'

// redesign AS-B: the frame of the assistant (page, panel, launcher) on Product, with tokens in assistant.css

/** Width of the centered column of the /assistant page, as on main. The CSS reads it as --odc-as-column. */
const ASSISTANT_PAGE_COLUMN = 760

const useWindowWidth = () => {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0))
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

// redesign AS-B (D3): the stage is a neutral pill, like the one beside «Mia» in the menu
const StagePill = () => <span className='odc-as-stage'>{ASSISTANT_STAGE}</span>

// redesign J5 row 49 (assistant P-1, ): «Delete conversation» in a ⋯ of the header, only when there is a conversation, with a
// confirmation (C8). It runs the context's deleteConversation (DELETE in api-ai, then a new empty chat); the focus goes to the composer.
// If api-ai could not delete it, the dialog stays open and says so (review J5 #2): the conversation is still there.
const DeleteConversation = ({ frameRef }) => {
  const [, t] = useLanguage()
  const { conversation, deleteConversation } = useAssistant()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!conversation?.id) return null
  const label = t('ASSISTANT_DELETE_CONVERSATION', 'Delete conversation')
  const confirm = async () => {
    setBusy(true)
    setFailed(false)
    const frame = frameRef.current?.closest('.odc-as-page, .odc-as-panel')
    let result
    try {
      result = await deleteConversation()
    } catch (error) {
      result = { ok: false, error }
    }
    setBusy(false)
    if (result?.ok === false) return setFailed(true)
    setConfirmOpen(false)
    window.requestAnimationFrame(() => frame?.querySelector('.odc-as-composer textarea')?.focus())
  }
  const close = () => {
    setConfirmOpen(false)
    setFailed(false)
  }
  return (
    <>
      <ActionMenu
        label={t('MORE_ACTIONS', 'More actions')}
        icon={Ellipsis}
        items={[{ key: 'delete', label, icon: Trash2, tone: 'danger', onSelect: () => setConfirmOpen(true) }]}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={t('ASSISTANT_DELETE_CONVERSATION_TITLE', 'Delete this conversation?')}
        confirmLabel={label}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={busy}
        onConfirm={confirm}
        onCancel={close}
      >
        {t('ASSISTANT_DELETE_CONVERSATION_BODY', "It can't be undone.")}
        {failed && (
          <p role='alert' className='odc-as-delete-error'>
            {t('ASSISTANT_DELETE_CONVERSATION_FAILED', "We couldn't delete the conversation. Try again.")}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

const AssistantHeader = ({ page }) => {
  const [, t] = useLanguage()
  const history = useHistory()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const { conversation, items, streaming, loadingConversation, newConversation, setOpen } = useAssistant()
  const headRef = useRef(null)

  const expand = () => {
    if (window.innerWidth < 768) handleMenuCollapse(true)
    history.push(ASSISTANT_ROUTE, { from: `${window.location.pathname}${window.location.search}` })
  }

  const collapse = () => {
    setOpen(true)
    const from = history.location.state?.from
    if (from && from !== ASSISTANT_ROUTE) history.push(from)
    else history.push('/')
  }

  // redesign R1-2: an empty chat disables «New conversation», so the focus goes to the composer of the same frame
  const startNewConversation = (event) => {
    const frame = event.currentTarget.closest('.odc-as-page, .odc-as-panel')
    newConversation()
    window.requestAnimationFrame(() => frame?.querySelector('.odc-as-composer textarea')?.focus())
  }

  const title = conversation?.title || ASSISTANT_NAME
  const newLabel = t('ASSISTANT_NEW_CONVERSATION', 'New conversation')
  const isNewDisabled = items.length === 0 && !streaming && !loadingConversation && !conversation

  if (page) {
    // redesign AS-B (D3, M-AS1, M-AS3): the page header of Product; the menu comes first when the sidebar is closed
    const backLabel = t('ASSISTANT_COLLAPSE', 'Back to the side panel')
    // redesign AS-B (D-AS1): one compact row like the panel's, not P/PageHeader: on a phone its row keeps 44px buttons
    // and drops them to a second line (a 117px header over a chat); here every control is 32 visible with a 44 area
    return (
      <div ref={headRef} className='odc-root odc-as-head' data-page=''>
        {isCollapse && <IconButton icon={Menu} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        <MessageSquare className='odc-icon odc-as-head-icon' />
        <h1 className='odc-as-title'>
          <span className='odc-as-title-text' title={title}>{title}</span>
          <StagePill />
        </h1>
        <Button icon={Plus} onClick={startNewConversation} disabled={isNewDisabled} title={newLabel}>
          <span data-collapse-label=''>{newLabel}</span>
        </Button>
        <DeleteConversation frameRef={headRef} />
        <IconButton icon={Minimize2} label={backLabel} onClick={collapse} />
      </div>
    )
  }

  const expandLabel = t('ASSISTANT_EXPAND', 'Open full page')
  const closeLabel = t('ASSISTANT_CLOSE', 'Close assistant')
  return (
    <div ref={headRef} className='odc-root odc-as-head' data-panel=''>
      <MessageSquare className='odc-icon odc-as-head-icon' />
      <h2 className='odc-as-title'>
        <span className='odc-as-title-text' title={title}>{title}</span>
        <StagePill />
      </h2>
      <IconButton icon={Plus} label={newLabel} onClick={startNewConversation} disabled={isNewDisabled} />
      <IconButton icon={Maximize2} label={expandLabel} onClick={expand} />
      <DeleteConversation frameRef={headRef} />
      <IconButton icon={X} label={closeLabel} onClick={() => setOpen(false)} />
    </div>
  )
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]'

// A disabled Product button keeps tabindex 0, so the disabled state is read from the element
const isEnabled = (node) => !node.disabled && node.getAttribute('tabindex') !== '-1' && !node.closest('[aria-hidden="true"]')

/**
 * redesign AS-B (M-AS2): where the focus goes when the panel opens and closes. Opening takes it to the composer (or the
 * first control); closing gives it back to what had it before opening, or to the launcher when that is gone. Only on
 * the change, so a panel that is already open when the page loads (or is restored once the status loads) takes nothing; and on closing only when the focus
 * was lost with the panel (it is on the body), never from wherever the user is working.
 */
const useAssistantPanelFocus = ({ visible, isOpen, canShow, panelRef, launcherRef }) => {
  const lastOutside = useRef(null)
  const opener = useRef(null)
  const wasVisible = useRef(visible)
  // whether the assistant could be used in the previous render. A panel that becomes visible while it
  // could not (the status is loading after a reload or a reset) is being restored, not opened by the user.
  const couldShow = useRef(canShow)

  // The element that has the focus outside of the panel; it is what the panel gives the focus back to
  useEffect(() => {
    const isPanel = (node) => node instanceof Element && !!node.closest('#assistant_panel')
    const onFocusIn = (event) => {
      if (!isPanel(event.target)) lastOutside.current = event.target
    }
    const onFocusOut = (event) => {
      // The focus went nowhere (a click on empty space): there is nothing to give back to
      if (!event.relatedTarget && !isPanel(event.target)) lastOutside.current = null
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  useLayoutEffect(() => {
    if (visible === wasVisible.current) return
    wasVisible.current = visible
    if (visible) {
      opener.current = lastOutside.current
      if (!couldShow.current) return
      const panel = panelRef.current
      const controls = Array.from(panel?.querySelectorAll(FOCUSABLE) || []).filter(isEnabled)
      const target = controls.find(node => node.tagName === 'TEXTAREA') || controls[0]
      target?.focus({ preventScroll: true })
      return
    }
    // Closed on purpose (✕, Esc, ⌘J, «Mia» in the menu), not hidden by going to the full page
    if (isOpen) return
    const lost = !document.activeElement || document.activeElement === document.body
    if (lost) {
      const target = opener.current?.isConnected ? opener.current : launcherRef.current
      target?.focus({ preventScroll: true })
    }
    opener.current = null
  }, [visible, isOpen])

  // After the effect above, so that it reads the value of the previous render
  useLayoutEffect(() => {
    couldShow.current = canShow
  })
}

// main: space between the launcher and what a bottom bar shows next to it
const LAUNCHER_GAP = 12

/**
 * Opens the assistant, floating at the bottom right. main: while it shows it tells bottom bars the room it takes
 * (`--assistant-launcher-space`, utils/assistantDock). redesign J5 row 50 and AS-B: the Product launcher, whose node is also the
 * panel's (`launcherRef`) to give the focus back to on closing.
 */
const AssistantLauncher = React.forwardRef(({ onOpen }, launcherRef) => {
  const ref = useRef(null)
  const setRefs = (node) => {
    ref.current = node
    if (typeof launcherRef === 'function') launcherRef(node)
    else if (launcherRef) launcherRef.current = node
  }

  useLayoutEffect(() => {
    const measure = () => {
      const rect = ref.current?.getBoundingClientRect()
      setAssistantLauncherSpace(rect?.width ? window.innerWidth - rect.left + LAUNCHER_GAP : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      setAssistantLauncherSpace(0)
    }
  }, [])

  return (
    <button
      ref={setRefs}
      type='button'
      className='odc-root odc-as-launcher'
      onClick={onOpen}
      aria-label={ASSISTANT_NAME}
      aria-expanded={false}
      aria-controls='assistant_panel'
    >
      <MessageSquare className='odc-icon' />
      {/* redesign J5 row 50 (assistant P-2): hidden under 768px (assistant.css); the button keeps its name «Mia» */}
      <span className='odc-as-launcher-label'>{ASSISTANT_NAME}</span>
    </button>
  )
})

AssistantLauncher.displayName = 'AssistantLauncher'

/**
 * The assistant as a column on the right of the dashboard. On wide screens it
 * docks (the rest of the dashboard makes room, see utils/assistantDock); on
 * narrow ones it floats over the page. It stays open across pages and hides
 * on /assistant, which shows the same conversation full width.
 */
export const AssistantPanel = () => {
  const { isAllowed, isAvailable, isOpen, setOpen, status } = useAssistant()
  const { upgradeRequired, requestUpgrade } = useLegacyPlanUpgrade()
  const location = useLocation()
  const width = useWindowWidth()
  const dir = useProductDir()
  const launcherRef = useRef(null)

  // An open panel stays to say what failed (api-ai down, no permission);
  // it only goes away when the project does not have the assistant
  const canShow = isAvailable || (isAllowed && !!status.error)
  const panelOpen = !upgradeRequired && isOpen
  const visible = canShow && panelOpen && location.pathname !== ASSISTANT_ROUTE
  const docked = visible && width >= ASSISTANT_DOCK_MIN_WIDTH
  const viewportRef = useAssistantViewport(visible, true)
  const hideIntercom = visible || (isAllowed && location.pathname === ASSISTANT_ROUTE)

  // bugs H #5: on /assistant the conversation is the page; ⌘J would flip a panel that is not shown
  useAssistantShortcut({ disabled: location.pathname === ASSISTANT_ROUTE })
  useAssistantPanelFocus({ visible, isOpen: panelOpen, canShow, panelRef: viewportRef, launcherRef })

  useEffect(() => {
    setAssistantOffset(docked ? ASSISTANT_PANEL_WIDTH : 0)
  }, [docked])

  useEffect(() => {
    setAssistantIntercomHidden(hideIntercom)
  }, [hideIntercom])

  useEffect(() => () => {
    setAssistantOffset(0)
    setAssistantIntercomHidden(false)
  }, [])

  // Escape closes it when it floats over the page
  useEffect(() => {
    if (!visible || docked) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [visible, docked])

  if (!visible) {
    if (!isAvailable || location.pathname === ASSISTANT_ROUTE) return null
    return <AssistantLauncher ref={launcherRef} onOpen={() => {
      const openAssistant = () => setOpen(true)
      if (!requestUpgrade(undefined, openAssistant)) openAssistant()
    }} />
  }

  return (
    <aside
      ref={viewportRef}
      className='odc-root odc-as-panel'
      dir={dir}
      data-floating={docked ? undefined : ''}
      aria-label={ASSISTANT_NAME}
      id='assistant_panel'
      style={{ '--odc-as-panel-width': `${ASSISTANT_PANEL_WIDTH}px` }}
    >
      <AssistantHeader />
      <AssistantChat />
    </aside>
  )
}

/**
 * The /assistant page: the same conversation, full width
 */
export const AssistantPage = () => {
  const { isAllowed } = useAssistant()
  const viewportRef = useAssistantViewport(isAllowed)
  if (!isAllowed) return null
  return (
    <div ref={viewportRef} className='odc-root odc-as-page' style={{ '--odc-as-column': `${ASSISTANT_PAGE_COLUMN}px` }}>
      <AssistantHeader page />
      <AssistantChat page />
    </div>
  )
}

/**
 * ⌘J / Ctrl+J opens and closes the panel (`disabled`: off, e.g. on /assistant where there is no panel)
 */
export const useAssistantShortcut = ({ disabled = false } = {}) => {
  const { isAvailable, setOpen } = useAssistant()
  const { requestUpgrade } = useLegacyPlanUpgrade()
  useEffect(() => {
    if (!isAvailable || disabled) return
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key?.toLowerCase() === 'j') {
        event.preventDefault()
        const toggleAssistant = () => setOpen(prev => !prev)
        if (!requestUpgrade(undefined, toggleAssistant)) toggleAssistant()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isAvailable, disabled, requestUpgrade, setOpen])
}
