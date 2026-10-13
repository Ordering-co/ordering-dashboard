import React, { useState, useEffect } from 'react'
import { useLanguage, useSession } from '../../../../../index'

import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'

import {
  LearnDropDownContainer,
  DropDownWrapper,
  Option
} from './styles'
import { Book } from 'react-bootstrap-icons'

export const LearnDropDown = (props) => {
  const { learnOptions } = props
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [formatedOptions, setFormatedOptions] = useState([])

  const handleClickOption = (val) => {
    const url = learnOptions.find((option) => (option.value === val))?.url
    window.open(url ?? 'https://help.orderingplus.com', '_blank')
  }

  useEffect(() => {
    const formatedOptions = learnOptions?.map((option) => {
      return {
        ...option,
        content: (
          <Option noPadding>
            <p>{option?.name}</p>
          </Option>
        )
      }
    })
    setFormatedOptions(formatedOptions)
  }, [])

  return (
    <>
      {user?.level === 0 && Array.isArray(learnOptions) && learnOptions.length > 0 && (
        <LearnDropDownContainer>
          <DropDownWrapper>
            <FirstSelect
              noSelected
              placeholder={<Option noPadding><Book size={12}/><p className='place-holder'>{t('LEARN', 'Learn')}</p></Option>}
              options={formatedOptions}
              onChange={(value) => handleClickOption(value)}
              className='learn-drop-down'
            />
          </DropDownWrapper>
        </LearnDropDownContainer>
      )}
    </>
  )
}
