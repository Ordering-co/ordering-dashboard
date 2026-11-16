import React from 'react'

import { useLanguage } from '../../../../../index'
import { CopyButton } from '../../Shared/Product'
import './cname-record.css'

// redesign C: the record of Builder's domains and of the website migration, on P/CopyButton (it was a local copy button).

/** The CNAME record to create: `name` is its Name, or `nameHint` explains it. */
export const CnameRecord = ({ name, nameHint, target }) => {
  const [, t] = useLanguage()
  return (
    <div className='odc-root odc-cname'>
      <table>
        <thead>
          <tr>
            <th scope='col'>{t('BUILDER_DNS_TYPE', 'Type')}</th>
            <th scope='col'>{t('BUILDER_DNS_NAME', 'Name')}</th>
            <th scope='col'>{t('BUILDER_DNS_VALUE', 'Value')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>CNAME</code></td>
            <td>
              <div className='odc-cname-cell'>
                {name && <code>{name}</code>}
                {nameHint && <span className='odc-cname-hint'>{nameHint}</span>}
              </div>
            </td>
            <td>
              <div className='odc-cname-cell'>
                <code>{target}</code>
                <CopyButton
                  text={target}
                  size='sm'
                  label={t('BUILDER_COPY_VALUE', 'Copy _value_').replace('_value_', target)}
                  copyLabel={t('BUILDER_COPY', 'Copy')}
                  copiedLabel={t('BUILDER_COPIED', 'Copied')}
                  failedLabel={t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
