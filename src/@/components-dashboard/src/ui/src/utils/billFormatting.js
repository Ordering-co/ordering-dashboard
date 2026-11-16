import { CURRENCY } from '../config/currency.js'

export const verifyDecimals = (value, parser) => {
  if (value % 1 === 0) {
    return value
  } else {
    return parser(value)
  }
}

export const getCurrenySymbol = (code) => {
  return CURRENCY?.[code]?.symbol ?? code
}
