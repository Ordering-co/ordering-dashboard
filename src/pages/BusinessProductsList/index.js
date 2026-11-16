import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useApi, useEvent } from '~components'
import { BusinessProductsListing, capitalize } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'

export const BusinessProductsList = (props) => {
  const { store } = useParams()
  const [ordering] = useApi()
  const { search } = useLocation()

  // redesign Tiendas 1.F (G5-49): by name, so the store editor's `?id=` is never a category or a product
  const query = new URLSearchParams(search)
  const categoryId = query.get('category') || undefined
  const productId = query.get('product') || undefined
  const [events] = useEvent()

  const businessProductsProps = {
    ...props,
    ordering,
    isSearchByName: true,
    isSearchByDescription: true,
    slug: store,
    categoryId,
    productId,
    handleStoresRedirect: () => {
      events.emit('go_to_page', { page: 'businesses' })
    },
    onProductRedirect: ({ slug, category, product }) => {
      if (!category && !product) {
        return events.emit('go_to_page', { page: 'store', params: { store: slug }, replace: true })
      }
      if (category && !product) {
        return events.emit('go_to_page', {
          page: 'store',
          params: { store: slug },
          search: `category=${category}`,
          replace: true
        })
      }
      // bugs E SP-20: the initial render of a deep link asks for the product the address already has. Rebuilding the search from
      // category and product alone dropped `section` and `tab` (and any other param) before the panel read them on mount, so the product opened
      // in Overview. When the address is already on this category and product, the rest of it is kept; another product (a click in the list)
      // is rebuilt with category and product only, as before, so the sections of the previous one do not follow it.
      const isSameProductAsUrl = String(category) === query.get('category') && String(product) === query.get('product')
      if (isSameProductAsUrl) {
        const kept = new URLSearchParams()
        kept.set('category', category)
        kept.set('product', product)
        query.forEach((value, key) => {
          if (key !== 'category' && key !== 'product') kept.append(key, value)
        })
        return events.emit('go_to_page', {
          page: 'store',
          params: { store: slug },
          // no leading `?`: the route string of the store page still ends in the `?` of its optional param (ListenPageChanges)
          search: kept.toString(),
          replace: true
        })
      }
      return events.emit('go_to_page', {
        page: 'store',
        params: { store: slug },
        search: `category=${category}&product=${product}`,
        replace: true
      })
    }
  }

  return (
    <>
      <HelmetTags page='store' helmetTitle={store ? capitalize(store) : undefined} />
      <BusinessProductsListing {...businessProductsProps} />
    </>
  )
}
