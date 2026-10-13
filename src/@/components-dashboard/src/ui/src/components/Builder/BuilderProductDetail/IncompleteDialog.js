import React, { useId } from 'react'

import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { Modal } from '../../Shared'
import { ProblemItem } from '../BuilderAppBuilds/BuildDialogs'
import { getCheckProblems, getPlatformLabel } from '../utils'
import { DialogBody, DialogFooter, DialogTitle, IncompleteGroup, MutedText, ProblemList } from '../styles'

/**
 * Activating was refused (`product.incomplete`): what each app misses, by
 * platform, with the way to the tab that fixes it.
 */
export const IncompleteDialog = (props) => {
  const { product, checks, onClose, onGoToTab } = props
  const [, t] = useLanguage()
  const titleId = useId()

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
    <Modal
      open
      width='min(560px, calc(100vw - 32px))'
      padding='24px'
      onClose={onClose}
    >
      <DialogBody role='alertdialog' aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{t('BUILDER_INCOMPLETE_TITLE', '_name_ can’t be activated yet').replace('_name_', product?.name || '')}</DialogTitle>
        <MutedText>{t('BUILDER_INCOMPLETE_HELP', 'Complete these and try again. Issues marked Ordering don’t stop it.')}</MutedText>
        {groups.map(group => (
          <IncompleteGroup key={group.key}>
            <strong>{group.title}</strong>
            <ProblemList>
              {group.problems.map(problem => <ProblemItem key={problem.key} problem={problem} onFix={fix} />)}
            </ProblemList>
          </IncompleteGroup>
        ))}
        <DialogFooter>
          <Button type='button' color='primary' borderRadius='8px' onClick={onClose}>{t('CLOSE', 'Close')}</Button>
        </DialogFooter>
      </DialogBody>
    </Modal>
  )
}
