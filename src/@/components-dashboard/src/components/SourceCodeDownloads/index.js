import React, { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { PUBLIC_SOURCE_PRODUCTS, PUBLIC_SOURCE_TOOLS } from './public-source-repositories'

const hasText = value => typeof value === 'string' && value.trim().length > 0

export const getSourceCodeSessionStatus = session => {
  if (session.loading) return 'loading'
  if (!session.auth || !hasText(session.token) || !session.user?.id) return 'sessionExpired'
  if (session.user.level !== 0 || session.user.enabled === false) return 'forbidden'
  return 'ready'
}

export const SourceCodeDownloads = ({ UIComponent }) => {
  const [session, sessionActions] = useSession()
  const history = useHistory()
  const [signInError, setSignInError] = useState(false)
  const catalogStatus = getSourceCodeSessionStatus(session)

  const signInAgain = async () => {
    setSignInError(false)
    try {
      await sessionActions.logout()
      history.replace({ pathname: '/login', state: { from: '/open-source-code' } })
    } catch (_) {
      setSignInError(true)
    }
  }

  // The existing route/session guard remains. Public links need no catalog,
  // package service, GitHub API, credentials or tenant-specific metadata.
  return UIComponent
    ? <UIComponent catalogStatus={catalogStatus} products={catalogStatus === 'ready' ? PUBLIC_SOURCE_PRODUCTS : []} tools={catalogStatus === 'ready' ? PUBLIC_SOURCE_TOOLS : []} signInAgain={signInAgain} signInError={signInError} />
    : null
}
