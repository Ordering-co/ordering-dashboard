import React, { useId, useMemo, useState } from 'react'
import { useTheme } from 'styled-components'
import {
  UserDetails as UserDetailsController,
  useLanguage,
  useSession
} from '../../../../../index'
import { Avatar, Button, Dialog, IconButton, InlineNotice, PageHeader, useProductDir } from '../../Shared/Product'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { getDashboardRoleFlags } from '../../../../../utils/dashboardNavigation'
import { Sessions } from '../Sessions'
import { ProfileEditForm } from './ProfileEditForm'
import { levelLabel } from '../profileView'
import './profile-page.css'

// redesign (D1 A): /profile on the Product wrappers. One column of cards: account, Google Calendar (level 8, D6) and
// sessions. Nothing here is a capability of main taken away: photo, name, email, phone, Google link and the sessions stay.
// P12 (D-15): «Edit profile» opens ProfileEditForm on the session user, for level 2 only: api-core
// lets it edit itself through POST /users/{id}. Levels 5 and 8 wait for a check with a real account.
const SELF_EDIT_LEVELS = [2]

export const ProfilePageUI = (props) => {
  const { handleGoogleAccountLink } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [{ user }] = useSession()
  const theme = useTheme()
  const dir = useProductDir()
  const accountId = useId()
  const googleId = useId()
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const fullName = [user?.name, user?.lastname].map(part => String(part ?? '').trim()).filter(Boolean).join(' ')
  const role = levelLabel(t, user?.level)
  const isReadOnly = getDashboardRoleFlags(user).isReadOnly
  const canEdit = SELF_EDIT_LEVELS.includes(user?.level) && !isReadOnly

  // B1-2: a blocked window answers { ok: false, reason: 'popup-blocked' }; the notice goes away on the next press
  const handleGoogleLink = async () => {
    setPopupBlocked(false)
    const result = await handleGoogleAccountLink?.()
    if (result?.ok === false && result?.reason === 'popup-blocked') setPopupBlocked(true)
  }

  return (
    <div className='odc-root odc-profile' data-slot='profile-page' dir={dir}>
      <PageHeader
        title={t('PROFILE', 'Profile')}
        description={t('PROFILE_PAGE_DESCRIPTION', 'Your account and where it is signed in')}
        leading={isCollapse && (
          <IconButton
            icon={MenuIcon}
            label={t('OPEN_MENU', 'Open menu')}
            onClick={() => handleMenuCollapse(false)}
          />
        )}
      />

      <section className='odc-profile-card odc-profile-account' aria-labelledby={accountId}>
        <h2 id={accountId} className='odc-sr-only'>{t('ACCOUNT', 'Account')}</h2>
        <Avatar className='odc-profile-avatar' name={fullName} src={user?.photo} kind='person' size='lg' />
        <div className='odc-profile-identity'>
          <div className='odc-profile-name-row'>
            <p className='odc-profile-name' dir='auto'>{fullName}</p>
            {role && <span className='odc-profile-tag'>{role}</span>}
            {isReadOnly && <span className='odc-profile-tag'>{t('PROFILE_READ_ONLY', 'Read only')}</span>}
          </div>
          <p className='odc-profile-line'>{user?.email}</p>
          {user?.cellphone && <p className='odc-profile-line'><bdi dir='ltr'>{user.cellphone}</bdi></p>}
        </div>
        {canEdit && (
          <Button variant='secondary' className='odc-profile-edit' onClick={() => setEditOpen(true)}>
            {t('EDIT_PROFILE', 'Edit profile')}
          </Button>
        )}
      </section>

      {canEdit && (
        <Dialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title={t('EDIT_PROFILE', 'Edit profile')}
          closeLabel={t('CLOSE', 'Close')}
        >
          <ProfileEditForm user={user} />
        </Dialog>
      )}

      {user?.level === 8 && (
        <section className='odc-profile-card' aria-labelledby={googleId}>
          <h2 id={googleId} className='odc-profile-card-title'>{t('GOOGLE_CALENDAR', 'Google Calendar')}</h2>
          <p className='odc-profile-google-text'>
            {t('CONNTECT_PROFESSIONAL_ACCOUNT_INFO', 'Connect your Professional account with your Google account to synchronize the appointments with the Google calendar Application. Use the Google account button to start with the login process, do not forget to notify the admin to Complete the synchronization.')}
          </p>
          <div className='odc-profile-google-action'>
            <Button onClick={handleGoogleLink}>
              <img className='odc-profile-google-icon' src={theme?.images?.general?.googleCalendarIcon} alt='' />
              {t('SYNC_WITH_GOOGLE_CALENDAR', 'Sync with Google calendar')}
            </Button>
            {popupBlocked && (
              <InlineNotice tone='warning'>
                {t('GOOGLE_POPUP_BLOCKED', 'Your browser blocked the Google window. Allow pop-ups for this site and try again.')}
              </InlineNotice>
            )}
          </div>
        </section>
      )}

      <Sessions />
    </div>
  )
}

export const ProfilePage = (props) => {
  const [{ user }] = useSession()
  // A copy: the controller assigns over `props.user` (UserDetails `Object.assign`) and must not touch the session's user.
  // With a `user` it does not ask GET /users/{id} (PF-09).
  const profileUser = useMemo(() => ({ ...user }), [user])
  const profileProps = {
    ...props,
    userId: user?.id,
    user: profileUser,
    UIComponent: ProfilePageUI
  }
  return <UserDetailsController {...profileProps} />
}
