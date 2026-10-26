const BRANCH_AUTO = 'auto'
const BRANCH_MARKETPLACE = 'marketplace'
const BRANCH_MODES = [BRANCH_AUTO, BRANCH_MARKETPLACE]

const colorText = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * The value sent for one color. An empty field clears the key.
 * Anything else is sent as typed so the API can reject a bad hex.
 * @param {string} value field value
 */
const colorPayload = (value) => colorText(value) || null

/**
 * @param {unknown} value stored or selected mode
 */
export const normalizeBranchMode = (value) => {
  const mode = String(value ?? '').trim().toLowerCase()
  return BRANCH_MODES.includes(mode) ? mode : BRANCH_AUTO
}

/**
 * Settings shown in the bot panel. A missing color is an empty field.
 * @param {Object} agent agent from `GET /ai/agents/{id}`
 */
export const readBotSettings = (agent = {}) => {
  const settings = agent?.settings ?? {}
  return {
    branchSelectionMode: normalizeBranchMode(settings.branch_selection_mode),
    primaryColor: colorText(settings.webview_primary_color),
    secondaryColor: colorText(settings.webview_secondary_color)
  }
}

/**
 * Keys that differ from what is saved. The API merges `settings` per key,
 * so a key left out stays as it is and `null` deletes that key.
 * @param {Object} saved values last read from the API
 * @param {Object} next values in the form
 */
export const settingsPatch = (saved, next) => {
  const patch = {}
  const branch = normalizeBranchMode(next?.branchSelectionMode)
  if (branch !== normalizeBranchMode(saved?.branchSelectionMode)) {
    patch.branch_selection_mode = branch
  }
  if (colorText(next?.primaryColor) !== colorText(saved?.primaryColor)) {
    patch.webview_primary_color = colorPayload(next?.primaryColor)
  }
  if (colorText(next?.secondaryColor) !== colorText(saved?.secondaryColor)) {
    patch.webview_secondary_color = colorPayload(next?.secondaryColor)
  }
  return patch
}
