import React, { useMemo, useState } from 'react'
import { useLanguage as useBaseLanguage } from './language'

const users = [
  { id: 201, name: 'Driver', lastname: 'Without assigned orders', assigned_orders_count: 0 },
  { id: 202, name: 'Driver', lastname: 'With three assigned orders', assigned_orders_count: 3 }
]
const customers = [
  { id: 301, name: 'Customer', lastname: 'Long account name for responsive coverage', assigned_orders_count: 0 },
  { id: 302, name: 'Second', lastname: 'Customer', assigned_orders_count: 0 }
]
const allBusinesses = Array.from({ length: 25 }, (_, index) => ({ id: index + 401, name: `Business with long fixture name ${String(index + 1).padStart(2, '0')}` }))
globalThis.__OD_MESSAGES_USER_REFERENCES__ = [...users, ...customers]
globalThis.__OD_MESSAGES_BUSINESS_REFERENCES__ = allBusinesses
// redesign messages FASE 3 (decision 1A): the real Inbox (list, header, chat) mounts here, so the fixture utils also give what the rows,
// the header and the chat read: dates, prices and relative times.
const utilsState = [{
  optimizeImage: value => value,
  parseDate: value => String(value ?? ''),
  parsePrice: (value) => `$ ${Number(value).toFixed(2)}`,
  getTimeAgo: () => '5 min ago'
}]
const sessionState = [{ user: { id: 1, level: 0, name: 'Admin' } }]
const configState = [{ configs: {} }]
const recordController = (kind, props) => {
  globalThis.__OD_MESSAGES_CONTROLLER_PROPS__ = [...(globalThis.__OD_MESSAGES_CONTROLLER_PROPS__ || []), {
    kind,
    asDashboard: props.asDashboard,
    defaultUserTypesSelected: props.defaultUserTypesSelected,
    driversPropsToFetch: props.driversPropsToFetch,
    initialPageSize: props.initialPageSize,
    loadMorePageSize: props.loadMorePageSize,
    propsToFetch: props.propsToFetch,
    searchFlags: [props.isSearchByUserEmail, props.isSearchByUserPhone, props.isSearchByUserName, props.isSearchByBusinessName, props.isSearchByBusinessEmail, props.isSearchByBusinessPhone]
  }]
}

// redesign messages FASE 3 (decision 2A): the rows and the header read the status name from the dictionary (an empty one gives the English defaults)
export const useLanguage = () => {
  const [state, t] = useBaseLanguage()
  return useMemo(() => [state.dictionary ? state : { ...state, dictionary: {} }, t], [state, t])
}
export const useUtils = () => utilsState
export const useSession = () => sessionState
export const useConfig = () => configState

// redesign messages FASE 3 (decisions 2A, 3A): the conversations the list controller hands its UI. 25 orders, 10 a page, so the list has a pager;
// two have no messages yet, three have unread messages and one is an ended order.
const conversations = Array.from({ length: 25 }, (_, index) => ({
  id: 501 + index,
  status: index === 2 ? 1 : index === 4 ? 11 : 0,
  delivery_type: 1,
  customer: { id: 600 + index, name: index === 0 ? 'Customer with a long account name for responsive coverage' : `Customer ${index + 1}`, lastname: index === 0 ? 'and second surname' : 'Fixture' },
  customer_id: 600 + index,
  business: { id: 421 + (index % 2), name: `Business with long fixture name ${String((index % 2) + 1).padStart(2, '0')}` },
  driver: index === 1 ? { id: 202, name: 'Driver', lastname: 'Assigned' } : null,
  summary: { total: 24.5 + index },
  last_direct_message_at: index < 2 ? null : '2026-10-09 10:00:00',
  unread_direct_count: index === 0 || index === 3 || index === 5 ? 2 : 0
}))
globalThis.__OD_MESSAGES_CONVERSATION_REFERENCES__ = conversations
const recordConversationList = (props) => {
  globalThis.__OD_MESSAGES_CONVERSATIONS__ = {
    scope: props.scope,
    sort: props.sort,
    orderBy: props.orderBy,
    orderStatus: props.orderStatus,
    withMessagesOnly: props.withMessagesOnly,
    pullInOnMessage: props.pullInOnMessage,
    timeStatus: props.timeStatus,
    orderIdForUnreadCountUpdate: props.orderIdForUnreadCountUpdate,
    // since /messages round 2 (M-08, 9edf455d) the inbox resets the counts with { orderId, seq } and counts only the
    // messages of someone else (M-D12); orderIdForUnreadCountUpdate stays for the other consumers of the list controller
    unreadResetSignal: props.unreadResetSignal,
    unreadByAuthor: props.unreadByAuthor,
    selectedId: props.selectedId
  }
}

export const DashboardOrdersList = ({ UIComponent, ...props }) => {
  recordConversationList(props)
  const state = new URLSearchParams(window.location.search).get('state') || 'populated'
  const [page, setPage] = useState({ currentPage: 1, pageSize: 10 })
  // a stable list: the inbox stores the orders the UI reports, a new array on every render would loop
  const orderList = useMemo(() => ({
    loading: state === 'loading',
    orders: state === 'empty' ? [] : conversations.slice((page.currentPage - 1) * page.pageSize, page.currentPage * page.pageSize),
    error: null
  }), [state, page.currentPage, page.pageSize])
  return React.createElement(UIComponent, {
    ...props,
    orderList,
    pagination: { ...page, total: state === 'empty' ? 0 : conversations.length },
    getPageOrders: (pageSize, currentPage) => {
      globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'getPageOrders', args: [pageSize, currentPage] }]
      setPage({ currentPage, pageSize })
    },
    outsideMessages: 0,
    arrival: null
  })
}

// redesign messages FASE 3 (decision 9A): the order chat controller. It gives the chat UI one conversation with an internal note, so the composer,
// the recipients and the log are real; every prop the Inbox hands it is kept for the spec.
export const Messages = ({ UIComponent, ...props }) => {
  globalThis.__OD_MESSAGES_CHAT__ = { orderId: props.orderId, readPolicy: props.readPolicy, engaged: props.engaged, layout: props.layout, handleUpdateOrderForUnreadCount: props.handleUpdateOrderForUnreadCount }
  const [message, setMessage] = useState('')
  const [image, setImage] = useState(null)
  const [canRead, setCanRead] = useState({ administrator: true, business: true, customer: true, driver: true })
  const order = props.order
  const messages = useMemo(() => ({
    loading: false,
    error: null,
    messages: [
      { id: 1, type: 2, comment: 'Hello, where is my order?', author_id: order.customer_id, author: { id: order.customer_id, name: order.customer?.name, level: 3 }, can_see: [0, 2, 3], created_at: '2026-10-09 10:00:00', read: true },
      { id: 2, type: 2, comment: 'Internal note for the store only.', author_id: 1, author: { id: 1, name: 'Admin', level: 0 }, can_see: [0, 2], created_at: '2026-10-09 10:01:00', read: true }
    ]
  }), [order.id])
  return React.createElement(UIComponent, {
    ...props,
    order,
    messages,
    message,
    image,
    canRead,
    sendMessage: { loading: false, error: null },
    handleSend: () => { globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'send', orderId: props.orderId, message }] },
    handleReadMessages: async (id) => { globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'read', orderId: props.orderId, id }] },
    setMessage,
    setCanRead,
    setImage,
    getHistoryComment: () => null
  })
}
// ActivityTab imports these two beside Messages; the chat never renders them
export const Logistics = () => null
export const LogisticInformation = () => null

export const OrdersManage = ({ UIComponent, ...props }) => {
  recordController('orders', props)
  return React.createElement(UIComponent, {
    ...props,
    searchValue: '',
    driverGroupList: { loading: false, groups: [] },
    driversList: { loading: false, drivers: users },
    paymethodsList: { loading: false, paymethods: [] },
    businessesList: { loading: false, businesses: allBusinesses.slice(0, 2) },
    filterValues: { status: 'all' },
    selectedSubOrderStatus: 'pending',
    handleChangeSearch: value => { globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'search', value }] },
    handleChangeFilterValues: value => { globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'filters', value }] }
  })
}

export const UsersList = ({ UIComponent, ...props }) => {
  recordController('users', props)
  const state = new URLSearchParams(window.location.search).get('state') || 'populated'
  const source = props.isDriver ? users : customers
  return React.createElement(UIComponent, {
    ...props,
    usersList: { loading: state === 'loading', users: state === 'empty' ? [] : source },
    paginationProps: { currentPage: 1, totalPages: 2 },
    paginationDetail: { from: 1, to: 2, total: 4 },
    getUsers: (...args) => { globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'getUsers', args }] }
  })
}

export const DashboardBusinessList = ({ UIComponent, ...props }) => {
  recordController('businesses', props)
  const state = new URLSearchParams(window.location.search).get('state') || 'populated'
  const [count, setCount] = useState(20)
  const businesses = useMemo(() => state === 'empty' ? [] : allBusinesses.slice(0, count), [count, state])
  const businessList = useMemo(() => ({ loading: state === 'loading', businesses }), [businesses, state])
  const pagination = useMemo(() => ({ currentPage: 1, pageSize: 20, totalPages: 3, total: 25 }), [])
  return React.createElement(UIComponent, {
    ...props,
    businessList,
    pagination,
    loadMoreBusinesses: () => {
      globalThis.__OD_MESSAGES_RECEIPTS__ = [...(globalThis.__OD_MESSAGES_RECEIPTS__ || []), { kind: 'loadMoreBusinesses', args: [] }]
      setCount(25)
    }
  })
}
