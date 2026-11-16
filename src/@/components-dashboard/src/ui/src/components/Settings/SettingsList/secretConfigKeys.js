// , credentials the API sends as type 1 (plain text). The Settings hub paints them in P/SecretField like a
// type 7 key (hidden, «Show», last four characters); what is saved does not change. Secrets, tokens, passwords and private keys
// only: publishable and public values (*_publishable*, map_box_token, browser API keys, reCAPTCHA site keys, client and account
// ids) stay visible. Taken from the configs of the test project (2026-10-20); a new secret config is added here.
export const SECRET_TEXT_KEYS = [
  // Stripe
  'stripe_secret',
  'stripe_secret_sandbox',
  'stripe_terminal_secret_key',
  'stripe_terminal_secret_key_sandbox',
  'stripe_terminal_webhook_secret',
  'stripe_terminal_webhook_secret_sandbox',
  'stripe_split_plugin_secret_key',
  'stripe_split_plugin_secret_key_s',
  // other payments
  'global_apple_pay_secret',
  'global_apple_pay_secret_sandbox',
  'global_google_pay_secret',
  'global_google_pay_secret_sandbox',
  'mercado_pago_checkout_pro_marketplace_client_secret',
  'mercado_pago_checkout_pro_sandbox_marketplace_client_secret',
  // sign-in and security
  'apple_login_private_key',
  'facebook_secret',
  'facebook_account_kit_secret',
  'google_client_secret',
  'security_recaptcha_secret_key',
  'security_recaptcha_secret_key_v3',
  // messaging and notifications
  'email_smtp_password',
  'twilio_auth_token',
  'onesignal_user_auth',
  'onesignal_dashboardweb_rest_api_key',
  'onesignal_businessapp_rest_api_key',
  'onesignal_deliveryapp_rest_api_key',
  'onesignal_orderingweb_rest_api_key',
  'onesignal_orderingapp_rest_api_key',
  'intercom_api_key',
  // media, delivery and integrations
  'cloudinary_secret',
  'tookan_key',
  'deliverect_integration_api_key',
  'deliverect_integration_token',
  'deliverect_integration_token_dispatch',
  'deliverect_integration_client_secret_dispatch',
  'shipday_delivery_integration_webhook_token',
  'uber_direct_integration_client_secret',
  'uber_direct_integration_sandbox_client_secret',
  'yango_delivery_integration_api_token',
  'yango_delivery_integration_sandbox_api_token',
  'llamafood_delivery_integration_api_key',
  'llamafood_delivery_integration_sandbox_api_key',
  'llamafood_delivery_integration_webhook_secret',
  'llamafood_delivery_integration_location_webhook_secret',
  'pedidosya_integration_api_token',
  'pedidosya_integration_sandbox_api_token',
  'rappi_cargo_integration_api_token',
  'rappi_cargo_integration_sandbox_api_token',
  'order_auto_accept_user_api_key'
]

/** Whether a config is a credential painted in P/SecretField: type 7, or type 1 with a key of SECRET_TEXT_KEYS. */
export const isSecretConfig = config => config?.type === 7 || (config?.type === 1 && SECRET_TEXT_KEYS.includes(config?.key))
