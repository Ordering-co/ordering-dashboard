// redesign messages B3a: the two scopes of the /messages conversation list (decision 3A) and the statuses in which a chat has ended.
import { describe, expect, it } from 'vitest'

import {
  ACTIVE_ORDER_STATUSES,
  ALL_ORDER_STATUSES,
  CHAT_ENDED_STATUSES,
  scopeQuery
} from '../conversationScope'

describe('conversationScope', () => {
  it('lists the statuses in which nobody can write any more (the list ChatTab and Messages already hold)', () => {
    expect(CHAT_ENDED_STATUSES).toEqual([1, 2, 5, 6, 10, 11, 12, 15, 16, 17])
  })

  it('«all» asks for every status the list asks for today: 0 to 26', () => {
    expect(ALL_ORDER_STATUSES).toHaveLength(27)
    expect(ALL_ORDER_STATUSES).toEqual(Array.from({ length: 27 }, (_, status) => status))
  })

  it('«active» is every status minus the ended ones, in the same order', () => {
    expect(ACTIVE_ORDER_STATUSES).toEqual(ALL_ORDER_STATUSES.filter(status => !CHAT_ENDED_STATUSES.includes(status)))
    expect(ACTIVE_ORDER_STATUSES).toHaveLength(17)
    CHAT_ENDED_STATUSES.forEach(status => expect(ACTIVE_ORDER_STATUSES).not.toContain(status))
  })

  it('scope «active» asks for the active statuses and only the orders with messages', () => {
    expect(scopeQuery('active')).toEqual({ orderStatus: ACTIVE_ORDER_STATUSES, withMessagesOnly: true })
  })

  it('scope «all» is today\'s list: every status, with or without messages (decision 3A)', () => {
    expect(scopeQuery('all')).toEqual({ orderStatus: ALL_ORDER_STATUSES, withMessagesOnly: false })
  })

  it('hands back the same array for the same scope, so the controller does not see a new status filter on every render', () => {
    expect(scopeQuery('active').orderStatus).toBe(scopeQuery('active').orderStatus)
    expect(scopeQuery('all').orderStatus).toBe(scopeQuery('all').orderStatus)
    expect(scopeQuery('active').orderStatus).not.toBe(scopeQuery('all').orderStatus)
  })

  it('a scope it does not know reads as the default one, «active»', () => {
    expect(scopeQuery(undefined)).toEqual(scopeQuery('active'))
    expect(scopeQuery('archived')).toEqual(scopeQuery('active'))
  })
})
