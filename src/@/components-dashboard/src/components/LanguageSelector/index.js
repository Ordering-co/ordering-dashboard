import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage LanguageSelector behavior without UI component
 */
export const LanguageSelector = (props) => {
  const {
    currentLanguage,
    languages,
    UIComponent
  } = props

  const [languageListState, setLanguageListState] = useState({ loading: !languages, languages, error: null })
  const [languageState, , { setLanguage }] = useLanguage()
  const [languageSelected, setLanguageSelected] = useState(null)
  const requestsState = {}

  /**
   * This method is used for change the current language
   */
  const onChangeLanguage = (code, fromSelector) => {
    const language = languageListState.languages.find(language => language.code === code)
    if (props.handlerCustomChangeLanguage) {
      props.handlerCustomChangeLanguage(language)
      setLanguageSelected(language)
      return
    }
    props.onChangeLanguage && props.onChangeLanguage(language)
    setLanguage(language, fromSelector)
  }

  useEffect(() => {
    if (languageState.loading) return
    if (languages?.length > 0) {
      setLanguageListState({
        ...languageListState,
        loading: false,
        languages
      })
    } else {
      const _languages = languageState.languageList.filter(lang => lang.enabled)
      setLanguageListState({
        ...languageListState,
        loading: false,
        languages: _languages
      })
    }
    return () => {
      if (requestsState.languages) {
        requestsState.languages.cancel()
      }
    }
  }, [languageState])

  /**
   * Selecting default if exist and there is not one in local storage
   */
  useEffect(() => {
    if (currentLanguage) {
      const language = languages.find(language => language.code === currentLanguage)
      setLanguage(language)
      setLanguageSelected(language)
    } else if (!languageState?.language?.code || !languageSelected?.code) {
      const language = languageState?.language?.code
        ? languageState?.language
        : languageListState?.languages?.find(language => language.default)
      if (language) {
        setLanguage(language)
        setLanguageSelected(language)
      }
    }
  }, [languages, languageListState])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          currentLanguage={props.handlerCustomChangeLanguage ? languageSelected?.code : languageState?.language?.code}
          languagesState={languageListState}
          handleChangeLanguage={onChangeLanguage}
        />
      )}
    </>
  )
}

LanguageSelector.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * currentLanguage, this must be containt current language to show in the app
   */
  currentLanguage: PropTypes.string,
  /**
   * languages, this array must be containt a list of available languages
   */
  languages: PropTypes.arrayOf(PropTypes.object),
  /**
   * Return language selected
   */
  onChangeLanguage: PropTypes.func,
  /**
   * handlerCustomChangeLanguage, handler change behavior
   */
  handlerCustomChangeLanguage: PropTypes.func
}
