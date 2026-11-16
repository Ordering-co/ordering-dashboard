import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// redesign settings A (decision 9, ST-13): Retry on a failed catalog mounts the controller again, which fetches
// the catalog once more.
const mounts = { count: 0 }

vi.mock('../../../../../../index', () => {
  const ReactInner = require('react')
  return {
    useConfig: () => [{ configs: {} }],
    AllSettings: ({ UIComponent, ...props }) => {
      ReactInner.useEffect(() => { mounts.count += 1 }, [])
      return <UIComponent {...props} categoriesError='failed' categoryLists={null} loadingCategories={false} />
    }
  }
})

vi.mock('../../SettingsHub', () => ({
  SettingsHub: ({ categoriesError, onRetry }) => (
    <div>
      <p>{categoriesError}</p>
      {onRetry && <button type='button' onClick={onRetry}>Retry</button>}
    </div>
  )
}))

const { AllSettings } = await import('../index')

describe('AllSettings', () => {
  it('passes a Retry that mounts the catalog controller again', () => {
    mounts.count = 0
    render(<AllSettings />)
    expect(mounts.count).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mounts.count).toBe(2)
  })
})
