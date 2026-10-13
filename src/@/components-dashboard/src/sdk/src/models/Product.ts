import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface ProductProps {
  id?: number
  name?: string
  price?: number
  description?: string
  images?: string
  sku?: string
  category_id?: number
  inventoried?: boolean
  quantity?: number
  featured?: boolean
  enabled?: boolean
  upselling?: boolean
  in_offer?: boolean
  offer_price?: number
  rank?: number
  [metadata: string]: any
}

export class Product extends Model implements ModelProps {
  public id: number
  public name: string
  public price: number
  public description: string
  public images: string
  public sku: string
  public category_id: number
  public inventoried: boolean
  public quantity: number
  public featured: boolean
  public enabled: boolean
  public upselling: boolean
  public in_offer: boolean
  public offer_price: number
  public rank: number
  [metadata: string]: any

  constructor (product: ProductProps = {}, api: TypeApi = null) {
    super(product, api)
    Object.entries(product).map(([key, value]) => {
      this[key] = value
    })
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }
}
