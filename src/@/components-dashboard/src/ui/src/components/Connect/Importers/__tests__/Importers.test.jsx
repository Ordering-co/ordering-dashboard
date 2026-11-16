/* eslint-disable import/first */
// redesign IM-A: /connect/importers is the Connect shell with the kind `importer` (PosMenu). What the shell does (the table, the
// panel, ?id=) is tested in PosMenu/__tests__/ImportersShell.test.jsx; here, that `Importers` is that wiring and nothing else.
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const seen = vi.hoisted(() => ({ props: null }))

vi.mock('../../PosMenu', () => ({
  PosMenu: (props) => {
    seen.props = props
    return <div data-testid='pos-menu' />
  }
}))

import { Importers } from '../index'
import * as importersModule from '../index'

describe('Connect Importers', () => {
  beforeEach(() => {
    seen.props = null
  })

  it('mounts the Connect shell with the kind importer', () => {
    render(<Importers />)
    expect(screen.getByTestId('pos-menu')).toBeInTheDocument()
    expect(seen.props.kind).toBe('importer')
  })

  it('passes the page props through (isUseQuery and onBusinessRedirect), and the kind cannot be changed by them', () => {
    const onBusinessRedirect = vi.fn()
    render(<Importers isUseQuery onBusinessRedirect={onBusinessRedirect} kind='pos' />)
    expect(seen.props.isUseQuery).toBe(true)
    expect(seen.props.onBusinessRedirect).toBe(onBusinessRedirect)
    expect(seen.props.kind).toBe('importer')
  })

  it('ImportersUI is gone: the old panel, list and header are no longer wired here', () => {
    expect(importersModule.ImportersUI).toBeUndefined()
  })
})
