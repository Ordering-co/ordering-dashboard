import React from 'react'
import styled from 'styled-components'
import { useLanguage } from '../../../../../index'

// redesign apply-list row 23 (appointments P-2): the professional filter of the toolbar, a native <select> named «Professional» whose first
// option is «All professionals». `professional` is `{ options: [{ value, label }], value, onChange(value) }`, `value` '' being All.
// Tokens only, the box of the segmented control's select fallback (product `.odc-seg-select`): 32px seen, a 44px box on a phone or a
// coarse pointer (a select cannot hold a pseudo-element). It is always a row of its own under the bar (review J4 #1: beside the views it
// took the room of the empty-period notice, which then ended in an ellipsis even with no filter): up to 16rem wide on a desktop, the
// whole row below 768px.
const Wrapper = styled.div`
  order: 2;
  flex: 1 0 100%;
  min-inline-size: 0;

  select {
    inline-size: min(16rem, 100%);
    block-size: var(--od-x-control-height);
    margin: 0;
    padding-inline: var(--od-space-3);
    border: var(--od-x-hairline) solid var(--od-border);
    border-radius: var(--od-radius-component);
    background: var(--od-bg);
    color: var(--od-text);
    font-family: var(--od-font-sans);
    font-size: var(--od-type-control-size);
    font-weight: var(--od-font-weight-medium);
    line-height: var(--od-x-leading-ui);
    text-overflow: ellipsis;
    cursor: pointer;
  }

  select:focus-visible {
    outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color);
    outline-offset: var(--od-focus-ring-offset);
  }

  @media (pointer: coarse), (max-width: 767px) {
    select {
      block-size: var(--od-x-target-coarse);
    }
  }

  @media (max-width: 767px) {
    select {
      inline-size: 100%;
    }
  }
`

export const ProfessionalSelect = ({ professional }) => {
  const [, t] = useLanguage()
  return (
    <Wrapper>
      <select
        aria-label={t('PROFESSIONAL', 'Professional')}
        value={professional.value}
        onChange={event => professional.onChange(event.target.value)}
      >
        <option value=''>{t('APPOINTMENTS_ALL_PROFESSIONALS', 'All professionals')}</option>
        {professional.options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Wrapper>
  )
}
