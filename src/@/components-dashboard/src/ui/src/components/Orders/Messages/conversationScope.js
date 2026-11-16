// redesign messages B3a: what the /messages conversation list asks the orders controller for (owner decision 3A).

// Statuses in which the order has ended and nobody can write any more. The same list ChatTab (OrderDetails) and Messages hold.
export const CHAT_ENDED_STATUSES = [1, 2, 5, 6, 10, 11, 12, 15, 16, 17]

// Every status the list has always asked for: 0 to 26.
export const ALL_ORDER_STATUSES = Array.from({ length: 27 }, (_, status) => status)

export const ACTIVE_ORDER_STATUSES = ALL_ORDER_STATUSES.filter(status => !CHAT_ENDED_STATUSES.includes(status))

// Module constants, so the controller (which reloads when `orderStatus` changes) sees a new filter only when the scope changes.
const QUERIES = {
  active: { orderStatus: ACTIVE_ORDER_STATUSES, withMessagesOnly: true },
  all: { orderStatus: ALL_ORDER_STATUSES, withMessagesOnly: false }
}

/**
 * «Active»: orders that have not ended, and only those with messages. «All»: today's list, every order with or without messages.
 * A scope that is not known reads as «active», the default.
 * @param {'active'|'all'} scope
 * @returns {{ orderStatus: number[], withMessagesOnly: boolean }}
 */
export const scopeQuery = (scope) => QUERIES[scope === 'all' ? 'all' : 'active']
