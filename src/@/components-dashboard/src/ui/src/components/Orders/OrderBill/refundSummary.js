const getGatewayHumanLabel = (gateway) => (typeof gateway === 'string' ? gateway.replace(/_/g, ' ') : undefined)

/**
 * redesign F6d (Q3-08): what was already refunded, by method, from the refund events of the order: `[{ label, amount }]`
 * (the amounts of one method added up, in the order the methods first appear). The label is the one the history and the
 * refund table show for that event (the wallet, the payment method or its gateway); it is `undefined` when the event says
 * no method. `t` is the translator.
 */
export const summarizeRefunds = (order, t) => {
  const groups = []
  ;(order?.payment_events ?? []).filter(item => item.event === 'refund').forEach(event => {
    const walletType = event?.wallet_event?.wallet?.type
    let label
    if (event?.wallet_event) {
      label = walletType === 'cash'
        ? t('CASH_WALLET_NAME', 'Cash wallet')
        : walletType === 'credit_point' ? t('POINTS_WALLET', 'Points Wallet') : undefined
    } else if (event?.paymethod) {
      label = t(event.paymethod.gateway?.toUpperCase(), event.paymethod.name)
    } else if (event?.data?.gateway) {
      label = t(event.data.gateway.toUpperCase(), getGatewayHumanLabel(event.data.gateway))
    } else if (event?.data?.wallet_currency === 'cash') {
      label = t('CASH_WALLET_NAME', 'Cash wallet')
    } else if (event?.data?.wallet_currency === 'credit_point') {
      label = t('POINTS_WALLET', 'Points Wallet')
    }
    const group = groups.find(item => item.label === label)
    if (group) group.amount += event?.amount || 0
    else groups.push({ label, amount: event?.amount || 0 })
  })
  return groups
}
