import { useConfig, useLanguage } from '../../../../../index'

export const getUtils = () => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()

  const orderTypesValues = () => {
    const orderTypes = [
      { value: 1, text: t('DELIVERY', 'Delivery'), enabled: true },
      { value: 2, text: t('PICKUP', 'Pickup'), enabled: true },
      { value: 3, text: t('EATIN', 'Eatin'), enabled: true },
      { value: 4, text: t('CURBSIDE', 'Curbside'), enabled: true },
      { value: 5, text: t('DRIVER_THRU', 'Driver thru'), enabled: true },
      { value: 7, text: t('CATERING_DELIVERY', 'Catering delivery'), enabled: true },
      { value: 8, text: t('CATERING_PICKUP', 'Catering pickup'), enabled: true },
      { value: 9, text: t('RESERVATION', 'reservation'), enabled: true }
    ]
    return orderTypes.filter((type) => (type.enabled))
  }

  const checkStripeGlobalConfigs = (!configs?.stripe_publishable?.value ||
    !configs?.stripe_publishable_sandbox?.value ||
    !configs?.stripe_secret?.value ||
    !configs?.stripe_secret_sandbox?.value)

  const checkApplePayGlobalConfigs = (!configs?.global_apple_pay_publishable?.value ||
    !configs?.global_apple_pay_publishable_sandbox?.value ||
    !configs?.global_apple_pay_secret?.value ||
    !configs?.global_apple_pay_secret_sandbox?.value)

  const checkGooglePayGlobalConfigs = (!configs?.global_google_pay_publishable?.value ||
    !configs?.global_google_pay_publishable_sandbox?.value ||
    !configs?.global_google_pay_secret?.value ||
    !configs?.global_google_pay_secret_sandbox?.value)

  const checkComputoGlobalConfigs = (!configs?.computop_merchant_id?.value ||
    !configs?.computop_blowfish_password?.value ||
    !configs?.computop_hmac_password?.value)

  const paymentsGlobalConfigs = {
    stripe: checkStripeGlobalConfigs,
    global_apple_pay: checkApplePayGlobalConfigs,
    global_google_pay: checkGooglePayGlobalConfigs,
    computop: checkComputoGlobalConfigs
  }

  const checkEmpty = (obj) => {
    return !obj || Object.keys(obj).map(key => obj[key] === null || obj[key] === '').includes(true)
  }

  const checkBusinessPaymethodConfigs = (businessPaymethod) => {
    return !businessPaymethod?.data || checkEmpty(businessPaymethod.data)
  }

  return {
    orderTypesValues,
    paymentsGlobalConfigs,
    checkBusinessPaymethodConfigs
  }
}
