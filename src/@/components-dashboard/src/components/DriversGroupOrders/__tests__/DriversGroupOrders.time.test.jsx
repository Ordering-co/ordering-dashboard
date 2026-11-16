// the max times between orders show 3600 s as 1 h, not 0 h.
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DriversGroupOrders } from '../index'

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriversGroupOrders UIComponent={UI} handleChangesState={vi.fn()} {...props} />)
}

describe('DriversGroupOrders controller · max times', () => {
  it('shows 3600 s as 1 h in the three fields', () => {
    draw({
      curDriversGroup: {
        orders_group_max_time_between: 3600,
        orders_group_max_time_between_pickup: 7200,
        orders_group_max_time_between_delivery: 3661
      }
    })
    expect(ui.maxTimeBetweenOrder).toEqual({ hour: 1, minute: 0, second: 0 })
    expect(ui.maxTimeBetweenBusiness).toEqual({ hour: 2, minute: 0, second: 0 })
    expect(ui.maxTimeBetweenDelivery).toEqual({ hour: 1, minute: 1, second: 1 })
  })

  it('keeps 600 s as 0 h 10 min', () => {
    draw({ curDriversGroup: { orders_group_max_time_between: 600 } })
    expect(ui.maxTimeBetweenOrder).toEqual({ hour: 0, minute: 10, second: 0 })
  })
})
