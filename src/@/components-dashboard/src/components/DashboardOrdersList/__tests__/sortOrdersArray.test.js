import { describe, expect, it } from 'vitest'
import { sortOrdersByOption } from '../index'

// redesign 5.2-C: the in-progress tab lists the earliest delivery first. Orders that
// arrive by socket are placed with this same function, so it has to know the option.
const ids = list => list.map(order => order.id)

describe('sortOrdersByOption', () => {
  it('keeps the existing id orders', () => {
    const list = () => [{ id: 2 }, { id: 9 }, { id: 5 }]
    expect(ids(sortOrdersByOption('id', 'desc', list()))).toEqual([9, 5, 2])
    expect(ids(sortOrdersByOption('id', 'asc', list()))).toEqual([2, 5, 9])
  })

  it('keeps the messages order and leaves unknown options untouched', () => {
    const byMessage = [
      { id: 1, last_direct_message_at: '2024-05-01 10:00:00' },
      { id: 2, last_direct_message_at: '2024-05-03 10:00:00' }
    ]
    expect(ids(sortOrdersByOption('last_direct_message_at', 'asc', byMessage))).toEqual([2, 1])
    expect(ids(sortOrdersByOption('something_else', 'asc', [{ id: 3 }, { id: 1 }]))).toEqual([3, 1])
  })

  it('orders by delivery_datetime ascending, earliest first', () => {
    const list = [
      { id: 1, delivery_datetime_utc: '2024-05-01 12:30:00' },
      { id: 2, delivery_datetime_utc: '2024-05-01 09:00:00' },
      { id: 3, delivery_datetime_utc: '2024-05-02 08:00:00' }
    ]
    expect(ids(sortOrdersByOption('delivery_datetime', 'asc', list))).toEqual([2, 1, 3])
  })

  it('orders by delivery_datetime descending when asked', () => {
    const list = [
      { id: 1, delivery_datetime_utc: '2024-05-01 12:30:00' },
      { id: 2, delivery_datetime_utc: '2024-05-01 09:00:00' },
      { id: 3, delivery_datetime_utc: '2024-05-02 08:00:00' }
    ]
    expect(ids(sortOrdersByOption('delivery_datetime', 'desc', list))).toEqual([3, 1, 2])
  })

  it('prefers delivery_datetime_utc and falls back to delivery_datetime', () => {
    const list = [
      { id: 1, delivery_datetime: '2024-05-01 18:00:00' },
      { id: 2, delivery_datetime_utc: '2024-05-01 10:00:00', delivery_datetime: '2024-05-09 10:00:00' },
      { id: 3, delivery_datetime: '2024-05-01 14:00:00' }
    ]
    expect(ids(sortOrdersByOption('delivery_datetime', 'asc', list))).toEqual([2, 3, 1])
  })

  it('places an order that arrives by socket where its delivery time says, not at the top', () => {
    const page = [
      { id: 10, delivery_datetime_utc: '2024-05-01 10:00:00' },
      { id: 11, delivery_datetime_utc: '2024-05-01 12:00:00' }
    ]
    const arrived = { id: 99, delivery_datetime_utc: '2024-05-01 11:00:00' }
    expect(ids(sortOrdersByOption('delivery_datetime', 'asc', [arrived, ...page]))).toEqual([10, 99, 11])
  })

  it('sends orders without a delivery time to the end and breaks ties by id', () => {
    const list = [
      { id: 4 },
      { id: 3, delivery_datetime_utc: '2024-05-01 10:00:00' },
      { id: 2, delivery_datetime_utc: '2024-05-01 10:00:00' },
      { id: 1, delivery_datetime_utc: 'not a date' }
    ]
    expect(ids(sortOrdersByOption('delivery_datetime', 'asc', list))).toEqual([2, 3, 1, 4])
  })
})
