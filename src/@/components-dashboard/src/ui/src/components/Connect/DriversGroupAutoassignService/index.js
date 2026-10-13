import React from 'react'
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

  return (
    <AutoassignContainer>
      <RowGroupContainer>
        {(autoAssign !== 2 && (changesState?.autoassign_amount_drivers < 2 || (typeof changesState?.autoassign_amount_drivers === 'undefined' && curDriversGroup?.autoassign_amount_drivers < 2))) && (
          <CheckboxContainer>
            {(typeof changesState?.autoassign_autoaccept_by_driver === 'undefined' ? !curDriversGroup?.autoassign_autoaccept_by_driver : !changesState?.autoassign_autoaccept_by_driver) && (
              <CheckboxWrapper>
                <Checkbox
                  checked={changesState?.autoassign_autoassign_driver ?? curDriversGroup?.autoassign_autoassign_driver}
                  onChange={e => onChangeSave({ autoassign_autoassign_driver: e.target.checked })}
                />
                <span>{t('ASSIGN_AUTOMATICALLY', 'Assign Automatically')}</span>
              </CheckboxWrapper>
            )}
          </CheckboxContainer>
        )}
      </RowGroupContainer>
      <CheckboxWrapper isPadding>
        <Checkbox
          checked={changesState?.autoreject_after_expiration ?? curDriversGroup?.autoreject_after_expiration}
          onChange={e => onChangeSave({ autoreject_after_expiration: e.target.checked })}
        />
        <span>{t('AUTOREJECT_AFTER_EXPIRATION', 'Autoreject after expiration')}</span>
      </CheckboxWrapper>
      {(((typeof changesState?.autoassign_autoaccept_by_driver === 'undefined' ? !curDriversGroup?.autoassign_autoaccept_by_driver : !changesState?.autoassign_autoaccept_by_driver) &&
        (typeof changesState?.autoassign_autoassign_driver === 'undefined' ? !curDriversGroup?.autoassign_autoassign_driver : !changesState?.autoassign_autoassign_driver)) ||
        (changesState?.type === 1 || (typeof changesState?.type === 'undefined' && curDriversGroup?.type === 1))) && (
          <FieldContainer>
            <label>{t('AUTO_REJECT_ORDER_GROUP_NOT_ASSIGN', 'Auto reject Order if not assign in')}</label>
            <InputsGroup>
              <Input
                value={autoRejectOrderGroup?.hour ?? ''}
                onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'hour')}
                maxlength='1'
              />
              <strong>&#8282;</strong>
              <Input
                value={autoRejectOrderGroup?.minute ?? ''}
                onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'minute')}
                maxlength='2'
              />
              <strong>&#8282;</strong>
              <Input
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
