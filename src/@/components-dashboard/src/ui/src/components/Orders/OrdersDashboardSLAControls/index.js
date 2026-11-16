import React, { useState, useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useLanguage } from '../../../../../index'

import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import { useLegacyPlanUpgrade } from '../../../contexts/LegacyPlanUpgradeContext'
import { useIsPathHiddenByReadOnly } from '../../../hooks/useIsPathHiddenByReadOnly'
import { SETTINGS_SLA_PATH } from '../../../../../utils/settingsExternalEditors'

import {
  OrdersDashboardSLAControlsContainer,
  OrderTimeStatusSelectWrapper,
  Option,
  Timestatus
} from './styles'

export const OrdersDashboardSLAControls = (props) => {
  const { setTimeStatus } = props
  const history = useHistory()
  const { requestUpgrade } = useLegacyPlanUpgrade()
  const [filterValues, { handleFilterValues }] = useFilterValues()
  const [defaultOptionValue, setDefaultOptionValue] = useState(filterValues?.timeStatus ?? 'default')
  const [filteredTimeStatus, setFilteredTimeStatus] = useState([])
  const [, t] = useLanguage()
  const hideSlaSettings = useIsPathHiddenByReadOnly(SETTINGS_SLA_PATH)

  const timeStatus = [
    {
      value: 'default',
      name: t('SLA_S', 'SLA'),
      content: (
        <Option noPadding>
          <Timestatus timeState='' />
          <p>{t('SLA_S', 'SLA')}</p>
        </Option>
      )
    },
    {
      value: 'in_time',
      name: t('OK', 'Ok'),
      content: (
        <Option noPadding>
          <Timestatus timeState='in_time' />
          <p>{t('OK', 'Ok')}</p>
        </Option>
      )
    },
    {
      value: 'at_risk',
      name: t('AT_RISK', 'At risk'),
      content: (
        <Option noPadding>
          <Timestatus timeState='at_risk' />
          <p>{t('AT_RISK', 'At risk')}</p>
        </Option>
      )
    },
    {
      value: 'delayed',
      name: t('DELAYED', 'Delayed'),
      content: (
        <Option noPadding>
          <Timestatus timeState='delayed' />
          <p>{t('DELAYED', 'Delayed')}</p>
        </Option>
      )
    },
    // (R-4): a read-only admin cannot open Settings, so it is not offered the shortcut
    ...(hideSlaSettings
      ? []
      : [{
          value: 'sla_settings',
          name: t('SLA_SETTING', 'SLA settings'),
          content: (
            <Option noPadding>
              <p>{t('SLA_SETTING', 'SLA settings')}</p>
            </Option>
          )
        }])
  ]

  const changeOrderTimeStatus = (val) => {
    if (val === 'sla_settings') {
      const openSettings = () => history.push(SETTINGS_SLA_PATH)
      if (!requestUpgrade(undefined, openSettings)) openSettings()
      return
    }
    setDefaultOptionValue(val)
    if (val === 'default') {
      handleFilterValues({ ...filterValues, timeStatus: null })
      setTimeStatus(null)
      return
    }
    handleFilterValues({ ...filterValues, timeStatus: val })
    setTimeStatus(val)
  }

  const handleChangeSearch = (searchValue) => {
    const _filteredTimeStatus = [...timeStatus?.filter(orderStatuse => orderStatuse?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
    setFilteredTimeStatus(_filteredTimeStatus)
  }

  useEffect(() => {
    if (filterValues?.timeStatus) return
    setDefaultOptionValue('default')
  }, [filterValues?.timeStatus])

  useEffect(() => {
    setFilteredTimeStatus(timeStatus)
  }, [])

  return (
    <OrdersDashboardSLAControlsContainer>
      <OrderTimeStatusSelectWrapper>
        <FirstSelect
          searchBarIsCustomLayout
          placeholder={<Option noPadding><p>{t('SLA_S', 'SLA')}</p></Option>}
          options={filteredTimeStatus}
          defaultValue={defaultOptionValue}
          onChange={(timeState) => changeOrderTimeStatus(timeState)}
          className='timeStatusSelect'
          isShowSearchBar
          searchBarPlaceholder={t('SEARCH', 'Search')}
          handleChangeSearch={handleChangeSearch}
        />
      </OrderTimeStatusSelectWrapper>
    </OrdersDashboardSLAControlsContainer>
  )
}
