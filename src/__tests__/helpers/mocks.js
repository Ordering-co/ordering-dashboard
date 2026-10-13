/**
 * Common module mocks for thin page wrappers.
 * Import this file (or copy patterns) at the top of page tests before importing the page.
 */
import React from 'react'
import { vi } from 'vitest'

/** No-op HelmetTags so pages do not pull config / useConfig / react-helmet. */
export const mockHelmetTags = () => {
  vi.mock('~/components/HelmetTags', () => ({
    HelmetTags: () => null
  }))
  vi.mock('../../components/HelmetTags', () => ({
    HelmetTags: () => null
  }))
}

/**
 * Stub a ~ui export used by a page.
 * @param {Record<string, unknown>} exports
 */
export const mockUiExports = (exports) => {
  vi.mock('~ui', () => exports)
}

/** Minimal stub component that surfaces a test id for smoke assertions. */
export const createStubComponent = (testId) => {
  const Stub = (props) => (
    <div data-testid={testId} data-props={JSON.stringify(Object.keys(props || {}))} />
  )
  Stub.displayName = `Stub(${testId})`
  return Stub
}
