import { resolveButtonTheme } from '../../../styles/Buttons/theme'
import { resolveSelectTheme } from '../../../styles/selectTheme'

export const resolveFeedbackTheme = theme => {
  const buttons = resolveButtonTheme(theme || {})
  const select = resolveSelectTheme(theme || {})
  const state = theme?.ordering?.semantic?.state

  return {
    ...buttons,
    action: buttons.action ?? '#266DF0',
    actionContent: buttons.actionContent ?? '#1F5FD1',
    actionSoft: buttons.actionSoft ?? '#EDF3FF',
    focus: buttons.focus ?? '#266DF0',
    focusWidth: select.focusWidth,
    focusOffset: select.focusOffset,
    radiusPanel: theme?.ordering?.radius?.panel ?? '10px',
    shadow: select.shadow,
    shadowRaised: theme?.ordering?.shadow?.['2'] ?? select.shadow,
    dangerSignal: state?.danger?.signal ?? theme?.colors?.danger ?? '#EB3B3B',
    dangerFunctional: state?.danger?.functional ?? theme?.colors?.danger ?? '#C92929',
    dangerSoft: state?.danger?.soft ?? theme?.colors?.lightDanger ?? '#FDEBEC'
  }
}

export const cssVariables = (prefix, values) => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-${prefix}-${key}`, String(value)])
)
