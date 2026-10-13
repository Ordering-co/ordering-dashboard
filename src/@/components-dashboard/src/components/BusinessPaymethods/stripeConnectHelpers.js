const hasStripeConnectCredentials = (data) => {
  return Boolean(
    data &&
    typeof data === 'object' &&
    data.token &&
    data.publishable &&
    data.user &&
    data.refresh_token
  )
}

export const mapStripeConnectOAuthResult = (result) => {
  if (!result || typeof result.livemode !== 'boolean') return null
  const data = {
    token: result.access_token,
    publishable: result.stripe_publishable_key,
    user: result.stripe_user_id,
    refresh_token: result.refresh_token
  }
  if (!hasStripeConnectCredentials(data)) return null
  return {
    sandbox: !result.livemode,
    data
  }
}

export const buildStripeConnectSavePayload = (stripeConnectData) => {
  if (!stripeConnectData || Object.keys(stripeConnectData).length === 0) {
    return null
  }

  const {
    data,
    sandbox,
    allowed_order_types: allowedOrderTypes,
    sites,
    devices,
    data_sandbox: _dataSandbox,
    ...rest
  } = stripeConnectData
  const payload = { ...rest }

  if (typeof sandbox === 'boolean') {
    payload.sandbox = sandbox
  }

  if (hasStripeConnectCredentials(data)) {
    const serializedCredentials = JSON.stringify(data)
    if (sandbox) {
      payload.data_sandbox = serializedCredentials
    } else {
      payload.data = serializedCredentials
    }
  }

  if (allowedOrderTypes) {
    payload.allowed_order_types = allowedOrderTypes.length > 0
      ? JSON.stringify(allowedOrderTypes)
      : null
  }
  if (sites) {
    payload.sites = JSON.stringify(sites)
  }
  if (devices) {
    payload.devices = JSON.stringify(devices)
  }

  return payload
}
