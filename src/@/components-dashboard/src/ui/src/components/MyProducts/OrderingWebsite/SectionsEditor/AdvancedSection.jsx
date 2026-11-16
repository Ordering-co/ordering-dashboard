import React from 'react'

import { useLanguage } from '../../../../../../index'
import { RadioGroup, TextField } from '../../../Shared/Product'
import { FontStyleGroup } from '../../AdvancedSettings/FontStyleGroup'
import { IMAGE_BOX_FORMAT, ImageFormatContext } from '../../AdvancedSettings/ImageBox'
import { OrderType } from '../../AdvancedSettings/OrderType'
import { hasCustomFavicon, resolveEffectiveFaviconPreview } from '../../AdvancedSettings/resolveEffectiveFaviconPreview'
import { ADVANCED_SECTION_IDS, useAdvancedSectionConfig } from './advancedSections'
import { AdvancedImageField, ProductSettingList, WEBSITE_IMAGE_FORMAT, getAt, useUpdateAdvancedValue } from './ProductSettingList'
import './sections-editor.css'

// redesign ordering-website B4 (D3): one section of Advanced, painted with the controls of P/. What it paints, section by
// section, is in advancedSections.js (the same content, order and conditions as AdvancedSettings/index.js for a website); the frame
// of the editor draws the h2, so the subtitles here are h3. Everything is read from `advancedValues` and written through the
// `setAdvancedValues` of the controller, like the legacy page (no Save button here: the editor has one save bar for everything).
// with `isApp` (and `isKiosk`, `isMaweja`) it paints the Advanced sections of an app, with the image rules ImageBox has for
// an app (its own defaults: the legacy page gave no format to an app) and its checkboxes «shown in your app».

export const AdvancedSection = ({ sectionId, advancedValues, setAdvancedValues, themesList, site, isFranchise, forcedSiteId, isApp, isKiosk, isMaweja }) => {
  const [, t] = useLanguage()
  const config = useAdvancedSectionConfig({ isFranchise, forcedSiteId, isApp, isKiosk, isMaweja })
  const updateThemeValue = useUpdateAdvancedValue(advancedValues, setAdvancedValues)
  const section = config[sectionId]
  const themeId = themesList?.themes?.[0]?.id

  if (!section || !section.enabled) return null

  const renderBlock = (block, index) => {
    switch (block.kind) {
      case 'list':
        return (
          <ProductSettingList
            key={index}
            list={block.list}
            advancedValues={advancedValues}
            themesList={themesList}
            updateThemeValue={updateThemeValue}
            fallbackName={block.fallbackName}
            shownHint={isApp ? t('ADVANCED_SHOWN_HINT_APP', 'Checked items are shown in your app.') : undefined}
          />
        )
      case 'heading':
        return <h3 key={index} className='odc-ows-subtitle'>{block.text}</h3>
      case 'image':
        return (
          <AdvancedImageField
            key={index}
            title={block.title}
            ratio={block.ratio}
            path={block.path}
            photo={getAt(advancedValues, block.path)}
            themeId={themeId}
            onChange={updateThemeValue}
          />
        )
      case 'typography':
        return (
          <FontStyleGroup
            key={index}
            fonts={getAt(advancedValues, block.path)}
            path={block.path}
            handleUpdateThemeValue={updateThemeValue}
          />
        )
      case 'favicon': {
        const uploaded = getAt(advancedValues, block.path)
        const preview = resolveEffectiveFaviconPreview(uploaded, site?.logo)
        return (
          <React.Fragment key={index}>
            {!hasCustomFavicon(uploaded) && (
              <p className='odc-ows-hint'>
                {t('FAVICON_OPTIONAL_HINT', 'Optional. If you do not upload a custom favicon, the site logo is used in the browser tab.')}
              </p>
            )}
            <AdvancedImageField
              title={block.title}
              ratio={block.ratio}
              path={block.path}
              photo={uploaded}
              themeId={themeId}
              onChange={updateThemeValue}
            />
            {preview && (
              <div className='odc-ows-row'>
                <img src={preview} alt={t('FAVICON_PREVIEW', 'Favicon preview')} width={32} height={32} />
                <p className='odc-ows-hint'>{t('FAVICON_PREVIEW_HINT', 'Currently looks like this.')}</p>
              </div>
            )}
          </React.Fragment>
        )
      }
      case 'order_types':
        return (
          <React.Fragment key={index}>
            <TextField
              label={block.titleField.label}
              value={getAt(advancedValues, block.titleField.path) ?? ''}
              onChange={(next) => updateThemeValue(next, block.titleField.path)}
            />
            {block.types.map((type) => {
              const typePath = `${block.path}.components.${type.key}.components`
              return (
                <React.Fragment key={type.key}>
                  <h3 className='odc-ows-subtitle'>{type.title}</h3>
                  <OrderType
                    typeValues={getAt(advancedValues, typePath)}
                    path={typePath}
                    handleUpdateThemeValue={updateThemeValue}
                    themesList={themesList}
                  />
                </React.Fragment>
              )
            })}
          </React.Fragment>
        )
      case 'app_design':
        // what LayoutStyleGroup did: «Original» until a layout is chosen, and the choice is written at `<path>.type`
        return (
          <RadioGroup
            key={index}
            label={block.label}
            hideLabel
            options={block.options}
            value={getAt(advancedValues, `${block.path}.type`) || 'original'}
            onValueChange={(next) => updateThemeValue(next, `${block.path}.type`)}
          />
        )
      default:
        return null
    }
  }

  // The images (AdvancedImageField, and the legacy order types: OrderType → ImageBox) read their format from this context, as in
  // AdvancedSettings: a website's, or ImageBox's own for an app.
  return (
    <ImageFormatContext.Provider value={isApp ? IMAGE_BOX_FORMAT : WEBSITE_IMAGE_FORMAT}>
      <div className='odc-ows-form'>
        {section.blocks.map(renderBlock)}
      </div>
    </ImageFormatContext.Provider>
  )
}

/** `{ [id]: Component }` for the registry of sections (sections.js): the Advanced section of each id, with the props of the editor. */
export const ADVANCED_COMPONENTS = Object.fromEntries(ADVANCED_SECTION_IDS.map((id) => {
  const Component = (props) => <AdvancedSection sectionId={id} {...props} />
  Component.displayName = `AdvancedSection(${id})`
  return [id, Component]
}))
