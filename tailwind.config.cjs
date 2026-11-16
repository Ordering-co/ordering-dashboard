const { tokens } = require('./src/brand/ordering.tokens.generated.js')

module.exports = {
  content: ['./src/@/components-dashboard/src/ui/src/components/Shared/UI/**/*.{js,jsx}'],
  prefix: 'od-',
  corePlugins: { preflight: false },
  theme: {
    colors: Object.fromEntries(['surface', 'subtle', 'text', 'muted', 'border', 'border-strong', 'action', 'action-hover', 'action-foreground', 'action-content', 'action-soft', 'focus'].map(role => [role, `var(--od-ui-${role})`])),
    spacing: { ...tokens.space, 0: '0px' },
    borderRadius: tokens.radius,
    fontFamily: { sans: ['var(--od-ui-font)'] },
    fontSize: { ui: ['var(--od-ui-font-size)', { lineHeight: '1.5' }] },
    fontWeight: { medium: tokens.font.weight.medium },
    extend: { minHeight: { control: tokens.component.density.compactControlHeight, touch: tokens.component.density.touchTargetMinimum } }
  }
}
