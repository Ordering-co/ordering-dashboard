import React from 'react'

import { cx } from './classNames'
import './product.css'
import './feedback.css'

const TITLE_HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const SIZES = ['page']

/**
 * Empty, no-results and error states (C10). A 24px Lucide icon, a title that
 * says what is true, one line on why or what to do, and at most one action.
 * No illustrations. `tone="error"` is announced (role="alert") and keeps the
 * content's place instead of a passing toast.
 *
 * The title is a <p> unless `titleAs` is a heading tag (`'h1'` to `'h6'`; SC-5): a page whose only content is an
 * EmptyState has no heading otherwise. The look is the same; anything else falls back to <p>.
 * `size='page'` (SC-6, of ) is for a state that is the whole page (the 404): its title takes the page title's
 * size instead of the body's. By default, and for any other value, the size is the body's as always.
 */
export const EmptyState = ({ icon: Icon, title, titleAs, size, description, action, tone = 'empty', className, ...props }) => {
  const Title = TITLE_HEADINGS.includes(titleAs) ? titleAs : 'p'
  return (
    <div
      className={cx('odc-state', className)}
      data-tone={tone}
      data-size={SIZES.includes(size) ? size : undefined}
      role={tone === 'error' ? 'alert' : undefined}
      {...props}
    >
      <div className='odc-state-inner'>
        {Icon && <Icon className='odc-icon odc-state-icon' />}
        <Title className='odc-state-title'>{title}</Title>
        {description && <p className='odc-state-text'>{description}</p>}
        {action && <div className='odc-state-action'>{action}</div>}
      </div>
    </div>
  )
}

/**
 * Skeleton in the shape of the content it replaces (C10, C20). `size` is a token or
 * percentage, never a literal. By default it is a text line (`--od-x-skeleton-line`
 * high); `block` sets another height and `shape` (`box`, `round`) turns it into a
 * checkbox, an avatar or a dot. Decorative: the busy region announces itself
 * (aria-busy and a hidden label) instead. The shimmer is `--od-x-shimmer` and stops
 * under `prefers-reduced-motion` (feedback.css).
 */
export const Skeleton = ({ size = '100%', block, shape = 'line', align = 'start', className }) => (
  <span
    className={cx('odc-skeleton', className)}
    data-align={align}
    data-shape={shape}
    style={block ? { inlineSize: size, blockSize: block } : { inlineSize: size }}
    aria-hidden='true'
  />
)
