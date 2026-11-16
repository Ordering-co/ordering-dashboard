import React, { useId, useState } from 'react'

import { useLanguage } from '../../../../../../index'
import { Button, Dialog } from '../../../Shared/Product'
import { ColorField } from '../../../Shared/Product/ColorField'
import { ContentForm } from '../../ContentForm'
import { DEFAULT_PAGE_BACKGROUND } from '../../AdvancedSettings/themeDefaults'
import { setThemePath } from './themeDraft'

// redesign ordering-website B3b (D7): Website › Colors & content. The two colors of the website and its two rich-text
// contents (homepage and footer). The same values and writes as the legacy editor's «Theme Settings» block (OW: 929-979, 1035-1064):
// `theme_settings.style.background_page` and `.primary_btn_color`, and `theme_settings.values.homepage_content` / `.footer_content`.
// The color fields are not disabled (M-14 does not apply). Each content opens ContentForm (RichHtmlEditor, Accept and Delete, unchanged)
// in a dialog that names it, so ContentForm is asked not to paint its own title (`hideTitle`).

export const ColorsContentSection = (props) => {
  const { themeValues, setThemeValues } = props

  const [, t] = useLanguage()
  const ids = useId()
  const [editing, setEditing] = useState(null)

  const style = themeValues?.theme_settings?.components?.style
  const values = themeValues?.theme_settings?.components?.values

  const writeStyle = (block, color) => setThemeValues(setThemePath(themeValues, 'theme_settings', `style.${block}`, color))
  // `handleChangeContent` of the legacy editor
  const handleChangeContent = (type, content) => setThemeValues(setThemePath(themeValues, 'theme_settings', `values.${type}`, content))

  const contents = [
    {
      type: 'homepage_content',
      label: t('HOMEPAGE_CONTENT', 'Homepage Content'),
      dialogTitle: t('HOME_PAGE_CONTENT', 'Home Page Content')
    },
    {
      type: 'footer_content',
      label: t('FOOTER_CONTENT', 'Footer Content'),
      dialogTitle: t('FOOTER', 'Footer')
    }
  ]

  return (
    <div className='odc-ows-form'>
      <div className='odc-ows-pair'>
        <ColorField
          label={t('BACKGROUND_COLOR', 'Background color')}
          value={style?.background_page ?? DEFAULT_PAGE_BACKGROUND}
          onChange={(color) => writeStyle('background_page', color)}
        />
        <ColorField
          label={t('PRIMARY_COLOR_BUTTONS', 'Primary Color for Buttons')}
          value={style?.primary_btn_color}
          onChange={(color) => writeStyle('primary_btn_color', color)}
        />
      </div>

      <div className='odc-ows-pair'>
        {contents.map((content) => (
          <div key={content.type} className='odc-ows-row' role='group' aria-labelledby={`${ids}-${content.type}`}>
            <p id={`${ids}-${content.type}`} className='odc-ows-label'>{content.label}</p>
            <div className='odc-ows-actions'>
              <Button aria-label={`${t('EDIT', 'Edit')} ${content.label}`} onClick={() => setEditing(content.type)}>
                {t('EDIT', 'Edit')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {contents.map((content) => (
        <Dialog
          key={content.type}
          open={editing === content.type}
          onOpenChange={(open) => setEditing(open ? content.type : null)}
          title={content.dialogTitle}
          closeLabel={t('CLOSE', 'Close')}
          size='lg'
          className='odc-ows-content-dialog'
        >
          <ContentForm
            title={content.dialogTitle}
            hideTitle
            content={values?.[content.type]}
            onClose={() => setEditing(null)}
            handleChangeContent={handleChangeContent}
            type={content.type}
          />
        </Dialog>
      ))}
    </div>
  )
}
