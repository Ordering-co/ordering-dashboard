import React, { useState } from 'react'
import { Redirect, useHistory } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { BoxArrowUpRight, CheckCircleFill, InfoCircleFill, Stars } from 'react-bootstrap-icons'

import { useLanguage, WebsiteMigration as WebsiteMigrationController } from '../../../../../index'
import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import { CnameRecord } from '../../Builder/BuilderProductDetail/BuilderWebDomains'
import { getRecordName } from '../../Builder/utils'
import { parseMigrationDate, shouldRedirectMigrated } from '../../../../../utils/websiteMigration'
import { MigrationActions, MigrationBody, MigrationCard, MigrationError } from './styles'

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
        <MigrationBody>
          <Skeleton height={18} width={260} />
          <Skeleton height={14} count={2} />
        </MigrationBody>
      </MigrationCard>
    )
  }

  const status = migration?.status
  const error = errorCodes.length > 0 && <MigrationError role='alert'>{getMigrationErrorText(errorCodes, t, migration?.cname_target || DEFAULT_CNAME_TARGET)}</MigrationError>

  if (status === 'migrated') {
    if (migration.product_id && shouldRedirectMigrated(migration.migrated_at)) return <Redirect to={`/builder/${migration.product_id}`} />
    const date = formatMigrationDate(migration.migrated_at, language?.code)
    return (
      <MigrationCard tone='done' aria-labelledby='website-migration-title'>
        <CheckCircleFill aria-hidden='true' />
        <MigrationBody>
          <h2 id='website-migration-title'>{t('WEBSITE_MIGRATION_DONE_TITLE', 'This website was migrated to the new editor')}</h2>
          <p>
            {date
              ? t('WEBSITE_MIGRATION_DONE_TEXT', 'Migrated on _date_. It’s now edited in Builder.').replace('_date_', date)
              : t('WEBSITE_MIGRATION_DONE_TEXT_NO_DATE', 'It’s now edited in Builder.')}
          </p>
          <MigrationActions>
            {migration.product_id && (
              <Button type='button' color='primary' borderRadius='8px' onClick={() => history.push(`/builder/${migration.product_id}`)}>
                {t('WEBSITE_MIGRATION_OPEN_BUILDER', 'Open in Builder')}
              </Button>
            )}
            {migration.url && (
              <a href={migration.url} target='_blank' rel='noopener noreferrer'>
                {t('WEBSITE_MIGRATION_VIEW_SITE', 'View website')}
                <BoxArrowUpRight aria-hidden='true' />
                <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
              </a>
            )}
          </MigrationActions>
        </MigrationBody>
      </MigrationCard>
    )
  }

  if (status === 'dns_required') {
    const target = migration.cname_target || DEFAULT_CNAME_TARGET
    const recordName = migration.domain ? getRecordName(migration.domain) : ''
    return (
      <MigrationCard tone='warning' aria-labelledby='website-migration-title'>
        <InfoCircleFill aria-hidden='true' />
        <MigrationBody>
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
        </MigrationBody>
      </MigrationCard>
    )
  }

  if (status !== 'eligible') return null

  return (
    <MigrationCard aria-labelledby='website-migration-title'>
      <Stars aria-hidden='true' />
      <MigrationBody>
        <h2 id='website-migration-title'>{t('WEBSITE_MIGRATION_TITLE', 'Move to the new website editor')}</h2>
        <p>{t('WEBSITE_MIGRATION_TEXT', 'Your website can use the new theme editor: more design options, and drafts you publish when you’re ready.')}</p>
        {error}
        <MigrationActions>
          <Button type='button' color='primary' borderRadius='8px' disabled={migrating} onClick={() => { clearErrors(); setConfirming(true) }}>
            {migrating ? t('WEBSITE_MIGRATION_MIGRATING', 'Migrating…') : t('WEBSITE_MIGRATION_ACTION', 'Migrate website')}
          </Button>
        </MigrationActions>
      </MigrationBody>
      <Confirm
        open={confirming}
        title={t('WEBSITE_MIGRATION_CONFIRM_TITLE', 'Migrate your website to the new editor?')}
        acceptText={t('WEBSITE_MIGRATION_CONFIRM_ACCEPT', 'Migrate now')}
        cancelText={t('CANCEL', 'Cancel')}
        onClose={() => setConfirming(false)}
        onCancel={() => setConfirming(false)}
        onAccept={() => { setConfirming(false); handleMigrate() }}
      >
        <p style={{ margin: 0 }}>{t('WEBSITE_MIGRATION_CONFIRM_TEXT', 'The change goes live right away: your customers will see the new website as soon as it finishes. It’s important that you review your website after the migration in case it needs any adjustments.')}</p>
      </Confirm>
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
    <MigrationCard aria-labelledby='website-in-builder-title'>
      <Stars aria-hidden='true' />
      <MigrationBody>
        <h2 id='website-in-builder-title'>{t('WEBSITE_IN_BUILDER_TITLE', 'Websites are now made in Builder')}</h2>
        <p>{t('WEBSITE_IN_BUILDER_TEXT', 'You don’t have a website here. Create it in Builder: more design options, and drafts you publish when you’re ready.')}</p>
        <MigrationActions>
          <Button type='button' color='primary' borderRadius='8px' onClick={() => history.push('/builder')}>
            {t('WEBSITE_IN_BUILDER_ACTION', 'Go to Builder')}
          </Button>
        </MigrationActions>
      </MigrationBody>
    </MigrationCard>
  )
}
