import React from 'react'
import { useLanguage } from '../../../../../index'
import { Checkbox } from '../../Shared/Product'
import { ThemeOption } from './ThemeOption'
import { ThemeImage } from './ThemeImage'
import { getTitle } from './themeValues'
import './site-theme.css'

// redesign (lot D, decision 7): a component of a block (same walk of the structure as in `main`), on controlled Product
// controls. The value is written through `onChange(path, value)`.

export const ThemeComponent = (props) => {
  const {
    name,
    valueObject,
    componentObject,
    path,
    onChange,
    handleAddThemeGallery
  } = props

  const [, t] = useLanguage()
  const title = getTitle(t, name) // J5 row 48: the translated title, see getTitle
  const isBoolean = componentObject?.value_type === 'boolean'

  return (
    <div className='odc-op-theme-component'>
      {isBoolean
        ? (
          <Checkbox checked={!!valueObject} onCheckedChange={next => onChange(path, next)}>
            <span className='odc-op-theme-cap'>{title}</span>
          </Checkbox>
          )
        : <h5 className='odc-op-theme-title'>{title}</h5>}
      {(name === 'image' || name === 'dummy_image') && componentObject?.value_type === 'string' && (
        <ThemeImage
          key={valueObject}
          valueObject={valueObject}
          handleAddThemeGallery={handleAddThemeGallery}
          handleChangeValue={value => onChange(path, value)}
        />
      )}
      {Object.keys(componentObject || {}).filter(option => option !== 'components' && option !== 'value_type').map(option => {
        const optionObject = componentObject[option]
        return (
          <React.Fragment key={option}>
            {typeof valueObject?.[option] !== 'undefined' && (
              <ThemeOption
                name={option}
                optionObject={optionObject}
                valueObject={valueObject[option]}
                path={path + '.' + option}
                onChange={onChange}
                handleAddThemeGallery={handleAddThemeGallery}
              />
            )}
          </React.Fragment>
        )
      })}
      {componentObject?.components && Object.keys(componentObject.components).filter(subComponent => subComponent !== 'value_type').map(subComponent => (
        <React.Fragment key={subComponent}>
          {typeof valueObject?.components?.[subComponent] !== 'undefined' && (
            <ThemeComponent
              name={subComponent}
              componentObject={componentObject.components[subComponent]}
              valueObject={valueObject.components[subComponent]}
              path={path + '.components.' + subComponent}
              onChange={onChange}
              handleAddThemeGallery={handleAddThemeGallery}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
