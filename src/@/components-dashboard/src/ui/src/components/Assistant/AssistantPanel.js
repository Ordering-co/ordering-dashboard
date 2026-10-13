import React, { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { ArrowsAngleContract, ArrowsAngleExpand, PlusLg, Stars, XLg } from 'react-bootstrap-icons'
import { useLanguage, useAssistant } from '../../../../index'
import { ASSISTANT_NAME, ASSISTANT_STAGE } from '../../../../contexts/AssistantContext/name'
import { ASSISTANT_DOCK_MIN_WIDTH, ASSISTANT_PANEL_WIDTH, setAssistantOffset } from '../../utils/assistantDock'
import { setAssistantIntercomHidden } from '../../utils/assistantIntercom'
import { useAssistantViewport } from '../../hooks/useAssistantViewport'
import { useInfoShare } from '../../contexts/InfoShareContext'
import { AssistantChat, ASSISTANT_ROUTE } from './AssistantChat'
import { Header, HeaderButton, HeaderTitle, Launcher, PageContainer, Panel, StageBadge } from './styles'

const useWindowWidth = () => {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0))
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

const AssistantHeader = ({ page }) => {
  const [, t] = useLanguage()
  const history = useHistory()
  const [, { handleMenuCollapse }] = useInfoShare()
  const { conversation, items, streaming, loadingConversation, newConversation, setOpen } = useAssistant()

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

  return (
    <Header page={page}>
      <HeaderTitle page={page}>
        <Stars size={18} aria-hidden />
        <span>{conversation?.title || ASSISTANT_NAME}</span>
        <StageBadge>{ASSISTANT_STAGE}</StageBadge>
      </HeaderTitle>
      <HeaderButton
        type='button'
        onClick={newConversation}
        disabled={items.length === 0 && !streaming && !loadingConversation && !conversation}
        aria-label={t('ASSISTANT_NEW_CONVERSATION', 'New conversation')}
        title={t('ASSISTANT_NEW_CONVERSATION', 'New conversation')}
      >
        <PlusLg size={16} aria-hidden />
      </HeaderButton>
      {page
        ? (
          <HeaderButton type='button' onClick={collapse} aria-label={t('ASSISTANT_COLLAPSE', 'Back to the side panel')} title={t('ASSISTANT_COLLAPSE', 'Back to the side panel')}>
            <ArrowsAngleContract size={15} aria-hidden />
          </HeaderButton>
          )
        : (
          <>
            <HeaderButton type='button' onClick={expand} aria-label={t('ASSISTANT_EXPAND', 'Open full page')} title={t('ASSISTANT_EXPAND', 'Open full page')}>
              <ArrowsAngleExpand size={15} aria-hidden />
            </HeaderButton>
            <HeaderButton type='button' onClick={() => setOpen(false)} aria-label={t('ASSISTANT_CLOSE', 'Close assistant')} title={t('ASSISTANT_CLOSE', 'Close assistant')}>
              <XLg size={15} aria-hidden />
            </HeaderButton>
          </>
          )}
    </Header>
  )
}

/**
 * The assistant as a column on the right of the dashboard. On wide screens it
 * docks (the rest of the dashboard makes room, see utils/assistantDock); on
 * narrow ones it floats over the page. It stays open across pages and hides
 * on /assistant, which shows the same conversation full width.
 */
export const AssistantPanel = () => {
  const { isAllowed, isAvailable, isOpen, setOpen, status } = useAssistant()
  const location = useLocation()
  const width = useWindowWidth()

  // An open panel stays to say what failed (api-ai down, no permission);
  // it only goes away when the project does not have the assistant
  const canShow = isAvailable || (isAllowed && !!status.error)
  const visible = canShow && isOpen && location.pathname !== ASSISTANT_ROUTE
  const docked = visible && width >= ASSISTANT_DOCK_MIN_WIDTH
  const viewportRef = useAssistantViewport(visible, true)
  const hideIntercom = visible || (isAllowed && location.pathname === ASSISTANT_ROUTE)

  useAssistantShortcut()

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
    return (
      <Launcher type='button' onClick={() => setOpen(true)} aria-label={ASSISTANT_NAME} aria-expanded={false} aria-controls='assistant_panel'>
        <Stars size={22} aria-hidden />
        <span>{ASSISTANT_NAME}</span>
      </Launcher>
    )
  }

  return (
    <Panel ref={viewportRef} floating={!docked} aria-label={ASSISTANT_NAME} id='assistant_panel'>
      <AssistantHeader />
      <AssistantChat />
    </Panel>
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
    <PageContainer ref={viewportRef}>
      <AssistantHeader page />
      <AssistantChat page />
    </PageContainer>
  )
}

/**
 * ⌘J / Ctrl+J opens and closes the panel
 */
export const useAssistantShortcut = () => {
  const { isAvailable, setOpen } = useAssistant()
  useEffect(() => {
    if (!isAvailable) return
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key?.toLowerCase() === 'j') {
        event.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isAvailable, setOpen])
}
