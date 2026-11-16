import React from 'react'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'
import { DirectionProvider } from '@base-ui/react/direction-provider'

import { cx } from './classNames'
import { useProductDir } from './useProductDir'
import './product.css'
import './segmented.css'

/** C13: more than four options is a different control (a select, a menu). */
export const SEGMENTED_MAX_OPTIONS = 4

const assertProps = (label, options) => {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('SegmentedControl needs a label')
  if (options.length > SEGMENTED_MAX_OPTIONS) {
    throw new Error(`SegmentedControl takes at most ${SEGMENTED_MAX_OPTIONS} options, got ${options.length}`)
  }
}

/**
 * Segmented control (C13) on Base UI ToggleGroup + Toggle. One option is always
 * chosen: pressing the chosen option again does nothing. A group with a roving
 * tabindex whose stop is the chosen option (the first when none is): arrows
 * (inverted in RTL), Home and End move focus; Space and Enter choose.
 *
 * `label` names the group and is required, `options` is `[{ value, label }]`
 * with at most 4 (an Error otherwise). The wrapper has no text of its own.
 *
 * C13 rule: when the options do not fit in one row without breaking words, the
 * control becomes a native `<select>` with the same label and options. There is
 * never a second row. Fit is measured with a ResizeObserver: a hidden, inert
 * copy of the track gives the natural width, the container gives the available
 * one. Give the control a container with a definite width (a block parent).
 */
export const SegmentedControl = ({ label, value, onValueChange, options, className, ...props }) => {
  assertProps(label, options)
  const direction = useProductDir()
  const containerRef = React.useRef(null)
  const measureRef = React.useRef(null)
  const [fits, setFits] = React.useState(true)
  // R1-08: Base UI's composite parks the tab stop on the first option; a radiogroup parks it on the chosen one. While
  // the focus is inside, the stop follows it (Shift+Tab from the 4th option must leave the group, not bounce to the chosen one).
  const [focusedValue, setFocusedValue] = React.useState(null)
  const has = candidate => options.some(option => option.value === candidate)
  const stopValue = has(focusedValue) ? focusedValue : has(value) ? value : options[0]?.value

  const signature = options.map(option => option.label).join('\u0000')
  React.useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return undefined
    const update = () => {
      const available = container.clientWidth
      // Nothing laid out (hidden tab, no layout engine): keep the control.
      setFits(available === 0 || measure.offsetWidth <= available)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(measure)
    return () => observer.disconnect()
  }, [signature])

  return (
    <div
      ref={containerRef}
      className={cx('odc-root', 'odc-seg', className)}
      data-mode={fits ? 'segmented' : 'select'}
      {...props}
    >
      {fits
        ? (
          <DirectionProvider direction={direction}>
            <ToggleGroup
              aria-label={label}
              value={[value]}
              onValueChange={next => {
                // A group cannot be left empty: pressing the chosen option gives [].
                if (next.length > 0) onValueChange?.(next[0])
              }}
              className='odc-seg-track'
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedValue(null)
              }}
            >
              {options.map(option => (
                <Toggle
                  key={option.value}
                  value={option.value}
                  className='odc-seg-btn'
                  tabIndex={option.value === stopValue ? 0 : -1}
                  onFocus={() => setFocusedValue(option.value)}
                >
                  {option.label}
                </Toggle>
              ))}
            </ToggleGroup>
          </DirectionProvider>
          )
        : (
          <select
            aria-label={label}
            className='odc-seg-select'
            value={value}
            onChange={event => onValueChange?.(event.target.value)}
          >
            {options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          )}
      {/* Natural width of the track, drawn with CSS content so the labels are not repeated for assistive tech or text queries.
          redesign stores 5.18: inside a box of no size that clips, so its width never reaches the scroll area of a
          narrow parent (it used to widen a 390 panel in long locales). */}
      <div className='odc-seg-measure-box'>
        <div ref={measureRef} className='odc-seg-track odc-seg-measure' aria-hidden='true'>
          {options.map(option => (
            <span key={option.value} className='odc-seg-btn' data-label={option.label} />
          ))}
        </div>
      </div>
    </div>
  )
}
