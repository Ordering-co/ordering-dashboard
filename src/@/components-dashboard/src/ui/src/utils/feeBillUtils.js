export const getFeeAmount = (fee) =>
  fee?.summary?.amount ?? (fee?.summary?.fixed + (fee?.summary?.percentage_after_discount ?? fee?.summary?.percentage)) ?? 0

export const getFeeKey = (fee, index) =>
  `${fee?.type ?? 'fee'}-${fee?.id ?? fee?.fee_id ?? 'null'}-${fee?.name ?? index}-${index}`

export const shouldShowFeeRateDetails = (fee) => fee?.fixed > 0 || fee?.percentage > 0

export const shouldShowFeeItem = (fee) => parseFloat(getFeeAmount(fee)) !== 0
