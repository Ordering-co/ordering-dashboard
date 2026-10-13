import styled, { css } from 'styled-components'

const primary = p => p.theme.colors?.primary || '#266DF0'
const text = p => p.theme.colors?.headingColor || '#0B0C0D'
const muted = p => p.theme.colors?.lightGray || '#3F4145'
const border = p => p.theme.colors?.borderColor || '#DEE0E3'
const surface = p => p.theme.colors?.backgroundPage || '#FFFFFF'
const subtle = p => p.theme.colors?.secundary || '#F6F7F7'
const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${primary};
    outline-offset: 2px;
  }
`

export const JourneysContainer = styled.div`
  width: 100%;
  min-width: 0;
  max-width: 1180px;
  padding: 20px 20px 40px;
  color: ${text};
  box-sizing: border-box;
  @media (max-width: 480px) { padding: 16px 12px 32px; }
`

export const Hero = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  h2 { margin: 0 0 4px; color: ${text}; font-size: 20px; font-weight: 600; line-height: 1.3; }
  p { max-width: 680px; margin: 0; color: ${muted}; font-size: 14px; line-height: 1.5; }
  @media (max-width: 600px) { flex-direction: column; }
`

export const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`

export const TemplateCard = styled.button`
  display: grid;
  min-width: 0;
  min-height: 124px;
  grid-template-columns: minmax(0, 1fr) 112px;
  padding: 0;
  border: 1px solid ${border};
  border-radius: 6px;
  background: ${surface};
  color: ${text};
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${p => p.disabled ? 0.55 : 1};
  overflow: hidden;
  text-align: left;
  transition: border-color 180ms ease, box-shadow 180ms ease;
  ${focusRing}
  &:hover:not(:disabled) { border-color: ${primary}; box-shadow: 0 2px 8px rgba(11, 12, 13, 0.08); }
  @media (max-width: 420px) { min-height: 116px; grid-template-columns: minmax(0, 1fr) 84px; }
  @media (prefers-reduced-motion: reduce) { transition: none; }
`

export const TemplateContent = styled.span`
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
  h3 { margin: 0 0 6px; color: ${text}; font-size: 15px; font-weight: 600; line-height: 1.35; }
  p { margin: 0 0 8px; color: ${muted}; font-size: 13px; line-height: 1.45; }
`

export const TemplateMeta = styled.span`
  color: ${muted};
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
`

export const TemplateVisual = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid ${border};
  background: ${subtle};
  color: ${primary};
  > svg { width: 24px; height: 24px; }
`

export const TemplateAction = styled.span`
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid ${border};
  border-radius: 4px;
  background: ${surface};
  color: ${text};
  svg { width: 16px; height: 16px; }
`

export const Section = styled.section`
  margin-top: 32px;
  > h2 { margin: 0 0 4px; color: ${text}; font-size: 18px; font-weight: 600; }
  > p { margin: 0 0 14px; color: ${muted}; font-size: 14px; line-height: 1.5; }
`

export const PromotionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`

export const PromotionCard = styled.article`
  min-width: 0;
  padding: 16px;
  border: 1px solid ${border};
  border-radius: 6px;
  background: ${surface};
  header { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h3 { min-width: 0; margin: 2px 0 0; color: ${text}; font-size: 14px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  > p {
    display: -webkit-box;
    min-height: 40px;
    margin: 10px 0;
    color: ${muted};
    font-size: 13px;
    line-height: 1.5;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`

export const PromotionControls = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
`

export const Status = styled.span`
  padding: 3px 7px;
  border-radius: 4px;
  background: ${p => p.active ? '#E7F7ED' : subtle(p)};
  color: ${p => p.active ? '#176B3A' : muted(p)};
  font-size: 11px;
  font-weight: 600;
`

export const PromotionToggle = styled.label`
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  span {
    position: relative;
    width: 30px;
    height: 18px;
    border-radius: 9px;
    background: #A7ABB1;
    transition: background 180ms ease;
    &::after {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 1px 2px rgba(11, 12, 13, 0.22);
      content: '';
      transition: transform 180ms ease;
    }
  }
  input:checked + span { background: ${primary}; }
  input:checked + span::after { transform: translateX(12px); }
  input:focus-visible + span { outline: 2px solid ${primary}; outline-offset: 2px; }
  input:disabled + span { cursor: wait; opacity: 0.55; }
  @media (prefers-reduced-motion: reduce) { span, span::after { transition: none; } }
`

export const PromotionAction = styled.button`
  min-height: 44px;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: ${primary};
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  ${focusRing}
  svg { margin-left: 4px; vertical-align: -2px; }
`

export const PromotionCardActions = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const PromotionDeleteAction = styled(PromotionAction)`
  color: ${props => props.theme.colors?.danger || '#C8323E'};
  svg {
    margin: 0 4px 0 0;
    vertical-align: -2px;
  }
  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }
`

export const PromotionPagination = styled.nav`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
  color: ${muted};
  font-size: 13px;
  @media (max-width: 480px) { justify-content: space-between; }
`

export const Builder = styled.section`
  border: 1px solid ${border};
  border-radius: 10px;
  background: ${surface};
  overflow: hidden;
`

export const BuilderHeader = styled.header`
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid ${border};
  h2 { margin: 0 0 2px; color: ${text}; font-size: 18px; font-weight: 600; }
  p { margin: 0; color: ${muted}; font-size: 13px; }
`

export const CloseButton = styled.button`
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${text};
  cursor: pointer;
  ${focusRing}
  &:hover:not(:disabled) { background: ${subtle}; }
`

export const BuilderBody = styled.div`
  padding: 20px;
  @media (max-width: 480px) { padding: 16px; }
`

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`

export const Field = styled.label`
  display: flex;
  min-width: 0;
  grid-column: ${p => p.full ? '1 / -1' : 'auto'};
  flex-direction: column;
  gap: 6px;
  color: ${text};
  font-size: 13px;
  font-weight: 600;
  input, select, textarea {
    width: 100%;
    min-height: 44px;
    padding: 9px 11px;
    border: 1px solid ${p => p.error ? '#C8323E' : border(p)};
    border-radius: 6px;
    background: ${surface};
    color: ${text};
    box-sizing: border-box;
    font: inherit;
    font-size: 14px;
    font-weight: 400;
  }
  input[type='number'] { appearance: textfield; -moz-appearance: textfield; }
  input[type='number']::-webkit-inner-spin-button, input[type='number']::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
    -webkit-appearance: none;
  }
  textarea { min-height: 92px; resize: vertical; }
  input:focus, select:focus, textarea:focus {
    border-color: ${primary};
    outline: 2px solid ${p => `${primary(p)}33`};
    outline-offset: 1px;
  }
`

export const FieldHint = styled.span`
  color: ${muted};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
`

export const UnavailableNotice = styled.div`
  padding: 10px 12px;
  border: 1px solid ${border};
  border-inline-start: 3px solid ${primary};
  border-radius: 6px;
  background: ${subtle};
  color: ${muted};
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
`
export const ErrorText = styled.span`color: #B4232D; font-size: 12px; font-weight: 500;`

export const ScopeBox = styled.div`
  grid-column: 1 / -1;
  padding: 16px;
  border: 1px solid ${p => p.error ? '#C8323E' : border(p)};
  border-radius: 6px;
  background: ${surface};
  > h3 { margin: 0 0 4px; color: ${text}; font-size: 14px; font-weight: 600; }
  > p { margin: 0 0 12px; color: ${muted}; font-size: 13px; line-height: 1.45; }
`

export const ScopeMode = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`

export const ScopeModeButton = styled.button`
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 11px;
  border: 1px solid ${p => p.active ? primary(p) : border(p)};
  border-radius: 6px;
  background: ${p => p.active ? `${primary(p)}0D` : surface(p)};
  color: ${text};
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  ${focusRing}
`

export const BusinessList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`

export const BusinessOption = styled.label`
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid ${p => p.selected ? primary(p) : border(p)};
  border-radius: 6px;
  background: ${p => p.selected ? `${primary(p)}0D` : surface(p)};
  color: ${text};
  cursor: pointer;
  font-size: 13px;
  input { width: 18px; height: 18px; accent-color: ${primary}; }
`

export const ChoiceGroup = styled.div`
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  color: ${muted};
  font-size: 13px;
  span { min-width: 40px; text-align: center; }
`
export const ScopeHint = styled.p`margin: 8px 0 0 !important; color: ${muted}; font-size: 12px !important;`
export const CheckGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  label { display: flex; min-height: 44px; align-items: center; gap: 8px; font-size: 13px; }
`

export const ProductPickerHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 10px;
  h4 { margin: 0 0 3px; color: ${text}; font-size: 13px; font-weight: 600; }
  p { margin: 0; color: ${muted}; font-size: 12px; line-height: 1.4; }
  p + p { margin-top: 4px; }
`

export const ProductSelectionCount = styled.span`
  flex: 0 0 auto;
  padding: 4px 7px;
  border-radius: 4px;
  background: ${subtle};
  color: ${muted};
  font-size: 11px;
  font-weight: 600;
`

export const ProductPickerSearch = styled.input`
  width: 100%;
  min-height: 44px;
  padding: 9px 11px;
  border: 1px solid ${border};
  border-radius: 6px;
  background: ${surface};
  color: ${text};
  box-sizing: border-box;
  font: inherit;
  font-size: 14px;
  &:focus {
    border-color: ${primary};
    outline: 2px solid ${p => `${primary(p)}33`};
    outline-offset: 1px;
  }
`

export const ProductList = styled.div`
  display: flex;
  width: 100%;
  min-width: 0;
  max-height: 284px;
  margin-top: 10px;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
`

export const ProductOption = styled.label`
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  padding-inline-start: ${p => p.$depth ? '30px' : '10px'};
  border: 1px solid ${p => p.selected ? primary(p) : border(p)};
  border-radius: 6px;
  background: ${p => p.selected ? `${primary(p)}0D` : surface(p)};
  color: ${text};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  input { width: 18px; height: 18px; flex: 0 0 auto; accent-color: ${primary}; }
  span { min-width: 0; flex: 1; overflow-wrap: anywhere; }
  svg { flex: 0 0 auto; color: ${primary}; }
`

export const ProductCategory = styled.div`
  min-width: 0;
  margin-inline-start: ${p => p.$depth ? '14px' : '0'};
`

export const ProductCategoryHeader = styled.div`
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 4px;
  border: 1px solid ${p => p.selected ? primary(p) : border(p)};
  border-radius: 6px;
  background: ${p => p.selected ? `${primary(p)}0D` : surface(p)};
  color: ${text};
  font-size: 13px;
  font-weight: 600;
  > span:not(:last-child) { min-width: 0; flex: 1; overflow-wrap: anywhere; }
`

export const ProductCategorySelection = styled.label`
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  cursor: ${p => p.$disabled ? 'wait' : 'pointer'};
  opacity: ${p => p.$disabled ? 0.55 : 1};
  input {
    width: 18px;
    height: 18px;
    accent-color: ${primary};
    cursor: ${p => p.$disabled ? 'wait' : 'pointer'};
  }
  input:focus-visible {
    outline: 2px solid ${primary};
    outline-offset: 2px;
  }
`

export const ProductCategoryToggle = styled.button`
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${muted};
  cursor: pointer;
  ${focusRing}
  svg {
    width: 16px;
    height: 16px;
    transform: ${p => p.theme?.rtl ? 'scaleX(-1) ' : ''}rotate(${p => p['aria-expanded'] ? '90deg' : '0deg'});
    transition: transform 160ms ease;
  }
  &:hover { background: ${subtle}; }
  @media (prefers-reduced-motion: reduce) { svg { transition: none; } }
`

export const ProductCategoryMeta = styled.span`
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${subtle};
  color: ${muted};
  font-size: 11px;
  font-weight: 600;
`

export const ProductCategoryChildren = styled.div`
  display: flex;
  min-width: 0;
  margin-top: 6px;
  flex-direction: column;
  gap: 6px;
`

export const ProductPickerEmpty = styled.div`
  margin-top: 10px;
  padding: 18px;
  border: 1px dashed ${border};
  border-radius: 6px;
  color: ${muted};
  font-size: 13px;
  text-align: center;
`

export const ProductPickerLoadMore = styled.button`
  min-height: 44px;
  margin-top: 10px;
  padding: 8px 14px;
  border: 1px solid ${border};
  border-radius: 4px;
  background: ${surface};
  color: ${text};
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  ${focusRing}
  &:disabled { cursor: wait; opacity: 0.55; }
`

export const ActionBar = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid ${border};
  > div { display: flex; gap: 8px; }
  @media (max-width: 520px) {
    align-items: stretch;
    flex-direction: column-reverse;
    > div { flex-direction: column; }
  }
`

export const ActionButton = styled.button`
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid ${p => p.primary ? primary(p) : border(p)};
  border-radius: 4px;
  background: ${p => p.primary ? primary(p) : surface(p)};
  color: ${p => p.primary ? '#FFFFFF' : text(p)};
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${p => p.disabled ? 0.55 : 1};
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  ${focusRing}
`

export const ApiError = styled.div`
  margin: 0 20px 14px;
  padding: 10px 12px;
  border: 1px solid #E49AA1;
  border-radius: 6px;
  background: #FFF2F3;
  color: #8C1D27;
  font-size: 13px;
  line-height: 1.45;
`
export const EmptyState = styled.div`
  padding: 24px;
  border: 1px dashed ${border};
  border-radius: 6px;
  color: ${muted};
  font-size: 14px;
  text-align: center;
`
