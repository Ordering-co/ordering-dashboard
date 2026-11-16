// redesign AH (overlap sweep): the Save / Cancel bar of the add-group form is sticky at the bottom of the record panel,
// whose body keeps --odc-record-pad-end of padding at its foot. A sticky box stops at that padding, so the bar floated 32px above the
// foot and the drivers list showed under it. Like P/SaveBar in a record body (record-panel.css), it gives the padding back.
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { ButtonsContainer } from '../styles'

describe('DriversGroupAddForm › ButtonsContainer', () => {
  it('sticks to the foot of the record body, past its end padding (0 outside a record body)', () => {
    const { container } = render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <ButtonsContainer><button>Save</button></ButtonsContainer>
      </ThemeProvider>
    )
    const bar = getComputedStyle(container.firstChild)
    expect(bar.position).toBe('sticky')
    expect(bar.bottom.replace(/\s+/g, '')).toBe('calc(var(--odc-record-pad-end,0)*-1)')
  })
})
