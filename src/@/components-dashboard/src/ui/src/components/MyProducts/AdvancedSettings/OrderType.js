import React from 'react'
import { useLanguage } from '../../../../../index'
import { Input } from '../../../styles'
import {
  FormControl
} from './styles'
import { ImageBox } from './ImageBox'

export const OrderType = (props) => {
  const { path, typeValues, handleUpdateThemeValue, themesList } = props
  const [, t] = useLanguage()

  return (
    <>
      <FormControl>
        <label>{t('TITLE', 'Title')}</label>
        <Input
          placeholder={t('TITLE', 'Title')}
          defaultValue={typeValues?.title || ''}
          onChange={(e) => handleUpdateThemeValue(e.target.value, [path, 'title'].join('.'))}
        />
      </FormControl>
      <FormControl>
        <label>{t('DESCRIPTION', 'Description')}</label>
        <Input
          placeholder={t('DESCRIPTION', 'Description')}
          defaultValue={typeValues?.description || ''}
          onChange={(e) => handleUpdateThemeValue(e.target.value, [path, 'description'].join('.'))}
        />
      </FormControl>
      <FormControl>
        <label>{t('EXPORT_CALL_TO_ACTION', 'Call to action')}</label>
        <Input
          placeholder={t('EXPORT_CALL_TO_ACTION', 'Call to action')}
          defaultValue={typeValues?.call_to_action || ''}
          onChange={(e) => handleUpdateThemeValue(e.target.value, [path, 'call_to_action'].join('.'))}
        />
      </FormControl>
      <ImageBox
        title={t('ORDER_TYPE_IMAGE', 'Order type image')}
        ratio='1350 x 200 px'
        isBig
        photo={typeValues?.image}
        path='image'
        themeId={themesList?.themes?.[0]?.id}
        handleChangePhoto={(image) => handleUpdateThemeValue(image, [path, 'image'].join('.'))}
      />
    </>
  )
}
