import React from 'react'
import { useLanguage } from '../../../../index'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { EmptyState } from '../Shared/Product'
import { WifiOff } from '../Shared/Icon'
import './not-network-connectivity.css'

// redesign (D6): the offline page on Product. Online it paints nothing (App.js already unmounts the routes without a
// network); offline it is one empty state with a heading and a line on what to do, no illustration.

export const NotNetworkConnectivity = () => {
  const [, t] = useLanguage()
  const onlineStatus = useOnlineStatus()

  if (onlineStatus) return null

  return (
    <div className='odc-root odc-offline' role='status' data-slot='not-network-connectivity'>
      <EmptyState
        icon={WifiOff}
        titleAs='h1'
        title={t('OFFLINE_TITLE', "You're offline")}
        description={t('OFFLINE_DESCRIPTION', 'Check your connection. This page comes back when you reconnect.')}
      />
    </div>
  )
}
