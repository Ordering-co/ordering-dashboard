import React, { useEffect, useState } from 'react'

import { LanguageSelector as LanguageSelectorController, useLanguage } from '../../../../../index'
import { Globe } from '../Icon'
import { Menu } from '../Product/Menu'
import { Select } from '../../../styles/Select'
import {
  LanguageItem,
  LanguageText,
  SelectWrapper
} from './language-selector-styles'

// redesign fix-qa E8 (`variant='menu'`, opt-in, used by the account menu): the languages are one single-choice
// Product Menu instead of the legacy select, which opened upward over the account header and cut the last language.
// The trigger is the current language (Globe, name, chevron); the menu is as wide as the trigger and as tall as the room it
// has (it scrolls past that), so no language is ever out of reach. Same `handleChangeLanguage(code, true)`.
const PHONE = '(max-width: 767px)'
const usePhone = () => {
  const [phone, setPhone] = useState(() => !!window.matchMedia?.(PHONE).matches)
  useEffect(() => {
    const query = window.matchMedia?.(PHONE)
    if (!query) return undefined
    const update = () => setPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

// The menu trigger takes an icon component; wrapping keeps Globe a JSX element (Part 1 consumer rule).
const GlobeIcon = (props) => <Globe {...props} />

const LanguageMenu = ({ options, current, onChange }) => {
  const [, t] = useLanguage()
  const phone = usePhone()
  const label = options.find(option => option.value === current)?.content || t('LANGUAGE', 'Language')
  // Beside the account popover (its inline end), so the list never covers the popover's header; on a phone there is no
  // room beside it, so the list opens over the trigger and takes the popover's place while it is open.
  return (
    <Menu
      label={label}
      side={phone ? 'bottom' : 'inline-end'}
      align='start'
      triggerVariant='ghost'
      triggerProps={{ icon: GlobeIcon }}
      data-field-menu=''
      items={options.map(option => ({
        key: option.value,
        label: option.content,
        type: 'radio',
        checked: option.value === current,
        onSelect: () => { if (option.value !== current) onChange(option.value) }
      }))}
    />
  )
}

export const LanguageSelectorUI = (props) => {
  const {
    languagesState,
    currentLanguage,
    handleChangeLanguage,
    notReload,
    defaultLanguages,
    defaultCurrentLanguage,
    variant
  } = props
  const _languages = languagesState?.languages?.map(language => {
    return {
      value: language?.code, content: language?.name
    }
  })
  _languages && _languages.sort((a, b) =>
    (a.content > b.content) ? 1 : ((b.content > a.content) ? -1 : 0)
  )
  if (variant === 'menu' && _languages && _languages.length > 1) {
    return (
      <SelectWrapper data-variant='menu'>
        <LanguageMenu
          options={languagesState?.loading ? defaultLanguages : _languages}
          current={languagesState?.loading ? defaultCurrentLanguage : currentLanguage}
          onChange={(languageId) => handleChangeLanguage(languageId, true)}
        />
      </SelectWrapper>
    )
  }
  return (
    _languages && _languages.length > 1
      ? (
      <SelectWrapper>
        <Globe />
        <Select
          optionInnerMaxHeight='300px'
          options={languagesState?.loading ? defaultLanguages : _languages}
          defaultValue={languagesState?.loading ? defaultCurrentLanguage : currentLanguage}
          onChange={(languageId) => handleChangeLanguage(languageId, true)}
          notReload={notReload}
          minWidth='200px'
        />
      </SelectWrapper>
        )
      : (
      <>
        {_languages && _languages.length === 1
          ? (
          <LanguageItem>
            <Globe />
            <LanguageText>{_languages[0]?.content}</LanguageText>
          </LanguageItem>
            )
          : (
              null
            )}
      </>
        )
  )
}

export const LanguageSelector = (props) => {
  const DefaultChangeLanguage = () => { }
  const langProps = {
    ...props,
    UIComponent: LanguageSelectorUI,
    onChangeLanguage: props.onChangeLanguage || DefaultChangeLanguage,
    defaultLanguages: [{
      content: 'English',
      showOnSelected: 'EN',
      value: 'en'
    }],
    defaultCurrentLanguage: 'en'
  }
  return (
    <LanguageSelectorController {...langProps} />
  )
}
