/* eslint-disable import/first */
// redesign stores 1.A (G2-02, G5-01): Categories, Notifications and Ordering channels save the shared form of the
// store editor as soon as it holds changes. When the save failed, the controller kept those changes in a new formState and the
// effect sent them again, and again: a request loop for as long as the failure lasted. `useSaveOnChange` sends each set of
// changes once: one request per user action, whatever the answer.
import React, { useState } from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSaveOnChange } from '../useSaveOnChange'

// A small stand-in for the controller: the save answers as the API said, and keeps the changes when it failed (as
// handleUpdateBusinessClick does).
const Harness = ({ answer, onSave, expose }) => {
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const save = async () => {
    onSave(formState.changes)
    setFormState({ ...formState, loading: true })
    const ok = await answer()
    setFormState({ ...formState, loading: false, changes: ok ? {} : formState.changes, result: { error: !ok } })
  }
  useSaveOnChange(formState, save)
  expose({ formState, setFormState })
  return null
}

const setup = (answer) => {
  const onSave = vi.fn()
  let api
  render(<Harness answer={answer} onSave={onSave} expose={(value) => { api = value }} />)
  const change = async (changes) => {
    await act(async () => { api.setFormState({ ...api.formState, changes }) })
    // let the answers and the re-renders that follow settle
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() })
  }
  return { onSave, change, get formState () { return api.formState } }
}

describe('useSaveOnChange', () => {
  it('saves once when the form gets changes', async () => {
    const harness = setup(async () => true)
    await harness.change({ types: [1, 2] })
    expect(harness.onSave).toHaveBeenCalledTimes(1)
    expect(harness.onSave).toHaveBeenCalledWith({ types: [1, 2] })
    expect(harness.formState.changes).toEqual({})
  })

  it('does not send the same changes again after a failure (no request loop)', async () => {
    const harness = setup(async () => false)
    await harness.change({ slug: 'taken' })
    expect(harness.onSave).toHaveBeenCalledTimes(1)
    // what failed stays pending
    expect(harness.formState.changes).toEqual({ slug: 'taken' })
    expect(harness.formState.result.error).toBe(true)
  })

  it('a new action after a failure is a new attempt, even with the same value', async () => {
    const { onSave, change } = setup(async () => false)
    await change({ slug: 'taken' })
    await change({ slug: 'taken' })
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('does nothing while the form is empty', async () => {
    const { onSave, change } = setup(async () => true)
    await change({})
    expect(onSave).not.toHaveBeenCalled()
  })

  // review of 1.A: the shell retries what a failed section left when the user opens another section; the new section
  // mounts while that retry runs and must not send the same changes again when it fails
  it('does not send again the changes that were being sent when it mounted', async () => {
    const onSave = vi.fn()
    const Mounted = ({ formState }) => {
      useSaveOnChange(formState, onSave)
      return null
    }
    const pending = { slug: 'taken' }
    const { rerender } = render(<Mounted formState={{ loading: true, changes: pending, result: { error: false } }} />)
    rerender(<Mounted formState={{ loading: false, changes: pending, result: { error: true } }} />)
    expect(onSave).not.toHaveBeenCalled()
    rerender(<Mounted formState={{ loading: false, changes: { slug: 'other' }, result: { error: true } }} />)
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
