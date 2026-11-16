// `tailwindcss` is Tailwind 4 (main); the T1 pilot stays on Tailwind 3 under the `tailwindcss-v3` alias.
const tailwindcss = require('tailwindcss-v3')
const autoprefixer = require('autoprefixer')

// Two Tailwind builds coexist (docs/BRAND.md › Boundary). This is Tailwind 3 for the T1 pilot (`src/brand/pilot.css`,
// prefix `od-`). The Mia buttons' sheet (`OrderingUi/tailwind.css`, from main) is compiled by Tailwind 4 through
// `@tailwindcss/vite` (vite.config.js); its output keeps native `@layer utilities`, which Tailwind 3 rejects without a
// matching `@tailwind utilities`, so Tailwind 3 leaves that one sheet alone.
const TAILWIND_V4_SHEET = /[\\/]styles[\\/]OrderingUi[\\/]tailwind\.css(?:\?.*)?$/
const isTailwindV4Sheet = root => TAILWIND_V4_SHEET.test(root?.source?.input?.file || '')
const pilot = tailwindcss({ config: './tailwind.config.cjs' })

module.exports = {
  plugins: [
    {
      postcssPlugin: pilot.postcssPlugin,
      plugins: pilot.plugins.map(plugin => (root, result) => (isTailwindV4Sheet(root) ? undefined : plugin(root, result)))
    },
    autoprefixer()
  ]
}
