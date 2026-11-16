import React from 'react'
import { useHistory } from 'react-router-dom'
import { useLanguage, useSession } from '../../../../index'
import { useInfoShare } from '../../contexts/InfoShareContext'
import { EmptyState, IconButton } from '../Shared/Product'
import { CircleAlert, Menu as MenuIcon } from '../Shared/Icon'
import './page-not-found.css'

// redesign NF-A (decisions D1–D4): the 404 on Product. One empty state that says the page isn't available (it may not
// exist, or the account can't open it) with one action: the start page when logged in, log in when not. No illustration. The
// header row is always there, so the state does not jump when the open-menu button (sidebar collapsed) appears.

// a plain click navigates inside the dashboard, a modified or middle click stays the browser's (as Home/HomePage/Shortcuts.jsx)
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

export const PageNotFound = () => {
  const [, t] = useLanguage()
  const [{ auth }] = useSession()
  const [infoState, infoActions] = useInfoShare()
  const history = useHistory()
  const isCollapse = infoState?.isCollapse
  const handleMenuCollapse = infoActions?.handleMenuCollapse

  const to = auth ? '/' : '/login'

  return (
    <div className='odc-root odc-nf' data-slot='page-not-found'>
      <div className='odc-nf-head'>
        {auth && isCollapse && handleMenuCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
      </div>

      <EmptyState
        icon={CircleAlert}
        tone='empty'
        // SC-6: the page's one heading, at the page title's size (it was a 14px line with role=heading)
        titleAs='h1'
        size='page'
        title={t('PAGE_UNAVAILABLE_TITLE', "This page isn't available")}
        description={auth
          ? t('PAGE_UNAVAILABLE_DESCRIPTION', "It may not exist, or your account can't open it.")
          : t('PAGE_UNAVAILABLE_LOGGED_OUT_DESCRIPTION', 'Check the address, or log in to continue.')}
        action={
          <a
            className='odc-btn'
            data-variant='primary'
            data-size='md'
            href={to}
            onClick={(event) => {
              if (event.defaultPrevented || !isPlainClick(event) || !history) return
              event.preventDefault()
              history.push(to)
            }}
          >
            {auth ? t('GO_TO_START_PAGE', 'Go to your start page') : t('GO_TO_LOG_IN', 'Go to log in')}
          </a>
        }
      />
    </div>
  )
}
