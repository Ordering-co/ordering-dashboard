const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js'
const SDK_VERSION = 'v25.0'

/**
 * How long login waits for the WA_EMBEDDED_SIGNUP message after the
 * FB.login callback. Meta does not order the two, and the code expires
 * 30 seconds after it is issued.
 */
export const SESSION_INFO_WAIT_MS = 3000

export const LOGIN_CANCELLED = 'LOGIN_CANCELLED'

let loading = null

const isFacebookOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin)
    return protocol === 'https:' && (hostname === 'facebook.com' || hostname.endsWith('.facebook.com'))
  } catch (err) {
    return false
  }
}

/**
 * Load the Meta JS SDK once and init it with the app id the API returned.
 * @param {string} appId Meta app id from `auth/business_login/init`
 */
export const loadFacebookSdk = (appId) => {
  if (window.FB) {
    window.FB.init({ appId, cookie: true, xfbml: false, version: SDK_VERSION })
    return Promise.resolve(window.FB)
  }
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, xfbml: false, version: SDK_VERSION })
      resolve(window.FB)
    }
    if (document.querySelector(`script[src="${SDK_URL}"]`)) return
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => {
      loading = null
      reject(new Error('FACEBOOK_SDK_LOAD_ERROR'))
    }
    document.body.appendChild(script)
  })
  return loading
}

/**
 * Open Embedded Signup. Resolves with the login response plus the
 * WA_EMBEDDED_SIGNUP session info when Meta sends it.
 * @param {Object} options FB.login options
 */
export const facebookLogin = (options) => new Promise((resolve, reject) => {
  if (!window.FB) {
    reject(new Error('FACEBOOK_SDK_LOAD_ERROR'))
    return
  }
  let sessionInfo = null
  let loginResponse = null
  let waitTimer = null

  const finish = () => {
    window.removeEventListener('message', handleMessage)
    clearTimeout(waitTimer)
    resolve({ ...loginResponse, sessionInfo })
  }
  const handleMessage = (event) => {
    if (!isFacebookOrigin(event.origin)) return
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      if (data?.type === 'WA_EMBEDDED_SIGNUP') {
        sessionInfo = data
        if (loginResponse) finish()
      }
    } catch (err) {}
  }
  window.addEventListener('message', handleMessage)

  window.FB.login((response) => {
    if (!response?.authResponse) {
      window.removeEventListener('message', handleMessage)
      reject(new Error(LOGIN_CANCELLED))
      return
    }
    loginResponse = response
    if (sessionInfo) finish()
    else waitTimer = setTimeout(finish, SESSION_INFO_WAIT_MS)
  }, options)
})
