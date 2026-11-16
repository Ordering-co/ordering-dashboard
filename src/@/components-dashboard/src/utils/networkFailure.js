// redesign bugs-d row 80: when a request never reaches the server, fetch rejects with a TypeError whose text depends on the browser
// («Failed to fetch», «NetworkError when attempting to fetch resource.», «Load failed»). Callers use this to say it in words.
const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|network request failed/i

export const isNetworkFailure = (message) => NETWORK_FAILURE.test(typeof message === 'string' ? message : '')
