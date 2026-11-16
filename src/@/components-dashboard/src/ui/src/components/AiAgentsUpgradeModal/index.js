import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../index'
import { ExternalLink } from '../Shared/Icon'
import { Dialog } from '../Shared/Product'
import { ORDERING_SALES_URL } from '../../utils/orderingSalesUrl'
import './ai-agents-upgrade.css'

// (main): the upgrade form of AI Agents for a project without the AI module, embedded and offered in a new tab.
// it opens from the redesigned shell, so it is a Product Dialog (main drew it with the legacy Modal); same props.
export const AiAgentsUpgradeModal = (props) => {
  const { open, onClose, formUrl, variant, returnFocus } = props
  const legacyPlan = variant === 'legacy-plan'

  const [, t] = useLanguage()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [open, formUrl])

  return (
    <Dialog
      open={!!open}
      onOpenChange={(next) => { if (!next) onClose?.() }}
      size='lg'
      title={legacyPlan
        ? t('LEGACY_PLAN_UPGRADE_TITLE', 'Request an upgrade')
        : t('AI_AGENTS_UPGRADE_TITLE', 'Upgrade to use AI Agents')}
      returnFocus={returnFocus}
      preferReturnFocus={Boolean(returnFocus)}
      closeLabel={t('CLOSE', 'Close')}
      className='odc-ai-upgrade'
    >
      <p className='odc-ai-upgrade-text'>
        {legacyPlan
          ? t('LEGACY_PLAN_UPGRADE_DESCRIPTION', 'This feature is available on the new version of Ordering. Tell us about your current setup and our team will help you upgrade.')
          : t('AI_AGENTS_UPGRADE_DESCRIPTION', 'AI Agents is available on the new version of Ordering. Tell us about your current setup and our team will help you upgrade.')}
      </p>
      {formUrl && (
        <iframe
          className='odc-ai-upgrade-frame'
          title={t('AI_AGENTS_UPGRADE_FORM_TITLE', 'Upgrade request form')}
          src={formUrl}
          referrerPolicy='no-referrer'
          onLoad={() => setLoaded(true)}
        />
      )}
      {formUrl && !loaded && (
        <p className='odc-ai-upgrade-status' role='status'>
          {t('AI_AGENTS_UPGRADE_FORM_LOADING', 'Loading the form…')}
        </p>
      )}
      <a className='odc-btn odc-ai-upgrade-link' data-variant='link' data-size='md' href={formUrl || ORDERING_SALES_URL} target='_blank' rel='noopener noreferrer'>
        {formUrl ? t('AI_AGENTS_UPGRADE_OPEN_NEW_TAB', 'Open in a new tab') : t('CONTACT_SALES', 'Contact Sales')}
        <ExternalLink className='odc-icon' aria-hidden='true' />
      </a>
    </Dialog>
  )
}
