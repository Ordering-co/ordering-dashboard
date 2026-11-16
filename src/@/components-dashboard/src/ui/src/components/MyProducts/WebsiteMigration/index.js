import React, { useState } from 'react'
import { Redirect, useHistory } from 'react-router-dom'

import { useLanguage, WebsiteMigration as WebsiteMigrationController } from '../../../../../index'
import { Button, ConfirmDialog, Skeleton } from '../../Shared/Product'
import { CircleCheck, ExternalLink, Globe, TriangleAlert } from '../../Shared/Icon'
import { CnameRecord } from '../../Builder/BuilderProductDetail/CnameRecord'
import { getRecordName } from '../../Builder/utils'
import { parseMigrationDate, shouldRedirectMigrated } from '../../../../../utils/websiteMigration'
import './website-migration.css'

// redesign C: the migration cards on Product pieces (P/Button, P/ConfirmDialog, P/Skeleton) and --od-* tokens.

/** The card every state shares: an icon, then its heading, text and actions. */
const MigrationCard = ({ tone, icon: Icon, children, ...props }) => (
  <section className='odc-root odc-migration' data-tone={tone} {...props}>
    {Icon && <Icon className='odc-icon odc-migration-icon' />}
    <div className='odc-migration-body'>{children}</div>
  </section>
)

const DEFAULT_CNAME_TARGET = 'cname.my-sites.app'

/** The text for a refused migration, by its first known code. */
export const getMigrationErrorText = (codes = [], t, target = DEFAULT_CNAME_TARGET) => {
  const texts = {
    'site_migration.not_eligible': t('WEBSITE_MIGRATION_ERROR_NOT_ELIGIBLE', 'This website can’t be migrated.'),
    'site_migration.dns_required': t('WEBSITE_MIGRATION_ERROR_DNS_REQUIRED', 'Point your domain to _target_ first.').replace('_target_', target),
    'site_migration.already_migrated': t('WEBSITE_MIGRATION_ERROR_ALREADY_MIGRATED', 'This website was already migrated.'),
    'site_migration.unavailable': t('WEBSITE_MIGRATION_ERROR_UNAVAILABLE', 'Migration isn’t available right now. Try again later.'),
    'site.not_found': t('WEBSITE_MIGRATION_ERROR_NOT_FOUND', 'We couldn’t find this website.')
  }
  const code = codes.find(item => texts[item])
  return code ? texts[code] : t('WEBSITE_MIGRATION_ERROR_FAILED', 'The website couldn’t be migrated. Try again.')
}

/** A date the API sends (`2026-10-19 10:00:00`, UTC, or ISO) as a day in `locale`. */
export const formatMigrationDate = (value, locale) => {
  const date = parseMigrationDate(value)
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat(locale || undefined, { dateStyle: 'medium' }).format(date)
  } catch (err) {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * What a legacy website can do about the new website: migrate (asking
 * first, since it goes live at once), change its DNS first, or open the
 * migrated site in Builder (straight away some days after it was migrated).
 * Nothing while it isn't eligible.
 */
const WebsiteMigrationUI = (props) => {
  const { migrationState, handleMigrate, clearErrors } = props
  const { loading, migration, migrating, errorCodes } = migrationState
  const [{ language }, t] = useLanguage()
  const history = useHistory()
  const [confirming, setConfirming] = useState(false)

  if (loading) {
    return (
      <MigrationCard aria-busy='true'>
        <Skeleton size='40%' />
        <Skeleton />
        <Skeleton size='80%' />
      </MigrationCard>
    )
  }

  const status = migration?.status
  const error = errorCodes.length > 0 && <p className='odc-migration-error' role='alert'>{getMigrationErrorText(errorCodes, t, migration?.cname_target || DEFAULT_CNAME_TARGET)}</p>

  if (status === 'migrated') {
    if (migration.product_id && shouldRedirectMigrated(migration.migrated_at)) return <Redirect to={`/builder/${migration.product_id}`} />
    const date = formatMigrationDate(migration.migrated_at, language?.code)
    return (
      <MigrationCard tone='done' icon={CircleCheck} aria-labelledby='website-migration-title'>
        <h2 id='website-migration-title'>{t('WEBSITE_MIGRATION_DONE_TITLE', 'This website was migrated to the new editor')}</h2>
        <p>
          {date
            ? t('WEBSITE_MIGRATION_DONE_TEXT', 'Migrated on _date_. It’s now edited in Builder.').replace('_date_', date)
            : t('WEBSITE_MIGRATION_DONE_TEXT_NO_DATE', 'It’s now edited in Builder.')}
        </p>
        <div className='odc-migration-actions'>
          {migration.product_id && (
            <Button variant='primary' onClick={() => history.push(`/builder/${migration.product_id}`)}>
              {t('WEBSITE_MIGRATION_OPEN_BUILDER', 'Open in Builder')}
            </Button>
          )}
          {migration.url && (
            <a className='odc-migration-link' href={migration.url} target='_blank' rel='noopener noreferrer'>
              {t('WEBSITE_MIGRATION_VIEW_SITE', 'View website')}
              <ExternalLink className='odc-icon' />
              <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
            </a>
          )}
        </div>
      </MigrationCard>
    )
  }

  if (status === 'dns_required') {
    const target = migration.cname_target || DEFAULT_CNAME_TARGET
    const recordName = migration.domain ? getRecordName(migration.domain) : ''
    return (
      <MigrationCard tone='warning' icon={TriangleAlert} aria-labelledby='website-migration-title'>
        <h2 id='website-migration-title'>{t('WEBSITE_MIGRATION_DNS_TITLE', 'To migrate, first change your domain’s DNS')}</h2>
        <p>
          {migration.domain
            ? t('WEBSITE_MIGRATION_DNS_TEXT', 'Your domain _domain_ isn’t on our network yet. Create this record in the DNS settings of the provider where you bought it. Once it’s active, you can migrate from here.').replace('_domain_', migration.domain)
            : t('WEBSITE_MIGRATION_DNS_TEXT_NO_DOMAIN', 'Your domain isn’t on our network yet. Create this record in the DNS settings of the provider where you bought it. Once it’s active, you can migrate from here.')}
        </p>
        <CnameRecord
          name={recordName || (migration.domain ? '@' : null)}
          nameHint={migration.domain && !recordName ? t('WEBSITE_MIGRATION_DNS_ROOT', 'For a root domain, your provider must allow a CNAME, ALIAS or ANAME record at @') : null}
          target={target}
        />
      </MigrationCard>
    )
  }

  if (status !== 'eligible') return null

  return (
    <MigrationCard icon={Globe} aria-labelledby='website-migration-title'>
      <h2 id='website-migration-title'>{t('WEBSITE_MIGRATION_TITLE', 'Move to the new website editor')}</h2>
      <p>{t('WEBSITE_MIGRATION_TEXT', 'Your website can use the new theme editor: more design options, and drafts you publish when you’re ready.')}</p>
      {error}
      <div className='odc-migration-actions'>
        <Button variant='primary' disabled={migrating} onClick={() => { clearErrors(); setConfirming(true) }}>
          {migrating ? t('WEBSITE_MIGRATION_MIGRATING', 'Migrating…') : t('WEBSITE_MIGRATION_ACTION', 'Migrate website')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        tone='primary'
        className='odc-migration-confirm'
        title={t('WEBSITE_MIGRATION_CONFIRM_TITLE', 'Migrate your website to the new editor?')}
        confirmLabel={t('WEBSITE_MIGRATION_CONFIRM_UNDERSTAND', 'I understand, migrate')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); handleMigrate() }}
      >
        <p>{t('WEBSITE_MIGRATION_CONFIRM_WARNING', 'The migration is irreversible: your website can’t go back to the previous editor. The change goes live right away: your customers will see the new website as soon as it finishes. You migrate under your own responsibility, so review your website after the migration in case it needs any adjustments.')}</p>
      </ConfirmDialog>
    </MigrationCard>
  )
}

export const WebsiteMigration = (props) => {
  const migrationProps = {
    ...props,
    UIComponent: WebsiteMigrationUI
  }
  return <WebsiteMigrationController {...migrationProps} />
}

/** A legacy website page with no website: new websites are made in Builder. */
export const WebsiteInBuilder = () => {
  const [, t] = useLanguage()
  const history = useHistory()
  return (
    <MigrationCard icon={Globe} aria-labelledby='website-in-builder-title'>
      <h2 id='website-in-builder-title'>{t('WEBSITE_IN_BUILDER_TITLE', 'Websites are now made in Builder')}</h2>
      <p>{t('WEBSITE_IN_BUILDER_TEXT', 'You don’t have a website here. Create it in Builder: more design options, and drafts you publish when you’re ready.')}</p>
      <div className='odc-migration-actions'>
        <Button variant='primary' onClick={() => history.push('/builder')}>
          {t('WEBSITE_IN_BUILDER_ACTION', 'Go to Builder')}
        </Button>
      </div>
    </MigrationCard>
  )
}
