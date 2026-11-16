import React, { useLayoutEffect, useRef } from 'react'
import { useLanguage, useSession } from '../../../../index'
import { Button, InlineNotice } from '../Shared/Product'
import { TriangleAlert } from '../Shared/Icon'
import './banners.css'

// redesign (R2): the past-due notice on Product. Same props, same copy and same click as before (it opens the billing
// payment flow with `from: 'past_due'`); the markup is an InlineNotice (danger, role alert) with the pay action beside the text.

// The sticky container App.js always mounts; it hides itself when it has no notice inside (banners.css).
// the stack stays at the top of the window while the page scrolls, so the menu (sticky, same top) has to start under it.
// The stack says how tall it is in `--odc-shell-banner-block` on the root (read by Shared/SideBar/sidebar.css, which has a 0 fallback)
// and takes the variable back when it leaves.
export const BANNER_BLOCK_VAR = '--odc-shell-banner-block'

export const BannerStack = ({ children, ...props }) => {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const root = document.documentElement
    const publish = () => root.style.setProperty(BANNER_BLOCK_VAR, `${Math.ceil(node.getBoundingClientRect().height)}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(node)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(BANNER_BLOCK_VAR)
    }
  }, [])
  return <div ref={ref} className='odc-root odc-banner-stack' {...props}>{children}</div>
}

export const Banners = (props) => {
  props = { ...defaultProps, ...props }
  const {
    setShowBillingPayment
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const handleClick = () => {
    setShowBillingPayment((prevState) => ({ ...prevState, open: true, from: 'past_due' }))
  }

  return (
    <InlineNotice
      tone='danger'
      icon={TriangleAlert}
      role='alert'
      action={(
        <Button variant='primary' size='md' onClick={handleClick}>
          {t('PAY_NOW', 'Pay now')}
        </Button>
      )}
    >
      <strong className='odc-shell-notice-title'>
        {t('PAST_DUE_TITLE_BANNER', 'Hey :user:, we have a problem, your account is past due.').replace(':user:', user?.name)}
      </strong>
      <span className='odc-shell-notice-body'>
        {t('PAST_DUE_SUBTITLE_BANNER', 'There appears to be an issue with your payment. Kindly update the card on file and complete your payment.')}
      </span>
    </InlineNotice>
  )
}

const defaultProps = {
  type: 'past_due'
}
