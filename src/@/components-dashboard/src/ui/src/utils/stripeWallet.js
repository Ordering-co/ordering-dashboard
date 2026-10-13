export const toStripeAmountCents = (amount) => {
  const dollars = Number(amount)
  if (!Number.isFinite(dollars) || dollars < 0) return 0
  return Math.round(dollars * 100)
}

export const mapWalletPaymentMethod = (paymentMethod) => {
  if (!paymentMethod?.id) return null
  return {
    ...paymentMethod.card,
    id: paymentMethod.id,
    type: paymentMethod.type,
    source_id: paymentMethod.id,
    card: {
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4
    }
  }
}

export const getWalletCompleteStatus = (placeResult) => {
  if (!placeResult || placeResult.error) return 'fail'
  return 'success'
}

export const settleWalletPayment = async ({
  paymentMethod,
  placeOrder,
  handleSource,
  stringifySource
}) => {
  const data = mapWalletPaymentMethod(paymentMethod)
  if (!data) {
    return { complete: 'fail', data: null, shouldCancel: false }
  }

  try {
    if (typeof placeOrder === 'function') {
      const result = await placeOrder(data)
      const complete = getWalletCompleteStatus(result)
      return {
        complete,
        data,
        shouldCancel: complete === 'success'
      }
    }

    const sourcePayload = stringifySource ? JSON.stringify(data) : data
    await handleSource?.(sourcePayload)
    return { complete: 'success', data, shouldCancel: true }
  } catch {
    return { complete: 'fail', data, shouldCancel: false }
  }
}
