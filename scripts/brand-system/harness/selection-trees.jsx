import React, { useState } from 'react'

import { SelectBusinessCategories } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SelectBusinessCategories'
import { SelectBusinessProducts } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SelectBusinessProducts'

const rawImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzOCIgaGVpZ2h0PSIzOCI+PHJlY3Qgd2lkdGg9IjM4IiBoZWlnaHQ9IjM4IiByeD0iOCIgZmlsbD0iIzI2NkRGMCIvPjwvc3ZnPg=='
const categoryTree = [
  {
    id: 40,
    name: 'Disabled top category',
    rank: 1,
    enabled: false,
    products: [{ id: 4001, name: 'Disabled branch product', enabled: true }],
    subcategories: []
  },
  {
    id: 10,
    name: 'Root category with an exceptionally long localized display name',
    rank: 2,
    enabled: true,
    products: [
      { id: 1001, name: 'Immediate enabled product', enabled: true, images: rawImage },
      { id: 1002, name: 'Immediate disabled product', enabled: false }
    ],
    subcategories: [
      {
        id: 20,
        name: 'Nested disabled category',
        rank: 1,
        enabled: false,
        products: [{ id: 2001, name: 'Nested enabled product', enabled: true }],
        subcategories: [{
          id: 30,
          name: 'Third-level category',
          rank: 1,
          enabled: true,
          products: [{ id: 3001, name: 'Third-level product with an exceptionally long localized display name', enabled: true }],
          subcategories: []
        }]
      },
      { id: 21, name: 'Second nested category', rank: 2, enabled: true, products: [], subcategories: [] }
    ]
  },
  {
    id: 50,
    name: 'Enabled category with disabled-only immediate product',
    rank: 3,
    enabled: true,
    products: [{ id: 5001, name: 'Invisible disabled product counted for visibility', enabled: false }],
    subcategories: []
  }
]

const populatedState = { business: { categories: categoryTree }, loading: false }
const loadingState = { business: { categories: [] }, loading: true }
const emptyState = { business: { categories: [] }, loading: false }

const Section = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='tree-fixture-section'>
    <h2>{label}</h2>
    {children}
  </section>
)
const Cell = ({ children, label, testId }) => (
  <fieldset data-testid={testId} className='tree-fixture-cell'>
    <legend>{label}</legend>
    {children}
  </fieldset>
)

const CategoryCases = () => {
  const [selected, setSelected] = useState({
    21: { id: 21, include: false },
    900: { id: 900, include: true }
  })
  const apply = value => setSelected(value)
  return (
    <Section label='Category selection trees' testId='category-cases'>
      <div className='tree-fixture-grid'>
        <Cell label='Include categories' testId='categories-include'>
          <SelectBusinessCategories include selectedCategoryIds={selected} setSelectedCategoryIds={apply} fixtureBusinessState={populatedState} fixtureControllerId='categories-include' />
        </Cell>
        <Cell label='Exclude categories' testId='categories-exclude'>
          <SelectBusinessCategories include={false} selectedCategoryIds={selected} setSelectedCategoryIds={apply} fixtureBusinessState={populatedState} fixtureControllerId='categories-exclude' />
        </Cell>
        <Cell label='Loading categories' testId='categories-loading'>
          <SelectBusinessCategories include selectedCategoryIds={{}} setSelectedCategoryIds={() => {}} fixtureBusinessState={loadingState} fixtureControllerId='categories-loading' />
        </Cell>
        <Cell label='Empty categories' testId='categories-empty'>
          <SelectBusinessCategories include selectedCategoryIds={{}} setSelectedCategoryIds={() => {}} fixtureBusinessState={emptyState} fixtureControllerId='categories-empty' />
        </Cell>
      </div>
      <button data-fixture-control type='button' onClick={() => globalThis.__OD_TREE_INITIAL_RENDER_HANDLERS__?.['categories-include']?.(true)}>Update category initial render</button>
      <output data-testid='selected-categories'>{JSON.stringify(selected)}</output>
    </Section>
  )
}

const ProductCases = () => {
  const [selected, setSelected] = useState({
    2001: { id: 2001, include: false },
    9001: { id: 9001, include: true }
  })
  const apply = value => setSelected(value)
  return (
    <Section label='Product selection trees' testId='product-cases'>
      <div className='tree-fixture-grid'>
        <Cell label='Include products' testId='products-include'>
          <SelectBusinessProducts include selectedProductsIds={selected} setSelectedProductsIds={apply} fixtureBusinessState={populatedState} fixtureControllerId='products-include' />
        </Cell>
        <Cell label='Exclude products' testId='products-exclude'>
          <SelectBusinessProducts include={false} selectedProductsIds={selected} setSelectedProductsIds={apply} fixtureBusinessState={populatedState} fixtureControllerId='products-exclude' />
        </Cell>
        <Cell label='Loading products' testId='products-loading'>
          <SelectBusinessProducts include selectedProductsIds={{}} setSelectedProductsIds={() => {}} fixtureBusinessState={loadingState} fixtureControllerId='products-loading' />
        </Cell>
        <Cell label='Empty products' testId='products-empty'>
          <SelectBusinessProducts include selectedProductsIds={{}} setSelectedProductsIds={() => {}} fixtureBusinessState={emptyState} fixtureControllerId='products-empty' />
        </Cell>
      </div>
      <button data-fixture-control type='button' onClick={() => globalThis.__OD_TREE_INITIAL_RENDER_HANDLERS__?.['products-include']?.(true)}>Update product initial render</button>
      <output data-testid='selected-products'>{JSON.stringify(selected)}</output>
    </Section>
  )
}

export const SelectionTreesFixture = () => (
  <main data-testid='selection-trees-fixture' className='selection-trees-fixture'>
    <style>{`
      .selection-trees-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
      .selection-trees-fixture * { box-sizing: border-box; }
      .selection-trees-fixture > h1, .tree-fixture-section > h2 { margin: 0; }
      .tree-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; }
      .tree-fixture-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); min-width: 0; }
      .tree-fixture-cell { border: 1px dashed currentColor; min-width: 0; padding: 12px; }
      .tree-fixture-cell legend { font-size: 14px; padding-inline: 6px; }
      .selection-trees-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
      .selection-trees-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; white-space: normal; }
      @media (max-width: 420px) { .selection-trees-fixture { gap: 12px; padding: 12px; } .tree-fixture-section { padding: 12px; } }
    `}</style>
    <h1>Ordering.co category and product selection trees</h1>
    <CategoryCases />
    <ProductCases />
  </main>
)
