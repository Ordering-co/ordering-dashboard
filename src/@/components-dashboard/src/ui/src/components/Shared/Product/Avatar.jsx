import React, { useEffect, useState } from 'react'

import { Store, User } from '../Icon'
import { cx } from './classNames'
import './product.css'
import './avatar.css'

/** One or two initials from a name, in the name's own script. */
export const getInitials = (name = '') => {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const first = Array.from(words[0])[0] || ''
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] || '' : ''
  return (first + last).toLocaleUpperCase()
}

/**
 * Avatar (C12). A person is a circle, a business a square tile with a 1px
 * border. With a photo that loads, the photo; otherwise initials (12px, never
 * smaller); with no name, a Lucide glyph. The Ordering.co symbol is never a
 * default image. Decorative by default: the name is next to it in the row.
 */
export const Avatar = ({ name, src, kind = 'person', size = 'md', label, className }) => {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  const initials = getInitials(name)
  const Fallback = kind === 'business' ? Store : User
  const showImage = src && !failed
  return (
    <span
      className={cx('odc-avatar', className)}
      data-kind={kind}
      data-size={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      {showImage
        ? <img src={src} alt='' onError={() => setFailed(true)} />
        : initials
          ? <span className='odc-avatar-initials'>{initials}</span>
          : <Fallback className='odc-icon' />}
    </span>
  )
}
