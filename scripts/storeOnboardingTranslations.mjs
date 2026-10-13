import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleId = 'virtual:store-onboarding-translations'
const resolvedId = `\0${moduleId}`
const catalog = new URL('../i18n/translations.json', import.meta.url)
const project = fileURLToPath(new URL('../', import.meta.url))
const uiFolder = resolve(project, 'src/@/components-dashboard/src/ui/src/components/Stores/StoreOnboarding')
const sources = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(folder, entry.name)
  return entry.isDirectory() ? sources(path) : /\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
})

export const storeOnboardingTranslationsPlugin = () => ({
  name: 'store-onboarding-translations',
  resolveId: source => source === moduleId ? resolvedId : undefined,
  load (id) {
    if (id !== resolvedId) return
    this.addWatchFile(fileURLToPath(catalog))
    this.addWatchFile(uiFolder)
    const values = JSON.parse(readFileSync(catalog, 'utf8'))
    const keys = new Set(Object.keys(values).filter(key => key.startsWith('STORE_ONBOARDING_')))
    const files = [...sources(uiFolder), resolve(project, 'src/@/components-dashboard/src/components/StoreOnboarding/index.js'), resolve(project, 'src/components/StoreOnboardingGate/index.js')]
    for (const file of files) {
      this.addWatchFile(file)
      for (const match of readFileSync(file, 'utf8').matchAll(/['"]([A-Z][A-Z0-9_]+)['"]/g)) keys.add(match[1])
    }
    return `export default ${JSON.stringify(Object.fromEntries(Object.entries(values).filter(([key]) => keys.has(key))))}`
  }
})
