import React from 'react'

import { cx } from './classNames'
import './product.css'
import './catalog-card.css'

// redesign F1 (N-FD2, N-SU1): the static catalog card (a mark or picture, a title, one line and a foot with links) that
// Home «More services», /connect/overview, /free-downloads and /support each wrote on their own. The piece has no text: every word it
// paints, the labels of the foot included, comes from the page that passes it.

/**
 * CatalogCard: one entry of a static catalog. Not a control by itself: what can be opened is the links or buttons of `footer`.
 *
 * `title` names the card (required: the card is a heading and its list item). `titleAs` is the heading element (`h2` by default;
 * pass `h3` under a section title). `description` is one line of phrasing content and `meta` a quieter line between title and
 * description («By Ordering · iOS · Android»); neither paints an empty box when it is missing.
 *
 * `media` is a node the card does not name or hide: an icon (`.odc-icon`, `aria-hidden`) or an `<img alt=''>`. `mediaKind='icon'`
 * (default) draws it in a small tile; `'picture'` in a tall frame that contains the image and sizes the fallback glyph.
 * `layout='stack'` (default) puts the media above the text; `'inline'` puts it beside the text.
 *
 * `footer` is a node (links, `Button`s), laid out as a wrapping row pinned to the bottom of the card; a link or button directly
 * in it that has a long label wraps inside the card instead of running out of it. `as` is the root element (`li` by default, to sit
 * in a `ul`); `className` and every other prop (data-*, aria-*, id) go to the root.
 */
export const CatalogCard = ({
  as: Root = 'li',
  title,
  titleAs: Title = 'h2',
  description,
  meta,
  media,
  mediaKind = 'icon',
  layout = 'stack',
  footer,
  className,
  ...props
}) => {
  if (title == null) throw new Error('CatalogCard needs a title: the name of the entry')
  return (
    <Root {...props} className={cx('odc-catalog-card', className)} data-layout={layout}>
      <div className='odc-catalog-card-body'>
        {media != null && <div className='odc-catalog-card-media' data-kind={mediaKind}>{media}</div>}
        <div className='odc-catalog-card-text'>
          <Title className='odc-catalog-card-title'>{title}</Title>
          {meta != null && <p className='odc-catalog-card-meta'>{meta}</p>}
          {description != null && <p className='odc-catalog-card-description'>{description}</p>}
        </div>
      </div>
      {footer != null && <div className='odc-catalog-card-foot'>{footer}</div>}
    </Root>
  )
}
