import React, { useId } from 'react'
import { useLanguage, DriversGroupAutoassign as DriversGroupAutoassignController } from '../../../../../index'
import { Checkbox, Input } from '../../../styles'

import {
  AutoassignContainer,
  RowGroupContainer,
  FieldContainer,
  InputsGroup,
  CheckboxWrapper,
  CheckboxContainer
} from './styles'

const DriversGroupAutoassignUI = (props) => {
  const {
    autoAssign,
    autoRejectOrderGroup,
    curDriversGroup,
    changesState,
    onChangeSave,
    onChangeAutoRejectOrderGroup
  } = props

  const [, t] = useLanguage()
  // redesign bugs-d row 61: each control is named by the text beside it, the time inputs by their unit inside a group named by the label
  const labelsId = useId()
  const assignLabelId = `${labelsId}-assign`
  const rejectLabelId = `${labelsId}-reject`
  const timeLabelId = `${labelsId}-time`

  return (
    <AutoassignContainer>
      <RowGroupContainer>
        {(autoAssign !== 2 && (changesState?.autoassign_amount_drivers < 2 || (typeof changesState?.autoassign_amount_drivers === 'undefined' && curDriversGroup?.autoassign_amount_drivers < 2))) && (
          <CheckboxContainer>
            {(typeof changesState?.autoassign_autoaccept_by_driver === 'undefined' ? !curDriversGroup?.autoassign_autoaccept_by_driver : !changesState?.autoassign_autoaccept_by_driver) && (
              <CheckboxWrapper>
                <Checkbox
                  aria-labelledby={assignLabelId}
                  checked={changesState?.autoassign_autoassign_driver ?? curDriversGroup?.autoassign_autoassign_driver}
                  onChange={e => onChangeSave({ autoassign_autoassign_driver: e.target.checked })}
                />
                <span id={assignLabelId}>{t('ASSIGN_AUTOMATICALLY', 'Assign Automatically')}</span>
              </CheckboxWrapper>
            )}
          </CheckboxContainer>
        )}
      </RowGroupContainer>
      <CheckboxWrapper isPadding>
        <Checkbox
          aria-labelledby={rejectLabelId}
          checked={changesState?.autoreject_after_expiration ?? curDriversGroup?.autoreject_after_expiration}
          onChange={e => onChangeSave({ autoreject_after_expiration: e.target.checked })}
        />
        <span id={rejectLabelId}>{t('AUTOREJECT_AFTER_EXPIRATION', 'Autoreject after expiration')}</span>
      </CheckboxWrapper>
      {(((typeof changesState?.autoassign_autoaccept_by_driver === 'undefined' ? !curDriversGroup?.autoassign_autoaccept_by_driver : !changesState?.autoassign_autoaccept_by_driver) &&
        (typeof changesState?.autoassign_autoassign_driver === 'undefined' ? !curDriversGroup?.autoassign_autoassign_driver : !changesState?.autoassign_autoassign_driver)) ||
        (changesState?.type === 1 || (typeof changesState?.type === 'undefined' && curDriversGroup?.type === 1))) && (
          <FieldContainer>
            <label id={timeLabelId}>{t('AUTO_REJECT_ORDER_GROUP_NOT_ASSIGN', 'Auto reject Order if not assign in')}</label>
            <InputsGroup role='group' aria-labelledby={timeLabelId}>
              <Input
                aria-label={t('HOURS', 'Hours')}
                value={autoRejectOrderGroup?.hour ?? ''}
                onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'hour')}
                maxlength='1'
              />
              <strong>&#8282;</strong>
              <Input
                aria-label={t('MINUTES', 'Minutes')}
                value={autoRejectOrderGroup?.minute ?? ''}
                onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'minute')}
                maxlength='2'
              />
              <strong>&#8282;</strong>
              <Input
                aria-label={t('SECONDS', 'Seconds')}
                value={autoRejectOrderGroup?.second ?? ''}
                onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'second')}
                maxlength='2'
              />
            </InputsGroup>
          </FieldContainer>
      )}
    </AutoassignContainer>
  )
}

export const DriversGroupAutoassignService = (props) => {
  const driversGroupAutoassignProps = {
    ...props,
    UIComponent: DriversGroupAutoassignUI,
    lazyload: true
  }
  return <DriversGroupAutoassignController {...driversGroupAutoassignProps} />
}
