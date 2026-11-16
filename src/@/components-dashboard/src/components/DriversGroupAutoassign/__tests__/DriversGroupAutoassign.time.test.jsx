// the auto-reject time shows 3600 s as 1 h, and editing one field of a group that is not loaded yet never sends NaN.
import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DriversGroupAutoassign } from '../index'

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriversGroupAutoassign UIComponent={UI} handleChangesState={vi.fn()} {...props} />)
}

describe('DriversGroupAutoassign controller · auto-reject time', () => {
  it('shows 3600 s as 1 h 0 min 0 s', () => {
    draw({ curDriversGroup: { autoassign_autoreject_time: 3600 } })
    expect(ui.autoRejectOrderGroup).toEqual({ hour: 1, minute: 0, second: 0 })
  })

  it('splits 3725 s into 1 h 2 min 5 s and keeps 3599 s under the hour', () => {
    draw({ curDriversGroup: { autoassign_autoreject_time: 3725 } })
    expect(ui.autoRejectOrderGroup).toEqual({ hour: 1, minute: 2, second: 5 })
    draw({ curDriversGroup: { autoassign_autoreject_time: 3599 } })
    expect(ui.autoRejectOrderGroup).toEqual({ hour: 0, minute: 59, second: 59 })
  })

  it('without a group, editing one field sends seconds, not NaN', () => {
    const handleChangesState = vi.fn()
    draw({ curDriversGroup: null, handleChangesState })
    act(() => { ui.onChangeAutoRejectOrderGroup('2', 'minute') })
    expect(handleChangesState).toHaveBeenCalledWith({ autoassign_autoreject_time: 120 })
    expect(ui.autoRejectOrderGroup).toEqual({ hour: 0, minute: 2, second: 0 })
  })
})
