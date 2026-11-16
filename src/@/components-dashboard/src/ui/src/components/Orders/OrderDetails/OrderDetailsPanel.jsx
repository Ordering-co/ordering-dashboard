import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useUtils, useSession, useApi } from '../../../../../index'
import { OrderDetailsHeader } from '../OrderDetailsHeader'
import { AssignCommentDialog, Button, ConfirmDialog, Dialog, EmptyState, IconButton, Sheet, TabPanel, Tabs, useSplitView } from '../../Shared/Product'
import { Search, TriangleAlert, X } from '../../Shared/Icon'
import { OrderToPrint } from '../OrderToPrint'
import { OrderToPrintTicket } from '../OrderToPrintTicket'
import { defaultTicketSections } from '../OrderToPrintTicket/ticketSections'
import { readTicketSections, writeTicketSections } from '../../../../../utils/ticketSectionStorage'
import { getOrderStatuPickUp, getOrderStatus, addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { CloneOrder } from '../CloneOrder'
import { DetailsTab } from './DetailsTab'
import { DetailsFooter } from './DetailsFooter'
import { ActivityTab } from './ActivityTab'
import { ChatTab } from './ChatTab'
import { OrderMessagesProvider } from './OrderMessages'
import { FieldsTab } from './FieldsTab'
import { AlertDialog } from '../../Shared/Product/AlertDialog'
import { PanelSkeleton } from './PanelSkeleton'
import './order-details.css'

// The panel is one frame with four tabs (redesign 5.3). The URL keeps the old `?section=`
// values: they name the tab (and `clone_order` opens the clone dialog).
const TAB_BY_SECTION = { history: 'activity', chat: 'chat', metafields: 'fields' }
const SECTION_BY_TAB = { activity: 'history', chat: 'chat', fields: 'metafields' }

// redesign fix-qa E8: the tab is written straight to window.history (`addQueryToUrl`), which the router's location does not
// follow. The SplitView mounts the panel in another place when it opens as a page (and back), so the panel remounts and
// `useLocation()` still has the section it was first opened with: «Back to split view» landed on Details. The address bar is
// the truth whenever it carries the order (`id`) or a section; the router's location is the fallback (a memory router, a page
// that does not write the URL).
// redesign F6c (Q2-02): what counts as «text the user typed» when the panel is asked to close: a text field or textarea
// whose value is not the one it had when the user first touched it. It is read when the close is asked, so a field that
// left the panel (Edit customer saved or cancelled) or went back to its value (a sent chat draft) counts for nothing.
const NON_TEXT_INPUTS = ['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']
const isTextEntry = (node) => node instanceof window.HTMLTextAreaElement ||
  (node instanceof window.HTMLInputElement && !NON_TEXT_INPUTS.includes((node.getAttribute('type') || 'text').toLowerCase()))

const getSection = (routerQuery) => {
  const live = new URLSearchParams(window.location.search)
  const params = live.has('id') || live.has('section') ? live : routerQuery
  return params.get('section')
}

const OrderDetailsUI = (props) => {
  const {
    isTourOpen,
    handleBackRedirect,
    handleOpenOrderDetail,
    messages,
    setCurrentTourStep,
    currentTourStep,
    isTourFlag,
    setIsTourFlag,
    setIsTourOpen,
    actionStatus,
    handleUpdateComment,
    handleCloneOrder,
    cloneState,
    setCloneState,
    showReservationAlert,
    setShowReservationAlert,
    layout = 'overlay',
    expanded: expandedProp,
    onExpandedChange
  } = props

  const query = new URLSearchParams(useLocation().search)
  // inside a user's record (isSelectedOrders) `section` and `tab` belong to the record (?section=orders, ?tab=orders):
  // the order keeps its tab in memory and never reads, writes or clears them
  const ownsUrl = !props.isSelectedOrders
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [{ user, token }] = useSession()
  const [ordering] = useApi()
  const [forterPluginInstalled, setForterPluginInstalled] = useState(false)
  const printRef = useRef()
  const printTicketRef = useRef()
  // (main #480): the kitchen ticket can drop sections; the choice is remembered on this device
  const [ticketSections, setTicketSections] = useState(() => ({
    ...defaultTicketSections,
    ...readTicketSections()
  }))
  const applyTicketSections = (sections) => {
    setTicketSections({ ...defaultTicketSections, ...sections })
  }

  const [tab, setTab] = useState(() => {
    const fromUrl = ownsUrl ? TAB_BY_SECTION[getSection(query)] : undefined
    return !fromUrl || (fromUrl === 'chat' && user?.level === 5) ? 'details' : fromUrl
  })
  const [cloneOpen, setCloneOpen] = useState(false)
  const [localExpanded, setLocalExpanded] = useState(false)
  const [unreadAlert, setUnreadAlert] = useState({ business: false, driver: false, customer: false })
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [commentInfoState, setCommentInfostate] = useState({ open: false, driverId: null })
  // redesign W0-2 r2 (W0-Q1-06): the panel's own root, to find the status select of the foot again.
  const panelRootRef = useRef(null)
  const { registerCloseGuard, getEscapedField } = useSplitView()
  const [discardOpen, setDiscardOpen] = useState(false)
  const discardProceedRef = useRef(null)
  // redesign F6d (Q3-09): the field the first Escape took the focus from, for «Keep editing» to give it back
  const discardFieldRef = useRef(null)
  // field -> the value it had when the user first reached it (focus, or the first input when no focus came before)
  const touchedFields = useRef(new Map())
  const {
    order,
    loading,
    error: orderError
  } = props.order

  // "Open as page": the split view owns it when the page passes it, otherwise the panel does.
  const expanded = expandedProp ?? localExpanded
  const setExpanded = (next) => {
    const value = typeof next === 'function' ? next(expanded) : next
    if (expandedProp === undefined) setLocalExpanded(value)
    onExpandedChange?.(value)
  }

  const getFraudLabel = (fraudStatus) => {
    switch (fraudStatus) {
      case 'valid': return t('FRAUD_APPROVED', 'Approved')
      case 'invalid': return t('FRAUD_DECLINED', 'Declined')
      case 'error': return t('FRAUD_FAIL_OPEN', 'Fail-open')
      default: return ''
    }
  }

  useEffect(() => {
    if (!token || !ordering?.root) return
    const checkForterPlugin = async () => {
      try {
        const response = await fetch(`${ordering.root}/plugins/key/braintree`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })
        const { error, result } = await response.json()
        setForterPluginInstalled(!error && !!result)
      } catch {
        setForterPluginInstalled(false)
      }
    }
    checkForterPlugin()
  }, [token, ordering])

  const getLogisticTag = (status) => {
    switch (parseInt(status)) {
      case 0:
        return t('PENDING', 'Pending')
      case 1:
        return t('IN_PROGRESS', 'In progress')
      case 2:
        return t('IN_QUEUE', 'In queue')
      case 3:
        return t('EXPIRED', 'Expired')
      case 4:
        return t('RESOLVED', 'Resolved')
      default:
        return t('UNKNOWN', 'Unknown')
    }
  }

  const getPriorityTag = (priority) => {
    switch (parseInt(priority)) {
      case -1:
        return t('LOW', 'Low')
      case 0:
        return t('NORMAL', 'Normal')
      case 1:
        return t('HIGH', 'High')
      case 2:
        return t('URGENT', 'Urgent')
      default:
        return t('UNKNOWN', 'Unknown')
    }
  }

  const unreadMessages = () => {
    const unreadedMessages = messages?.messages.filter(message => !message?.read && message?.can_see?.includes(0) && message?.author_id !== user.id)
    const customer = unreadedMessages?.some(message => message?.author?.level === 3)
    const business = unreadedMessages?.some(message => message?.author?.level === 2)
    const driver = unreadedMessages?.some(message => message?.author?.level === 4)
    setUnreadAlert({ business, driver, customer })
  }

  useEffect(() => {
    unreadMessages()
  }, [messages?.messages])

  // The URL says where the panel is: no section for Details, ?section= for the others.
  // Leaving Activity drops its ?tab= filter so it does not outlive the tab.
  const writeTabToUrl = (key) => {
    if (!ownsUrl) return
    if (key === 'details') {
      removeQueryToUrl(['section', 'tab'])
      return
    }
    if (key !== 'activity') removeQueryToUrl(['tab'])
    addQueryToUrl({ section: SECTION_BY_TAB[key] })
  }

  const selectTab = (key, isInitialRender) => {
    if (key === 'chat' && user?.level === 5) return
    setTab(key)
    if (key === 'chat') setUnreadAlert(previous => ({ ...previous, customer: false }))
    if (!isInitialRender) writeTabToUrl(key)
  }

  // Same entry point the header and the tour always used.
  const handleShowOption = (option, isInitialRender) => {
    if (option === 'clone_order') {
      setCloneOpen(true)
      if (!isInitialRender && ownsUrl) addQueryToUrl({ section: 'clone_order' })
      return
    }
    const key = TAB_BY_SECTION[option]
    if (key) selectTab(key, isInitialRender)
  }

  const closeClone = () => {
    setCloneOpen(false)
    writeTabToUrl(tab)
  }

  const trackField = (event) => {
    const field = event.target
    if (!isTextEntry(field) || touchedFields.current.has(field)) return
    touchedFields.current.set(field, event.type === 'focus' ? field.value : field.defaultValue)
  }

  const hasUnsavedFields = () => {
    let unsaved = false
    touchedFields.current.forEach((baseline, field) => {
      if (!field.isConnected) touchedFields.current.delete(field)
      else if (field.value !== baseline) unsaved = true
    })
    return unsaved
  }

  const closePanel = () => {
    if (ownsUrl) removeQueryToUrl(['section', 'tab'])
    props.onClose?.()
  }

  // Asks first when there is unsaved text; `proceed` is how the caller closes (the split view's own exit for Escape).
  // True means the question is open and the panel stays.
  const askBeforeClosing = (proceed) => {
    if (!hasUnsavedFields()) return false
    discardProceedRef.current = proceed || closePanel
    discardFieldRef.current = getEscapedField()
    setDiscardOpen(true)
    return true
  }
  const askBeforeClosingRef = useRef(askBeforeClosing)
  askBeforeClosingRef.current = askBeforeClosing
  useEffect(() => registerCloseGuard(proceed => askBeforeClosingRef.current(proceed)), [registerCloseGuard])

  const actionSidebar = (value) => {
    if (value) return
    if (askBeforeClosing(null)) return
    closePanel()
  }

  const handleDiscard = () => {
    const proceed = discardProceedRef.current || closePanel
    discardProceedRef.current = null
    discardFieldRef.current = null
    setDiscardOpen(false)
    proceed()
  }

  const handleChangeTour = (evt) => {
    if (!isTourOpen) return

    if (isTourOpen && order?.delivery_type === 1 && currentTourStep !== 2) {
      setCurrentTourStep(2)
      return
    }
    if (evt.target.closest('.driver-select')) return
    if (isTourOpen && setCurrentTourStep) {
      handleShowOption('chat')
      setTimeout(() => {
        isTourOpen && setCurrentTourStep && setCurrentTourStep(3)
      }, 1)
    }
  }

  const handleChangeKeyboard = (evt) => {
    if (evt.keyCode === 37 && currentTourStep === 2) setCurrentTourStep(1)
    if (evt.keyCode === 39 && currentTourStep === 1 && order?.delivery_type === 1) setCurrentTourStep(2)
    if (evt.keyCode === 39 && currentTourStep === 1 && order?.delivery_type !== 1) {
      handleShowOption('chat')
      setTimeout(() => {
        isTourOpen && setCurrentTourStep && setCurrentTourStep(3)
      }, 1)
    }
    if (evt.keyCode === 37 && currentTourStep === 3) {
      setTab('details')
      order?.delivery_type === 1 ? setCurrentTourStep(2) : setCurrentTourStep(1)
      setIsTourFlag(false)
    }
    if ((evt.keyCode === 39 && currentTourStep === 2)) {
      handleShowOption('chat')
      setCurrentTourStep(3)
    }
    if (evt.keyCode === 39 && currentTourStep === 3) {
      props.onClose?.()
      setCurrentTourStep(4)
    }
  }

  useEffect(() => {
    if (!isTourOpen) return
    document.addEventListener('keydown', handleChangeKeyboard)
    return () => document.removeEventListener('keydown', handleChangeKeyboard)
  }, [isTourOpen, currentTourStep])

  useEffect(() => {
    if (!isTourFlag) return
    handleShowOption('chat')
    setTimeout(() => {
      setCurrentTourStep(3)
    }, 1)
  }, [isTourFlag])

  const onSubmit = (comment) => {
    handleUpdateComment({ comment, driverId: commentInfoState?.driverId })
    setCommentInfostate({ ...commentInfoState, open: false })
  }

  useEffect(() => {
    if (loading || !ownsUrl) return
    const section = getSection(query)
    if (section) {
      handleShowOption(section, true)
    }
  }, [loading])

  useEffect(() => {
    if (!actionStatus?.error) return
    // redesign F6i-3 (A3-03): a refund error is told by the bill's own dialog, never twice.
    if (actionStatus?.errorSource === 'refund') return
    setAlertState({
      open: true,
      content: actionStatus?.error
    })
  }, [actionStatus?.error])

  useEffect(() => {
    if (order?.cloned_order_id && order?.customer_id) {
      setCloneOpen(false)
    }
  }, [order?.id, order?.cloned_order_id, order?.customer_id])

  useEffect(() => {
    if (showReservationAlert) {
      setAlertState({
        open: true,
        content: `${t('ORDER_RESERVATION_SCHEDULED_TO', 'Order reserved to')}: ${parseDate(order?.reservation?.reserve_date, { utc: false })}`
      })
      setShowReservationAlert(false)
    }
  }, [showReservationAlert])

  const progressBarObjt = order?.delivery_type && order?.delivery_type === 2 ? getOrderStatuPickUp : getOrderStatus
  const hasOrder = !!order && Object.keys(order).length > 0
  // redesign messages B1 (B1-6, decision 7A): the tab counts the messages people wrote; the API's `unread_count` also counts
  // order events (#13993 showed 8 for 2 messages). It is the fallback only when the API sends no direct count.
  const unreadCount = Number(order?.unread_direct_count !== undefined ? order.unread_direct_count : order?.unread_count) || 0
  const orderTitle = t('ORDER_NUMBER_TITLE', 'Order _id_').replace('_id_', order?.id ?? props.orderId ?? '')

  // What every tab and the footer receive: all the props of the panel plus the ones its
  // local state owns (unread dots, the driver comment dialog, Forter, the expanded flag).
  const tabProps = {
    ...props,
    unreadAlert,
    commentInfoState,
    setCommentInfostate,
    forterPluginInstalled,
    getFraudLabel,
    getLogisticTag,
    getPriorityTag,
    expanded,
    onSelectTab: selectTab
  }

  const tabItems = [
    { value: 'details', label: t('DETAILS', 'Details') },
    { value: 'activity', label: t('ACTIVITY', 'Activity') },
    ...(user?.level !== 5
      ? [{
          value: 'chat',
          label: t('CHAT', 'Chat'),
          count: unreadCount > 0 ? unreadCount : undefined,
          countLabel: unreadCount === 1
            ? t('UNREAD_MESSAGE_ONE', '1 unread message')
            : unreadCount > 1 ? t('UNREAD_MESSAGES_COUNT', '_count_ unread messages').replace('_count_', unreadCount) : undefined
        }]
      : []),
    { value: 'fields', label: t('CUSTOM_FIELDS', 'Custom fields') }
  ]

  // The chat is not in this list: it stays mounted (hidden) while another tab shows, see below.
  const tabContent = {
    details: <DetailsTab {...tabProps} />,
    activity: <ActivityTab {...tabProps} />,
    fields: <FieldsTab {...tabProps} />
  }

  const content = (
    <div
      ref={panelRootRef}
      className='odc-root odc-od'
      id='orderDetails'
      data-expanded={expanded ? '' : undefined}
      aria-busy={loading ? 'true' : undefined}
      onFocus={trackField}
      onInput={trackField}
      onChange={trackField}
    >
      {loading && (
        <PanelSkeleton
          loadingLabel={t('LOADING', 'Loading')}
          closeLabel={t('CLOSE', 'Close')}
          onClose={() => actionSidebar(false)}
        />
      )}
      {hasOrder && !loading && (
        <div className='odc-od-frame' data-tour='tour_detail' onClick={handleChangeTour}>
          <OrderDetailsHeader
            isServiceOrder={props.isServiceOrder}
            order={order}
            actionSidebar={actionSidebar}
            handleShowOption={handleShowOption}
            handleDeleteOrder={props.handleDeleteOrder}
            isTourOpen={isTourOpen}
            currentTourStep={currentTourStep}
            setIsTourOpen={setIsTourOpen}
            printRef={printRef}
            printTicketRef={printTicketRef}
            ticketSections={ticketSections}
            onTicketSectionChange={(key, enabled) => {
              setTicketSections(prev => {
                const next = { ...prev, [key]: enabled }
                writeTicketSections(next)
                return next
              })
            }}
            onTicketSectionsLoad={() => applyTicketSections(readTicketSections())}
            isExpand={expanded}
            setIsExpand={setExpanded}
            getPluginRefundProvider={props.getPluginRefundProvider}
          />
          {/* parity audit 2 (B1, B8): one Messages controller for the route, Activity and Chat. */}
          <OrderMessagesProvider order={order} handleUpdateOrderForUnreadCount={props.handleUpdateOrderForUnreadCount}>
          <Tabs
            className='odc-od-tabs'
            value={tab}
            onValueChange={(key) => selectTab(key)}
            label={t('ORDER_SECTIONS', 'Order sections')}
            size='sm'
            items={tabItems}
          >
            <TabPanel
              value={tab}
              className='odc-od-body'
              data-tab={tab}
              data-no-scroll={isTourOpen && currentTourStep === 2 ? '' : undefined}
            >
              {tabContent[tab]}
              {/* redesign fix-qa E6 (main had the chat as a panel beside the detail, so it kept its
                  draft, image and recipients): the chat is mounted once and only hidden when another tab
                  shows. `active` tells it whether the user can see it, so it does not mark messages as
                  read in the dark. Level 5 has no chat. */}
              {user?.level !== 5 && (
                <div className='odc-od-chat-pane' hidden={tab !== 'chat'}>
                  <ChatTab {...tabProps} active={tab === 'chat'} />
                </div>
              )}
            </TabPanel>
            <DetailsFooter {...tabProps} />
          </Tabs>
          </OrderMessagesProvider>
        </div>
      )}

      {/* a failed load (5xx, no network) is not an order that does not exist: it says so and offers Try
          again, like the list. Both states keep the way out the skeleton had, Close at the end of the head row. */}
      {!loading && !order && (
        <div className='odc-od-frame' data-state={orderError ? 'error' : 'not-found'}>
          <header className='odc-root odc-od-head'>
            <div className='odc-od-head-row'>
              <span className='odc-od-spacer' />
              <div className='odc-od-head-actions'>
                <IconButton icon={X} label={t('CLOSE', 'Close')} onClick={() => actionSidebar(false)} />
              </div>
            </div>
          </header>
          {orderError
            ? (
              <EmptyState
                tone='error'
                icon={TriangleAlert}
                title={t('ORDER_LOAD_ERROR_TITLE', 'We couldn’t load the order')}
                description={t('ORDERS_LOAD_ERROR_TEXT', 'The server didn’t answer. Check your connection and try again.')}
                action={<Button onClick={() => props.handleRetryOrder?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
              />
              )
            : (
              <EmptyState
                icon={Search}
                title={t('NOT_FOUND_ORDER', 'Sorry, we couldn\'t find the requested order.')}
                action={(
                  <Button onClick={handleBackRedirect ?? props?.onClose}>
                    {t('PROFILE_ORDERS_REDIRECT', 'Go to Orders')}
                  </Button>
                )}
              />
              )}
        </div>
      )}

      {hasOrder && !loading && !order?.cloned_order_id && order?.customer_id && (
        <Dialog
          open={cloneOpen}
          onOpenChange={(next) => { if (!next) closeClone() }}
          title={t('CLONE_ORDER', 'Clone order')}
          size='sm'
          closeLabel={t('CLOSE', 'Close')}
        >
          <CloneOrder
            orderId={order?.id}
            products={order.products}
            userId={order?.customer_id}
            handleOpenOrderDetail={handleOpenOrderDetail}
            handleCloneOrder={handleCloneOrder}
            cloneState={cloneState}
            setCloneState={setCloneState}
            onCancel={closeClone}
          />
        </Dialog>
      )}

      {hasOrder && !loading && (
        <OrderToPrint
          ref={printRef}
          order={order}
          placeSpotEnabled={[3, 4]}
          getOrderStatus={progressBarObjt}
          getLogisticTag={getLogisticTag}
          getPriorityTag={getPriorityTag}
        />
      )}
      {hasOrder && !loading && (
        <OrderToPrintTicket
          ref={printTicketRef}
          order={order}
          getOrderStatus={progressBarObjt}
          sections={ticketSections}
        />
      )}

      <ConfirmDialog
        open={discardOpen}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleDiscard}
        onCancel={() => setDiscardOpen(false)}
        finalFocus={() => {
          const field = discardFieldRef.current
          discardFieldRef.current = null
          return field?.isConnected ? field : true
        }}
      >
        {t('ORDER_PANEL_DISCARD_TEXT', 'What you typed in this order is not saved yet.')}
      </ConfirmDialog>
      <AlertDialog
        title={t('ORDER_DETAILS', 'Order details')}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        content={alertState.content}
        open={alertState.open}
        // redesign W0-2 r2 (W0-Q1-06): a status change that fails rebuilds the select of the foot (OrderStatusTypeSelector
        // remounts it to revert), so the trigger that had the focus is gone. The focus returns to the new one.
        returnFocus={() => panelRootRef.current?.querySelector('.odt-foot-selector [aria-haspopup="listbox"]')}
        onClose={() => setAlertState({ open: false, content: [] })}
      />
      {/* redesign deliveries-followups P3: the one comment dialog of Shared/Product, also on the /deliveries board */}
      <AssignCommentDialog
        open={!!commentInfoState?.open}
        onSubmit={onSubmit}
        onCancel={() => setCommentInfostate({ driverId: null, open: false })}
        // redesign bugs-d row 58 (R-3): the opener is an option of the driver selector, gone on close; the focus goes to its trigger
        returnFocus={() => panelRootRef.current?.querySelector('.driver-select [aria-haspopup="listbox"]')}
      />
    </div>
  )

  // Split: the page (OrdersManager) puts this content in the panel of its SplitView.
  // Overlay (deliveries, appointments, all-in-one, messages, customer and driver detail):
  // a lateral Sheet that traps the focus and closes with Escape.
  if (layout === 'split') return content

  // redesign bugs H (W1-QC2-01): the lazy boundary draws its own skeleton Sheet (OrderDetailsLazy) and this Sheet is another node, so
  // the control of the skeleton that had the focus («Close») leaves the page when the panel arrives, and the focus used to end on
  // <body> (the screen reader did not announce the order that arrived). The panel's Sheet opens with the focus on its title
  // (`tabIndex -1`, like the split's `aside` of W0-QA2-04): always inside the dialog, and it names the order.
  const focusTitle = () => {
    const title = panelRootRef.current?.closest('.odc-sheet')?.querySelector('.odc-overlay-title')
    if (!title) return true
    title.tabIndex = -1
    return title
  }

  return (
    <Sheet
      initialFocus={focusTitle}
      open={props.open !== false}
      onOpenChange={(next) => {
        if (next) return
        if (askBeforeClosing(null)) return
        closePanel()
        setIsTourOpen && setIsTourOpen(false)
      }}
      title={orderTitle}
      closeLabel={t('CLOSE', 'Close')}
      side='end'
      className='odc-order-sheet'
      data-expanded={expanded ? '' : undefined}
    >
      {content}
    </Sheet>
  )
}

export default OrderDetailsUI
