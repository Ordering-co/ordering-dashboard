import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Dialog } from '../../Shared/Product'
import { ProblemItem } from '../BuilderAppBuilds/BuildDialogs'
import { getCheckProblems, getPlatformLabel } from '../utils'
import './builder-detail.css'

// redesign B2: on P/Dialog, still an `alertdialog` named by its title and described by its help line

/**
 * Activating was refused (`product.incomplete`): what each app misses, by
 * platform, with the way to the tab that fixes it.
 */
export const IncompleteDialog = (props) => {
  const { product, checks, onClose, onGoToTab } = props
  const [, t] = useLanguage()

  const groups = (checks || []).flatMap(appChecks => {
    const app = (product?.apps || []).find(item => String(item.id) === String(appChecks.app_id))
    const appName = app?.name || product?.name || ''
    const problems = getCheckProblems(appChecks, t)
    const platforms = [...new Set(problems.map(problem => problem.platform))]
    return platforms.map(platform => ({
      key: `${appChecks.app_id}-${platform}`,
      title: `${appName} · ${getPlatformLabel(platform)}`,
      problems: problems.filter(problem => problem.platform === platform)
    }))
  })

  const fix = (tab, group) => {
    onClose()
    onGoToTab(tab, group)
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) onClose() }}
      role='alertdialog'
      size='md'
      title={t('BUILDER_INCOMPLETE_TITLE', '_name_ can’t be activated yet').replace('_name_', product?.name || '')}
      closeLabel={t('CLOSE', 'Close')}
      description={t('BUILDER_INCOMPLETE_HELP', 'Complete these and try again. Issues marked Ordering don’t stop it.')}
      footer={<Button variant='primary' onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
    >
      {groups.map(group => (
        <div key={group.key} className='odc-bd-group'>
          <strong>{group.title}</strong>
          <ul className='odc-bd-problems'>
            {group.problems.map(problem => <ProblemItem key={problem.key} problem={problem} onFix={fix} />)}
          </ul>
        </div>
      ))}
    </Dialog>
  )
}
