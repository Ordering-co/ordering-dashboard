import { safeDarken } from './Buttons/theme'
import { resolveFieldTheme } from './fieldsTheme'
import { getOrderingTypography } from '~/brand/adapter'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

export const resolveSelectTheme = theme => {
  const fields = resolveFieldTheme(theme)
  const semantic = theme?.ordering?.semantic
  const customAction = hasOwn(theme?.ordering, 'actionOverride')
  const typography = getOrderingTypography(theme)

  return {
    ...fields,
    actionHover: customAction ? safeDarken(0.04, fields.action) : semantic?.action?.hover ?? safeDarken(0.04, fields.action),
    actionSoft: semantic?.action?.soft ?? theme?.colors?.lightPrimary ?? '#E9F2FE',
    radiusComponent: theme?.ordering?.radius?.component ?? '7.6px',
    radiusRound: theme?.ordering?.radius?.round ?? '999px',
    shadow: theme?.ordering?.shadow?.one ?? theme?.ordering?.shadow?.['1'] ?? 'none',
    fontUi: typography?.roles.control.size ?? theme?.ordering?.font?.size?.productUi ?? fields.fontSize,
    iconSize: theme?.ordering?.component?.density?.iconSize ?? '16px'
  }
}
