import React, { useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { InputFileContainer, InputFileStyle } from './styles'
import { credentialsUtilities } from './utils'

const { formatInputName, roundSizeBToKB, extractFileExtensions } = credentialsUtilities()

export const InputFile = (props) => {
  props = { ...defaultProps, ...props }
  const { name, defaultValue, accept, maxFileSize, updateInput } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [state, setState] = useState({ file: null, error: null })

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      const isValid = validateFile(file)
      if (!isValid) {
        showToast(ToastType.Error, t('INPUT_FILE_ERROR', 'Invalid file. Please check the extension or size.'))
        document.getElementById(name).value = ''
        updateInput(null)
        return
      }
      updateInput(file)
      setState({ ...state, file })
    }
  }

  const validateFile = (file) => {
    const allowedExtensions = extractFileExtensions(accept)
    const extensionIsValid = allowedExtensions.includes(file.name.split('.').pop())
    const sizeIsValid = file.size <= maxFileSize * 1024 // comparison in bytes
    return extensionIsValid && sizeIsValid
  }

  return (
    <>
      <InputFileContainer
        id='dropcontainer'
        htmlFor={name}
        className='drop-container'
        isError={state.error}
      >
        {!state.file && (
          <>
            <span className='drop-title'>{t('DROP_FILE_HERE', 'Drop file here')}</span>{t('OR', 'or')}
          </>
        )}
        {state.file && (
          <div className='file-details'>
            <p><strong>{`${t('FILE_SIZE', 'File size')}: `}</strong>{`${roundSizeBToKB(state.file?.size / 1024)} KB / ${maxFileSize} KB`}</p>
          </div>
        )}
        <InputFileStyle
          id={name}
          name={name}
          accept={accept}
          type='file'
          onChange={handleFileChange}
          onClick={() => setState({ file: null, error: null })}
          placeholder={formatInputName(name)}
        />
      </InputFileContainer>
      {defaultValue && (
        <span id='current-file'>
          <strong>{`${t('CURRENT_FILE', 'Current file')}: `}</strong>
          <span>{defaultValue}</span>
        </span>
      )}
    </>
  )
}

const defaultProps = {
  maxFileSize: 1024 // 1MB
}
