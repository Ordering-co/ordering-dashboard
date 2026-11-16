import { CODES } from '../../../constants/code-numbers'

export const findExitingCode = (countryCode) => {
  const code = CODES.find(code => code.countryCode === (countryCode || '').toUpperCase())
  return code?.countryCode
}
