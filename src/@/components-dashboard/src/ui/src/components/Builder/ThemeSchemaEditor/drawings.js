import React from 'react'

import './theme-controls.css'

// The pictures an option names in the schema (`options[].drawing`, "Name:variant"
// or "NAME.variant"). An unknown name draws nothing: the option still reads.
// redesign B3b: the same pieces, painted by classes of theme-controls.css (odc-tc-drawing-*) in tokens; a variant
// is a `data-variant` the CSS reads instead of a literal size or colour in an inline style.

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

const LINE_LENGTHS = ['full', 'medium', 'small']
const NESTING = ['line', 'indent', 'none']

const LayoutMode = ({ variant }) => (
  <span aria-hidden='true' className='odc-tc-drawing-layout'>
    {variant === 'appointments' && (
      <span className='odc-tc-drawing-layout-chips'>
        {[0, 1, 2].map(index => <span key={index} className='odc-tc-drawing-layout-chip' />)}
      </span>
    )}
    <span className='odc-tc-drawing-layout-grid'>
      {[0, 1, 2].map(item => (
        <span key={item} className='odc-tc-drawing-layout-item'>
          <span className='odc-tc-drawing-layout-picture' data-variant={variant === 'appointments' ? 'round' : undefined} />
          <span className='odc-tc-drawing-layout-line' />
        </span>
      ))}
    </span>
  </span>
)

const TabsSample = ({ variant }) => (
  <span aria-hidden='true' className='odc-tc-drawing-tabs' data-variant={variant}>
    {['A', 'B'].map((name, index) => (
      <span key={name} className='odc-tc-drawing-tab' data-active={index === 0 ? '' : undefined}>
        {name}
        {variant === 'underline' && index === 0 && <span className='odc-tc-drawing-tab-line' />}
      </span>
    ))}
  </span>
)

const DRAWINGS = {
  EASING_CURVES: (variant) => (
    <svg width='44' height='30' viewBox='0 0 44 30' aria-hidden='true'><path d={EASING_CURVES[variant] || EASING_CURVES.linear} fill='none' stroke='currentColor' strokeWidth='2' /></svg>
  ),
  SHADOW_DIRECTION_ICONS: (variant) => SHADOW_DIRECTIONS[variant] ? svg(SHADOW_DIRECTIONS[variant]) : null,
  LineLength: (variant) => <i aria-hidden='true' className='odc-tc-drawing-line' data-variant={LINE_LENGTHS.includes(variant) ? variant : 'medium'} />,
  ItemStyle: (variant) => <i aria-hidden='true' className='odc-tc-drawing-item' data-variant={variant === 'inset' ? 'inset' : undefined} />,
  NESTING_DRAWINGS: (variant) => <i aria-hidden='true' className='odc-tc-drawing-nesting' data-variant={NESTING.includes(variant) ? variant : undefined} />,
  LevelOption: () => <span aria-hidden='true' className='odc-tc-drawing-level' />,
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
