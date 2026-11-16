import React from 'react'

// redesign stores 5.15b (G5-15): a schematic of each website layout, drawn with blocks (decorative: the card's label
// and description say what it is; P/RadioGroup hides it from assistive tech). Same idea as main's drawings, fewer pieces:
// Food = categories along the top, a two-column product list and the cart beside it; Groceries = a hero with the logo and cart,
// a side list of parent categories and a product grid.

const Lines = ({ count, className }) => [...Array(count).keys()].map(i => <span key={i} className={className} />)

export const LayoutPreview = ({ kind }) => (
  <span className='odc-layout-preview' data-kind={kind}>
    <span className='odc-layout-preview-bar' />
    <span className='odc-layout-preview-hero'>
      {kind === 'groceries' && <span className='odc-layout-preview-logo' />}
      {kind === 'groceries' && <span className='odc-layout-preview-hero-cart' />}
    </span>
    <span className='odc-layout-preview-heading' />
    {kind === 'food'
      ? (
        <>
          <span className='odc-layout-preview-chips'><Lines count={5} className='odc-layout-preview-chip' /></span>
          <span className='odc-layout-preview-body'>
            <span className='odc-layout-preview-list'><Lines count={6} className='odc-layout-preview-product' /></span>
            <span className='odc-layout-preview-cart' />
          </span>
        </>
        )
      : (
        <span className='odc-layout-preview-body'>
          <span className='odc-layout-preview-side'><Lines count={6} className='odc-layout-preview-side-item' /></span>
          <span className='odc-layout-preview-grid'><Lines count={9} className='odc-layout-preview-product' /></span>
        </span>
        )}
  </span>
)
