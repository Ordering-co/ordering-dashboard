import React from 'react'
import {
  useLanguage,
  LanguageSetting as LanguageSettingController
} from '../../../../../index'
import { Switch } from '../../../styles'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Circle, RecordCircle } from 'react-bootstrap-icons'

import {
  LanguageDetailsContainer,
  FieldContainer,
  RadioWrapper
} from './styles'

const LanguageSettingUI = (props) => {
  const {
    languageFiledsState,
    handleChangeFieldSetting
  } = props

  const [languageState, t] = useLanguage()

  // redesign (D4, M-02): the project default is saved with the Settings controller; the account selector no longer owns it.
  const handleSelectDefault = (field) => {
    if (field.default || !field.enabled) return
    handleChangeFieldSetting(field.id, { default: true })
  }

  return (
    <>
      <LanguageDetailsContainer>
        <h1>{t('LANGUAGES_SETTINGS', 'Languages settings')}</h1>
        <div style={{ padding: 20 }}>
          <FieldContainer isHeader>
            <div className='name'>{t('FIELD', 'Field')}</div>
            <div className='default'>{t('DEFAULT', 'Default')}</div>
            <div className='status'>{t('STATE', 'Status')}</div>
          </FieldContainer>
          {languageFiledsState?.loading
            ? (
                [...Array(20).keys()].map(i => (
              <FieldContainer key={i}>
                <div className='name'><Skeleton width={120} /></div>
                <div className='default'>
                  <Skeleton width={20} height={20} style={{ borderRadius: 20 }} />
                </div>
                <div className='status'>
                  <Skeleton width={30} style={{ borderRadius: 20 }} />
                </div>
              </FieldContainer>
                ))
              )
            : (
            <>
              {languageFiledsState.fields.map(field => (
                <FieldContainer key={field.id}>
                  <div className='name'>{field.name}</div>
                  <RadioWrapper
                    role='radio'
                    aria-checked={!!field.default}
                    aria-label={`${t('DEFAULT', 'Default')}: ${field.name}`}
                    className={field.default ? 'checked default' : 'default'}
                    onClick={() => handleSelectDefault(field)}
                    disabled={!field.enabled}
                  >
                    {(field.default) ? <RecordCircle /> : <Circle />}
                  </RadioWrapper>
                  <div className='status'>
                    {/* the shared Switch takes no name, so the group carries "Status: <language>".
                        the key changes after a failed save, which remounts the switch in its saved state. */}
                    <div role='group' aria-label={`${t('STATE', 'Status')}: ${field.name}`}>
                      <Switch
                        key={`${field.id}-${languageFiledsState.revisions?.[field.id] || 0}`}
                        defaultChecked={field.enabled}
                        // review r1 #1: the default no longer follows your own language, so it locks by itself.
                        disabled={field.default || languageState?.language?.id === field.id}
                        onChange={(val) => handleChangeFieldSetting(field.id, { enabled: val })}
                      />
                    </div>
                  </div>
                </FieldContainer>
              ))}
            </>
              )}
        </div>
      </LanguageDetailsContainer>
    </>
  )
}
export const LanguageSetting = (props) => {
  const languageSettingProps = {
    ...props,
    UIComponent: LanguageSettingUI
  }
  return <LanguageSettingController {...languageSettingProps} />
}
