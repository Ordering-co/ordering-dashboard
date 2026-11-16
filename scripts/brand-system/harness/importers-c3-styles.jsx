import React from 'react'

import {
  LogisticsContainer as DGLLogisticsContainer,
  OrderStatusWrapper as DGLOrderStatusWrapper,
  RadioButton as DGLRadioButton
} from '../../../src/@/components-dashboard/src/ui/src/components/Connect/DriversGroupsLogisticsService/styles'
import {
  BoxLayout as ADVBoxLayout,
  FaviconHint as ADVFaviconHint,
  FaviconPreviewHint as ADVFaviconPreviewHint,
  FontWeightItem as ADVFontWeightItem,
  FormControl as ADVFormControl,
  HideCheckWrapper as ADVHideCheckWrapper,
  ImgInfoWrapper as ADVImgInfoWrapper,
  Option as ADVOption,
  SelectWrapper as ADVSelectWrapper,
  UploadImageIcon as ADVUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/AdvancedSettings/styles'
import {
  InputFileContainer as BASInputFileContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/BasicAppSettings/styles'
import {
  Header as CFOHeader,
  WrapperEditor as CFOWrapperEditor
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/ContentForm/styles'
import {
  Container as PBLContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/ProductsBuilderList/styles'

// Connect/Importers/GloriaFoodImportModal, Connect/Importers/MenuImportModal and Connect/ImportersPanel styles were deleted as dead code; gfi-, mim-, ipl- rows (65 -> 31 role sizes, 8 -> 6 preservations) went with them.
const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const ImportersC3StylesFixture = () => (
  <div data-testid='importers-c3-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* Connect/DriversGroupsLogisticsService */}
    <DGLLogisticsContainer data-testid='dgl-logistics-container-wrap'>
      <label data-testid='dgl-logistics-container-label'>Order status</label>
    </DGLLogisticsContainer>
    <DGLOrderStatusWrapper data-testid='dgl-order-status-wrapper-wrap'>
      <span data-testid='dgl-order-status-wrapper-span'>Accepted by Business</span>
    </DGLOrderStatusWrapper>
    <DGLRadioButton data-testid='dgl-radio-button-wrap'>
      <Glyph testid='dgl-radio-button-svg' />
    </DGLRadioButton>

    {/* MyProducts/AdvancedSettings */}
    <ADVBoxLayout data-testid='adv-box-layout-wrap'>
      <h1 data-testid='adv-box-layout-h1h2'>Homepage</h1>
      <h3 data-testid='adv-box-layout-h3'>Order block</h3>
    </ADVBoxLayout>
    <ADVHideCheckWrapper data-testid='adv-hide-check-wrapper-root'>
      <span data-testid='adv-hide-check-wrapper-span'>Successful</span>
      <Glyph testid='adv-hide-check-wrapper-svg' />
    </ADVHideCheckWrapper>
    <ADVFormControl data-testid='adv-form-control-wrap'>
      <label data-testid='adv-form-control-label'>Title Menu options</label>
    </ADVFormControl>
    <ADVSelectWrapper data-testid='adv-select-wrapper-wrap'>
      <div><div><div data-testid='adv-select-wrapper-divdivfirstchild'>Poppins</div></div></div>
    </ADVSelectWrapper>
    <ADVOption data-testid='adv-option-root'>Importers</ADVOption>
    <ADVFontWeightItem data-testid='adv-font-weight-item-root'>
      <span data-testid='adv-font-weight-item-span'>Successful</span>
      <Glyph testid='adv-font-weight-item-svg' />
    </ADVFontWeightItem>
    <ADVUploadImageIcon data-testid='adv-upload-image-icon-wrap'>
      <span data-testid='adv-upload-image-icon-span'>Successful</span>
    </ADVUploadImageIcon>
    <ADVImgInfoWrapper data-testid='adv-img-info-wrapper-wrap'>
      <h4 data-testid='adv-img-info-wrapper-h4'>Build Apps</h4>
      <p data-testid='adv-img-info-wrapper-p'>Import completed</p>
    </ADVImgInfoWrapper>
    <ADVFaviconHint data-testid='adv-favicon-hint-root'>Importers</ADVFaviconHint>
    <ADVFaviconPreviewHint data-testid='adv-favicon-preview-hint-root'>Importers</ADVFaviconPreviewHint>

    {/* MyProducts/BasicAppSettings */}
    <BASInputFileContainer data-testid='bas-input-file-container-wrap'>
      <div className='file-details'><p data-testid='bas-input-file-container-filedetailsp'>File size: 2 KB</p></div>
      <span className='drop-title' data-testid='bas-input-file-container-droptitle'>Drop file here</span>
    </BASInputFileContainer>

    {/* MyProducts/ContentForm */}
    <CFOHeader data-testid='cfo-header-wrap'>
      <h1 data-testid='cfo-header-h1'>Acme Store</h1>
    </CFOHeader>
    <CFOWrapperEditor data-testid='cfo-wrapper-editor-wrap'>

    </CFOWrapperEditor>

    {/* MyProducts/ProductsBuilderList */}
    <PBLContainer data-testid='pbl-container-root'>Importers</PBLContainer>
  </div>
)
