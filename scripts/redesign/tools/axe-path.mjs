// redesign messages R2.5: where axe-core's browser bundle is on THIS machine. pnpm does not hoist axe-core to the top of
// node_modules; it is the dependency of @axe-core/playwright, so it is resolved from there (no absolute path of anyone's folder).
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const resolveAxeSource = () => {
  const fromPlaywright = createRequire(require.resolve('@axe-core/playwright'))
  return fromPlaywright.resolve('axe-core/axe.min.js')
}
