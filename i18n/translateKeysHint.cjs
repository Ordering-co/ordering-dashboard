'use strict'

/**
 * Shared developer-facing hint when locales are incomplete.
 * Printed by verify / missing / husky so people who never heard of the skill
 * know exactly what to run next (Cursor or Claude Code).
 */

function printTranslateKeysHint (stream = console.error) {
  stream('')
  stream('────────────────────────────────────────────────────────────')
  stream('INFO: Translation locales are incomplete.')
  stream('')
  stream('  Next step (Cursor or Claude Code):')
  stream('    /translate-keys')
  stream('')
  stream('  Or ask the agent:')
  stream('    "Run translate-keys until i18n:verify passes"')
  stream('')
  stream('  Skill files:')
  stream('    .cursor/skills/translate-keys/SKILL.md   (Cursor)')
  stream('    .claude/skills/translate-keys/SKILL.md   (Claude Code)')
  stream('')
  stream('  Check progress:')
  stream('    pnpm i18n:missing --summary')
  stream('    pnpm i18n:verify')
  stream('────────────────────────────────────────────────────────────')
  stream('')
}

module.exports = { printTranslateKeysHint }
