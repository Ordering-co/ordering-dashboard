import { describe, expect, it } from 'vitest'
import { JOB_STATUS_FAILED, JOB_STATUS_SUCCESS, isJobResolved, isJobSuccess } from '../index'

// Regression coverage: success must not be defined by
// exclusion ("anything that isn't pending or failed"), so an unrecognized/intermediate
// status or a malformed response would be announced as a false "Import completed".
describe('ImporterJobForm status helpers', () => {
  describe('isJobSuccess', () => {
    it('is true only for the confirmed success status', () => {
      expect(isJobSuccess(JOB_STATUS_SUCCESS)).toBe(true)
    })

    it('is false for pending, failed, unknown, and malformed statuses', () => {
      expect(isJobSuccess(0)).toBe(false)
      expect(isJobSuccess(JOB_STATUS_FAILED)).toBe(false)
      expect(isJobSuccess(2)).toBe(false)
      expect(isJobSuccess(undefined)).toBe(false)
      expect(isJobSuccess(null)).toBe(false)
    })
  })

  describe('isJobResolved', () => {
    it('is true for the confirmed success and failed statuses', () => {
      expect(isJobResolved(JOB_STATUS_SUCCESS)).toBe(true)
      expect(isJobResolved(JOB_STATUS_FAILED)).toBe(true)
    })

    it('is false for queued, unknown/intermediate, and missing statuses', () => {
      expect(isJobResolved(0)).toBe(false)
      expect(isJobResolved(2)).toBe(false)
      expect(isJobResolved(undefined)).toBe(false)
      expect(isJobResolved(null)).toBe(false)
    })
  })
})
