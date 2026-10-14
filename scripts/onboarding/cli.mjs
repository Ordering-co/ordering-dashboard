import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { configure, doctor, restore, detect, validateManifest } from './core.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDirectory, '../..')
const manifestPath = path.join(scriptDirectory, 'product.json')
const allowedErrors = new Set(['invalid_manifest', 'invalid_config_path', 'invalid_project_path', 'invalid_configuration_structure', 'missing_api_configuration', 'invalid_api_url', 'invalid_api_version', 'invalid_language', 'invalid_project', 'public_project_unavailable', 'public_project_mismatch', 'unsafe_path', 'invalid_configuration', 'configuration_changed_during_setup', 'project_change_confirmation_required', 'configured_project_mismatch', 'invalid_backup', 'invalid_helper', 'invalid_arguments', 'franchise_selection_not_supported', 'franchise_selection_required', 'selection_change_confirmation_required', 'invalid_franchise_selection', 'franchise_unavailable', 'franchise_selection_not_enabled'])

function parse (args, command) {
  const options = {}
  const permitted = {
    detect: ['helper'],
    configure: ['project', 'api-url', 'api-version', 'language', 'confirm-project-change', 'franchise-slug'],
    doctor: [],
    restore: ['backup']
  }[command]
  if (!permitted) throw new Error('invalid_arguments')
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith('--') ? args[i].slice(2) : ''
    if (!permitted.includes(name) || Object.hasOwn(options, name)) throw new Error('invalid_arguments')
    if (name === 'confirm-project-change') options[name] = true
    else {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error('invalid_arguments')
      options[name] = value
    }
  }
  if ((command === 'configure' && !options.project) || (command === 'restore' && !options.backup)) throw new Error('invalid_arguments')
  return options
}

try {
  const [command, ...args] = process.argv.slice(2)
  const options = parse(args, command)
  let result
  if (command === 'detect') result = await detect({ helper: options.helper })
  else {
    const manifest = validateManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')))
    if (command === 'configure') result = await configure(root, manifest, {
      project: options.project, apiUrl: options['api-url'], apiVersion: options['api-version'], language: options.language,
      confirmProjectChange: options['confirm-project-change'] === true, franchiseSlug: options['franchise-slug']
    })
    else if (command === 'doctor') result = await doctor(root, manifest)
    else result = await restore(root, manifest, options.backup)
  }
  // Allowlisted public summary only. No full configuration, response or user object.
  process.stdout.write(JSON.stringify(result) + '\n')
} catch (error) {
  const code = allowedErrors.has(error.message) ? error.message : 'setup_io_or_invalid_response'
  process.stderr.write('Ordering setup failed: ' + code + '\n')
  if (code === 'invalid_arguments') process.stderr.write('Usage: node scripts/onboarding/cli.mjs detect [--helper PATH] | configure --project SELECTED_PROJECT [--api-url HTTPS_ORIGIN] [--api-version v400] [--language en] [--franchise-slug SELECTED_SLUG] [--confirm-project-change] | doctor | restore --backup FILENAME\n')
  process.exitCode = 1
}
