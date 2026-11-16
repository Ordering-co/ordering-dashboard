import React, { useEffect, useMemo, useState } from 'react'
import { EnterprisePromotionSpecficCategory } from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionSpecficCategory'
import { EnterprisePromotionSpecficProducts } from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionSpecficProducts'
import storeLogo from '../../../src/assets/images/dummies/store.png'

const promotionState = { promotion: { id: 700, businesses: [{ id: 701 }], categories: [], products: [] } }
const businessesList = { businesses: [{ id: 701, slug: 'fixture-store', name: 'Fixture store', logo: storeLogo, city: { name: 'Northport' } }], loading: false }
const formState = { changes: {} }
const categories = [
  { id: 20, name: 'Disabled top category', rank: 0, enabled: false, products: [{ id: 201, name: 'Disabled-top product', enabled: true }], subcategories: [] },
  {
    id: 10,
    name: 'Root category',
    rank: 1,
    enabled: true,
    products: [{ id: 101, name: 'Root product', enabled: true }, { id: 102, name: 'Disabled product', enabled: false }],
    subcategories: [
      {
        id: 11,
        name: 'Child category',
        rank: 1,
        enabled: true,
        products: [{ id: 103, name: 'Child product', enabled: true }],
        subcategories: [
          { id: 12, name: 'Nested category', rank: 1, enabled: false, products: [{ id: 104, name: 'Nested product', enabled: true }], subcategories: [] }
        ]
      }
    ]
  }
]

const BusinessProductsListing = ({ UIComponent, ...props }) => {
  const businessState = useMemo(() => ({ loading: false, business: { id: 701, categories: structuredClone(categories) } }), [props.slug])
  return <UIComponent {...props} businessState={businessState} />
}

export const TreeConsumersFixture = () => {
  const [categoryIds, setCategoryIds] = useState({})
  const [productIds, setProductIds] = useState({})
  const [categoryPayload, setCategoryPayload] = useState(null)
  const [productPayload, setProductPayload] = useState(null)
  const [done, setDone] = useState([])
  globalThis.__OD_TREE_CONSUMER_CONTROLLERS__ = { BusinessProductsListing }
  useEffect(() => () => { delete globalThis.__OD_TREE_CONSUMER_CONTROLLERS__ }, [])
  return (
    <main style={{ padding: 16, display: 'grid', gap: 24, maxWidth: '100%' }}>
      <section data-testid='category-tree-consumer' style={{ maxWidth: 720 }}>
        <EnterprisePromotionSpecficCategory promotionState={promotionState} businessesList={businessesList} formState={formState} selectedCategoryIds={categoryIds} setSelectedCategoryIds={setCategoryIds} handleChangeItem={setCategoryPayload} onClickDone={(...args) => setDone(previous => [...previous, ['category', args]])} />
        <output data-testid='category-condition-payload' style={{ overflowWrap: 'anywhere' }}>{JSON.stringify(categoryPayload)}</output>
      </section>
      <section data-testid='product-tree-consumer' style={{ maxWidth: 720 }}>
        <EnterprisePromotionSpecficProducts promotionState={promotionState} businessesList={businessesList} formState={formState} selectedProductsIds={productIds} setSelectedProductsIds={setProductIds} handleChangeItem={setProductPayload} onClickDone={(...args) => setDone(previous => [...previous, ['product', args]])} />
        <output data-testid='product-condition-payload' style={{ overflowWrap: 'anywhere' }}>{JSON.stringify(productPayload)}</output>
      </section>
      <output data-testid='tree-consumer-done'>{JSON.stringify(done)}</output>
    </main>
  )
}
