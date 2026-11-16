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
