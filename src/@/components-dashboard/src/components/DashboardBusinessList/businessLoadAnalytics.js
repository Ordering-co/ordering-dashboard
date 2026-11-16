const BUSINESS_LOAD_OPERATION = { module: 'stores', action: 'load_stores' }

const isCancellation = (error) => error?.constructor?.name === 'Cancel'

export const getBusinessLoadOperation = ({ content, error, isInitialLoad = true } = {}) => {
  if (!isInitialLoad) return null
  if (isCancellation(error)) return { status: 'cancelled', ...BUSINESS_LOAD_OPERATION }
  if (error) return { status: 'failed', ...BUSINESS_LOAD_OPERATION, failureType: 'transport' }
  if (content?.error) return { status: 'failed', ...BUSINESS_LOAD_OPERATION, failureType: 'api' }
  return { status: 'succeeded', ...BUSINESS_LOAD_OPERATION }
}

// redesign bugs C: a failed request is an error of the list (by a key the list translates, never the raw message: it
// can carry private data); it used to be `error: null`, which the list read as «no stores». A cancelled one keeps the rows.
export const getCaughtBusinessListState = ({ previousBusinesses = [], error } = {}) => ({
  loading: isCancellation(error),
  businesses: isCancellation(error) ? previousBusinesses : [],
  error: isCancellation(error) ? null : ['NETWORK_ERROR']
})

export const getBusinessLoadStartedOperation = ({ isInitialLoad = true } = {}) => (
  isInitialLoad ? { status: 'started', ...BUSINESS_LOAD_OPERATION } : null
)
