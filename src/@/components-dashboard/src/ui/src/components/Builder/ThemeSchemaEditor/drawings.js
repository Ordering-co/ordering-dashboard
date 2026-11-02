import React from 'react'

// The pictures an option names in the schema (`options[].drawing`, "Name:variant"
// or "NAME.variant"). An unknown name draws nothing: the option still reads.

const svg = (children, { width = 20, height = 20, viewBox = '0 0 24 24' } = {}) => (
  <svg width={width} height={height} viewBox={viewBox} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>{children}</svg>
)

const EASING_CURVES = {
  linear: 'M2 28 L42 2',
  ease: 'M2 28 C12 26 14 4 42 2',
  ease_in: 'M2 28 C22 28 34 14 42 2',
  ease_out: 'M2 28 C10 14 22 2 42 2',
  ease_in_out: 'M2 28 C18 28 26 2 42 2'
}

const SHADOW_DIRECTIONS = {
  down: <path d='M12 5v14M6 13l6 6 6-6' />,
  down_right: <path d='M7 7l10 10M9 17h8V9' />,
  down_left: <path d='M17 7L7 17M15 17H7V9' />,
  around: <><circle cx='12' cy='12' r='4' /><circle cx='12' cy='12' r='9' /></>
}

const LINE_LENGTHS = { full: 48, medium: 24, small: 12 }

const NESTING = {
  line: { width: 36, marginLeft: 6, borderLeft: '2px solid currentColor' },
  indent: { width: 30, marginLeft: 12 },
  none: { width: 42 }
}

const LayoutMode = ({ variant }) => (
  <span aria-hidden='true' style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 120, color: '#5E6B7D' }}>
    {variant === 'appointments' && (
      <span style={{ display: 'flex', gap: 4 }}>
        {[28, 20, 24].map((width, index) => <span key={index} style={{ width, height: 8, borderRadius: 4, border: '1px solid currentColor', opacity: 0.5 }} />)}
      </span>
    )}
    <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
      {[0, 1, 2].map(item => (
        <span key={item} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {variant === 'appointments'
            ? <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#FFE2D1' }} />
            : <span style={{ alignSelf: 'stretch', height: 22, borderRadius: 3, background: '#FFE2D1' }} />}
          <span style={{ alignSelf: 'stretch', height: 4, borderRadius: 2, background: 'currentColor', opacity: 0.35 }} />
        </span>
      ))}
    </span>
  </span>
)

const TabsSample = ({ variant }) => (
  <span aria-hidden='true' style={{ display: 'inline-flex', gap: variant === 'pill' ? 2 : 12, padding: variant === 'pill' ? 3 : 0, borderRadius: 8, background: variant === 'pill' ? '#F1F3F5' : 'transparent', fontSize: 13 }}>
    {['A', 'B'].map((name, index) => (
      <span key={name} style={{ position: 'relative', padding: '4px 12px', borderRadius: 6, background: variant === 'pill' && index === 0 ? '#FFFFFF' : 'transparent', fontWeight: variant === 'plain' && index === 0 ? 600 : 400, color: index === 0 ? '#2C7BE5' : '#5E6B7D' }}>
        {name}
        {variant === 'underline' && index === 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'currentColor' }} />}
      </span>
    ))}
  </span>
)

const DRAWINGS = {
  EASING_CURVES: (variant) => (
    <svg width='44' height='30' viewBox='0 0 44 30' aria-hidden='true'><path d={EASING_CURVES[variant] || EASING_CURVES.linear} fill='none' stroke='currentColor' strokeWidth='2' /></svg>
  ),
  SHADOW_DIRECTION_ICONS: (variant) => SHADOW_DIRECTIONS[variant] ? svg(SHADOW_DIRECTIONS[variant]) : null,
  LineLength: (variant) => <i aria-hidden='true' style={{ display: 'block', height: 2, background: 'currentColor', width: LINE_LENGTHS[variant] || 24 }} />,
  ItemStyle: (variant) => <i aria-hidden='true' style={{ display: 'block', height: 8, background: 'currentColor', opacity: 0.4, ...(variant === 'inset' ? { width: 36, borderRadius: 3 } : { width: 56 }) }} />,
  NESTING_DRAWINGS: (variant) => <i aria-hidden='true' style={{ display: 'block', height: 18, background: 'repeating-linear-gradient(currentColor 0 2px, transparent 2px 8px)', backgroundClip: 'content-box', paddingLeft: variant === 'line' ? 6 : 0, opacity: 0.6, ...(NESTING[variant] || {}) }} />,
  LevelOption: () => <span aria-hidden='true' style={{ display: 'block', width: 22, height: 22, borderTop: '2px solid currentColor', borderLeft: '2px solid currentColor', borderTopLeftRadius: 8 }} />,
  LayoutModeDrawing: (variant) => <LayoutMode variant={variant} />,
  TabsSample: (variant) => <TabsSample variant={variant} />
}

/** The drawing an option names, or null. */
export const Drawing = ({ name }) => {
  if (!name) return null
  const [, base, variant] = /^([A-Za-z_]+)[:.]?(.*)$/.exec(name) || []
  const draw = DRAWINGS[base]
  return draw ? draw(variant) : null
}
