import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'
import { Product } from './Product'

export interface CategoryProps {
  id?: number
  business_id?: string
  name?: string
  image?: string
  rank?: string
  enabled?: string
  products?: Product[]
  [metadata: string]: any
}

export class Category extends Model implements ModelProps {
  public id: number
  public business_id: string
  public name: string
  public image: string
  public rank: string
  public enabled: string
  public products: Product[]
  [metadata: string]: any

  constructor (category: CategoryProps = {}, api: TypeApi = null) {
    super(category, api)
    Object.entries(category).map(([key, value]) => {
      this[key] = value
    })
    this.products = this.products?.map(product => new Product(product))
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }
}
