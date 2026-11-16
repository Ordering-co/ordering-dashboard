import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { ConfirmDialog, Switch } from '../../Shared/Product'
import { GuideLink } from '../BuilderShared'
import './default-keystore.css'

export const KEYSTORE_FIELDS = ['key_alias', 'key_password', 'store_password', 'store_file']

const KEYSTORE_GUIDE_URL = 'https://developer.android.com/studio/publish/app-signing#generate-key'

export const DefaultKeystoreSwitch = ({ checked, hasOwnKeystore, usesDefaultKeystore, onChange, className, hintClassName }) => {
  const [, t] = useLanguage()
  const [confirm, setConfirm] = useState({ open: false, next: true })

  const handleChange = (next) => {
    if ((next && hasOwnKeystore) || (!next && usesDefaultKeystore)) {
      setConfirm({ open: true, next })
      return
    }
    onChange(next)
  }

  const handleConfirm = () => {
    setConfirm(current => ({ ...current, open: false }))
    onChange(confirm.next)
  }

  const handleCancel = () => setConfirm(current => ({ ...current, open: false }))

  return (
    <div className={className}>
      <Switch checked={checked} onCheckedChange={handleChange}>
        {t('BUILDER_DEFAULT_KEYSTORE', 'Use the default keystore')}
      </Switch>
      {checked && (
        <span className={hintClassName}>
          {t('BUILDER_DEFAULT_KEYSTORE_HELP', 'The app is signed with the default keystore. Turn this off to use your own.')}
        </span>
      )}
      <ConfirmDialog
        open={confirm.open}
        className='odc-keystore-confirm'
        title={confirm.next
          ? t('BUILDER_DEFAULT_KEYSTORE_CONFIRM_TITLE', 'Replace your keystore with the default one?')
          : t('BUILDER_OWN_KEYSTORE_CONFIRM_TITLE', 'Use your own keystore instead?')}
        confirmLabel={confirm.next
          ? t('BUILDER_DEFAULT_KEYSTORE', 'Use the default keystore')
          : t('BUILDER_OWN_KEYSTORE', 'Use your own keystore')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      >
        {confirm.next
          ? <p>{t('BUILDER_DEFAULT_KEYSTORE_CONFIRM_HELP', 'If this app is already published with your keystore, the store will reject updates signed with a different one. Your keystore and its passwords are removed when you save.')}</p>
          : (
            <>
              <p>{t('BUILDER_OWN_KEYSTORE_CONFIRM_HELP', 'If this app is already published with the default keystore, the store will reject updates signed with a different one. The default keystore is removed from this app when you save.')}</p>
              <GuideLink href={KEYSTORE_GUIDE_URL}>{t('BUILDER_KEYSTORE_GUIDE', 'How to create a keystore (Google guide)')}</GuideLink>
            </>
            )}
      </ConfirmDialog>
    </div>
  )
}
