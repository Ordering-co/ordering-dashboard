import { describe, expect, it } from 'vitest'

import { advanceBulkStatusQueue } from '../bulkStatusQueue'

describe('advanceBulkStatusQueue', () => {
  it('drops the processed head and continues when more orders remain', () => {
    expect(advanceBulkStatusQueue([11, 12, 13])).toEqual({
      remainingOrderIds: [12, 13],
      continueBatch: true
    })
  })

  it('ends the batch after the last selected order is attempted', () => {
    expect(advanceBulkStatusQueue([11])).toEqual({
      remainingOrderIds: [],
      continueBatch: false
    })
  })

  it('ends the batch when the queue is already empty', () => {
    expect(advanceBulkStatusQueue([])).toEqual({
      remainingOrderIds: [],
      continueBatch: false
    })
  })

  it('advances after a failed attempt the same way as after a success', () => {
    const afterFailedFirst = advanceBulkStatusQueue([11, 12, 13])
    expect(afterFailedFirst.continueBatch).toBe(true)
    expect(advanceBulkStatusQueue(afterFailedFirst.remainingOrderIds)).toEqual({
      remainingOrderIds: [13],
      continueBatch: true
    })
  })
})
