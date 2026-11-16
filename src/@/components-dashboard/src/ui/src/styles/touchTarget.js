import { css } from 'styled-components'
import { COARSE } from '../../../utils/breakpoints' // redesign tramo A r2 (W0-PA1-02)

const MIN = props => props.theme?.ordering?.component?.density?.touchTargetMinimum ?? '44px'

// A control that was converted to a real `<button>` must reach the system's 44px touch
// minimum, but `min-height` / `min-width` would grow the visible box and move whatever
// sits next to it. So the growth lives in a pseudo-element instead: the visible box keeps
// its size and position, and the hit area grows to 44px, centred on it. Clicks that land
// on the `::after` reach the button, because the pseudo-element belongs to it.
//
// `position: relative` makes the button the containing block for the pseudo-element. The
// caller must not already position the button or use its own `::after`.
// redesign tramo A r2 (W0-PA1-02): back to the trigger it had before W0-3d, a coarse pointer only. W0-3d widened it to
// `(pointer: coarse), (max-width: 767px)`, but its measurement (measure.mjs, 30 screens) never visited the 11 files that
// inherit this mixin (13 uses), so "0 boxes change" proved nothing about them. The plan says a box that may change stays as
// it was and is noted (row W0-3d). Product keeps its own phone-width trigger in its stylesheets.
export const coarseHitArea = css`
  @media ${COARSE} {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: max(100%, ${MIN});
      height: max(100%, ${MIN});
      transform: translate(-50%, -50%);
    }
  }
`

// The brand focus ring, for a button that has none of its own: without it the browser
// paints its default `auto` outline in its own blue.
export const brandFocusRing = css`
  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme?.colors?.primary};
    outline-offset: 2px;
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '4px'};
  }
`

// Same ring, for a control that already declares its own `border-radius`: the outline
// follows that radius in Chromium, so the shape does not jump on focus.
export const brandFocusOutline = css`
  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme?.colors?.primary};
    outline-offset: 2px;
  }
`
