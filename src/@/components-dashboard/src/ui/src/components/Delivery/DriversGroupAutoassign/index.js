import React, { useState } from 'react'
import { useLanguage, DriversGroupAutoassign as DriversGroupAutoassignController } from '../../../../../index'
import { PlusSquare, GeoAlt } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import { DragScroll } from '../../Shared'
import { Checkbox, Input } from '../../../styles'

import {
  AutoassignContainer,
  AutoassignItem,
  IconImage,
  CustomItem,
  ForcedAssignSettingWrapper,
  MaxDistanceCustomerContainer,
  RowGroupContainer,
  FieldContainer,
  InputsGroup,
  CheckboxWrapper,
  AreaWrapper,
  LargeArea,
  MediumArea,
  SmallArea,
  CheckboxContainer
} from './styles'

const DriversGroupAutoassignUI = (props) => {
  const {
    autoAssign,
    autoRejectOrderGroup,
    onSelectAssign,
    curDriversGroup,
    changesState,
    onChangeSave,
    handleChangeInput,
    handleChangeAzimuthInput,
    onChangeAutoRejectOrderGroup
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [curArea, setCurArea] = useState(null)

  return (
    <AutoassignContainer>
      <h1>{t('AUTOASSIGN_SETTINGS', 'Autoassign settings')}</h1>
      {(changesState?.type === 0 || (typeof changesState?.type === 'undefined' && curDriversGroup?.type === 0)) && (
        <>
          <DragScroll>
            <AutoassignItem
              as='button'
              type='button'
              aria-pressed={autoAssign === 1}
              active={autoAssign === 1}
              onClick={() => onSelectAssign(1)}
            >
              <IconImage url={theme.images.icons?.oneByOne} />
              <span>{t('ONE_BY_ONE', 'One by one')}</span>
            </AutoassignItem>
            <AutoassignItem
              as='button'
              type='button'
              aria-pressed={autoAssign === 2}
              active={autoAssign === 2}
              onClick={() => onSelectAssign(2)}
            >
              <IconImage url={theme.images.icons?.sendToAll} />
              <span>{t('SEND_TO_ALL', 'Send to all')}</span>
            </AutoassignItem>
            <AutoassignItem
              as='button'
              type='button'
              aria-pressed={autoAssign === 3}
              active={autoAssign === 3}
              onClick={() => onSelectAssign(3)}
            >
              <IconImage url={theme.images.icons?.nearestAvailable} />
              <span>{t('NEAREST_AVAILABLE', 'Nearest available')}</span>
            </AutoassignItem>
            <AutoassignItem
              as='button'
              type='button'
              aria-pressed={autoAssign === 4}
              active={autoAssign === 4}
              onClick={() => onSelectAssign(4)}
            >
              <IconImage url={theme.images.icons?.batchWise} />
              <span>{t('BATCH_WISE', 'Batch wise')}</span>
            </AutoassignItem>
            <AutoassignItem
              as='button'
              type='button'
              aria-pressed={autoAssign === 5}
              active={autoAssign === 5}
              onClick={() => onSelectAssign(5)}
            >
              <IconImage url={theme.images.icons?.roundRobin} />
              <span>{t('ROUND_ROBIN', 'Round robin')}</span>
            </AutoassignItem>
            <AutoassignItem
              as='button'
              type='button'
              aria-pressed={autoAssign === 6}
              onClick={() => onSelectAssign(6)}
            >
              <CustomItem
                active={autoAssign === 6}
              >
                <PlusSquare aria-hidden='true' />
                <span>{t('CUSTOM', 'Custom')}</span>
              </CustomItem>
            </AutoassignItem>
          </DragScroll>
          <ForcedAssignSettingWrapper>
            <Checkbox
              id='drivers-group-autoassign-forced-assignment'
              checked={changesState?.autoassign_forced_assignment ?? curDriversGroup?.autoassign_forced_assignment}
              onChange={e => onChangeSave({ autoassign_forced_assignment: e.target.checked })}
            />
            <label htmlFor='drivers-group-autoassign-forced-assignment'>{t('AUTO_ASSIGN_FORCED_ASSIGNMENT', 'Forced assignment')}</label>
          </ForcedAssignSettingWrapper>
        </>
      )}

      <MaxDistanceCustomerContainer>
        <div>
          <label htmlFor='drivers-group-autoassign-customer-max-distance'>{t('MAX_CUSTOMER_DISTANCE_FROM_BUSINESS', 'Max distance between customer and business')}</label>
          <p id='drivers-group-autoassign-customer-max-distance-hint'>{t('EMPTY_OR_0_TO_DISABLED', 'Empty or 0 to disable')}</p>
        </div>
        <Input
          id='drivers-group-autoassign-customer-max-distance'
          aria-describedby='drivers-group-autoassign-customer-max-distance-hint'
          name='autoassign_customer_max_distance_from_business'
          value={changesState?.autoassign_customer_max_distance_from_business ?? curDriversGroup?.autoassign_customer_max_distance_from_business ?? ''}
          placeholder={`00 ${t('METTERS', 'Meters')}`}
          onChange={e => handleChangeInput(e)}
        />
      </MaxDistanceCustomerContainer>

      <MaxDistanceCustomerContainer>
        <div>
          <label htmlFor='drivers-group-autoassign-max-azimuth-diff'>{t('MAXIMUM_ORIENTATION_DIFFERENCE', 'Maximum orientation difference')} ({t('ONLY_FOR_INDIVIDUAL_ORDERS', 'Only for individual orders')})</label>
          <p id='drivers-group-autoassign-max-azimuth-diff-hint'>{t('MAXIMUM_ORIENTATION_DIFFERENCE_DESC', 'Maximum angular difference (in degrees) between delivery orientations assigned to the same driver. Lower values group orders heading the same way. Leave empty to disable.')}</p>
        </div>
        <Input
          id='drivers-group-autoassign-max-azimuth-diff'
          aria-describedby='drivers-group-autoassign-max-azimuth-diff-hint'
          name='autoassign_max_azimuth_diff'
          value={changesState?.autoassign_max_azimuth_diff ?? curDriversGroup?.autoassign_max_azimuth_diff ?? ''}
          placeholder='e.g. 90'
          onChange={e => handleChangeAzimuthInput(e)}
        />
      </MaxDistanceCustomerContainer>

      <RowGroupContainer>
        <div>
          <FieldContainer>
            <label htmlFor='drivers-group-autoassign-amount-drivers'>{t('AUTO_ASSIGN_GROUP_ORDERS_TO_DRIVERS', 'Auto assign the order of group to this amount of drivers')}</label>
            <Input
              id='drivers-group-autoassign-amount-drivers'
              name='autoassign_amount_drivers'
              value={changesState?.autoassign_amount_drivers ?? curDriversGroup?.autoassign_amount_drivers ?? ''}
              onChange={e => handleChangeInput(e)}
              readOnly={(changesState?.type === 0 || (typeof changesState?.type === 'undefined' && curDriversGroup?.type === 0)) && autoAssign <= 3}
            />
          </FieldContainer>
        </div>
        {(autoAssign !== 2 && (changesState?.autoassign_amount_drivers < 2 || (typeof changesState?.autoassign_amount_drivers === 'undefined' && curDriversGroup?.autoassign_amount_drivers < 2))) && (
          <CheckboxContainer>
            <CheckboxWrapper>
              <Checkbox
                id='drivers-group-autoassign-autoaccept-by-driver'
                checked={changesState?.autoassign_autoaccept_by_driver ?? curDriversGroup?.autoassign_autoaccept_by_driver}
                onChange={e => onChangeSave({ autoassign_autoaccept_by_driver: e.target.checked })}
              />
              <label htmlFor='drivers-group-autoassign-autoaccept-by-driver'>{t('ORDER_CONFIRMED_ACCEPTED_BY_DRIVER', 'Accepted by driver')}</label>
            </CheckboxWrapper>
            {(typeof changesState?.autoassign_autoaccept_by_driver === 'undefined' ? !curDriversGroup?.autoassign_autoaccept_by_driver : !changesState?.autoassign_autoaccept_by_driver) && (
              <CheckboxWrapper>
                <Checkbox
                  id='drivers-group-autoassign-autoassign-driver'
                  checked={changesState?.autoassign_autoassign_driver ?? curDriversGroup?.autoassign_autoassign_driver}
                  onChange={e => onChangeSave({ autoassign_autoassign_driver: e.target.checked })}
                />
                <label htmlFor='drivers-group-autoassign-autoassign-driver'>{t('AUTO_ASSIGNED', 'Auto assigned')}</label>
              </CheckboxWrapper>
            )}
          </CheckboxContainer>
        )}
      </RowGroupContainer>

      {(((typeof changesState?.autoassign_autoaccept_by_driver === 'undefined' ? !curDriversGroup?.autoassign_autoaccept_by_driver : !changesState?.autoassign_autoaccept_by_driver) &&
      (typeof changesState?.autoassign_autoassign_driver === 'undefined' ? !curDriversGroup?.autoassign_autoassign_driver : !changesState?.autoassign_autoassign_driver)) ||
      (changesState?.type === 1 || (typeof changesState?.type === 'undefined' && curDriversGroup?.type === 1))) && (
        <FieldContainer as='fieldset'>
          <legend>{t('AUTO_REJECT_ORDER_GROUP_AFTER', 'Auto reject Orders After')}</legend>
          <InputsGroup>
            <Input
              aria-label={t('HOURS', 'Hours')}
              value={autoRejectOrderGroup?.hour ?? ''}
              onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'hour')}
            />
            <strong aria-hidden='true'>&#8282;</strong>
            <Input
              aria-label={t('MINUTES', 'Minutes')}
              value={autoRejectOrderGroup?.minute ?? ''}
              onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'minute')}
              maxlength='2'
            />
            <strong aria-hidden='true'>&#8282;</strong>
            <Input
              aria-label={t('SECONDS', 'Seconds')}
              value={autoRejectOrderGroup?.second ?? ''}
              onChange={e => onChangeAutoRejectOrderGroup(e.target.value, 'second')}
              maxlength='2'
            />
          </InputsGroup>
        </FieldContainer>
      )}
      {(changesState?.type === 0 || (typeof changesState?.type === 'undefined' && curDriversGroup?.type === 0)) && (
        <RowGroupContainer>
          <div>
            <FieldContainer isBlue={curArea === 1}>
              <label htmlFor='drivers-group-autoassign-initial-radius'>{t('INITIAL_RADIUS', 'Initial radius in meters')}</label>
              <Input
                id='drivers-group-autoassign-initial-radius'
                name='autoassign_initial_radius'
                value={changesState?.autoassign_initial_radius ?? curDriversGroup?.autoassign_initial_radius ?? ''}
                readOnly={autoAssign === 3}
                onFocus={() => setCurArea(1)}
                onBlur={() => setCurArea(0)}
                onChange={e => handleChangeInput(e)}
              />
            </FieldContainer>
            <FieldContainer isGreen={curArea === 2}>
              <label htmlFor='drivers-group-autoassign-increment-radius'>{t('INCREMENT_RADIUS', 'Radius increase in meters')}</label>
              <Input
                id='drivers-group-autoassign-increment-radius'
                name='autoassign_increment_radius'
                value={changesState?.autoassign_increment_radius ?? curDriversGroup?.autoassign_increment_radius ?? ''}
                readOnly={autoAssign === 3}
                onFocus={() => setCurArea(2)}
                onBlur={() => setCurArea(0)}
                onChange={e => handleChangeInput(e)}
              />
            </FieldContainer>
            <FieldContainer isPink={curArea === 3}>
              <label htmlFor='drivers-group-autoassign-max-radius'>{t('MAX_RADIUS', 'Maximum radius in meters')}</label>
              <Input
                id='drivers-group-autoassign-max-radius'
                name='autoassign_max_radius'
                value={changesState?.autoassign_max_radius ?? curDriversGroup?.autoassign_max_radius ?? ''}
                onChange={e => handleChangeInput(e)}
                onFocus={() => setCurArea(3)}
                onBlur={() => setCurArea(0)}
              />
            </FieldContainer>
          </div>
          <div>
            <AreaWrapper>
              <LargeArea active={curArea === 3} />
              <MediumArea active={curArea === 2} />
              <SmallArea active={curArea === 1} />
              <GeoAlt aria-hidden='true' />
            </AreaWrapper>
          </div>
        </RowGroupContainer>
      )}
      <CheckboxWrapper isPadding>
        <Checkbox
          id='drivers-group-autoassign-groupable-individual-orders-only'
          checked={changesState?.autoassign_groupable_individual_orders_only ?? curDriversGroup?.autoassign_groupable_individual_orders_only}
          onChange={e => onChangeSave({ autoassign_groupable_individual_orders_only: e.target.checked })}
        />
        <label htmlFor='drivers-group-autoassign-groupable-individual-orders-only'>{t('DO_NOT_ASSIGN_MORE_THAN_1_ORDER_IF_ORDER_CAN_NOT_GROUPED', 'Do not assign more than 1 order IF the order can’t be grouped')}</label>
      </CheckboxWrapper>
      <CheckboxWrapper isPadding>
        <Checkbox
          id='drivers-group-autoassign-autoreject-after-expiration'
          checked={changesState?.autoreject_after_expiration ?? curDriversGroup?.autoreject_after_expiration}
          onChange={e => onChangeSave({ autoreject_after_expiration: e.target.checked })}
        />
        <label htmlFor='drivers-group-autoassign-autoreject-after-expiration'>{t('AUTOREJECT_AFTER_EXPIRATION', 'Autoreject after expiration')}</label>
      </CheckboxWrapper>
    </AutoassignContainer>
  )
}

export const DriversGroupAutoassign = (props) => {
  const driversGroupAutoassignProps = {
    ...props,
    UIComponent: DriversGroupAutoassignUI
  }
  return <DriversGroupAutoassignController {...driversGroupAutoassignProps} />
}
