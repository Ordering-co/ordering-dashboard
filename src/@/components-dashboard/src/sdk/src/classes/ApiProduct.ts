import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Product, ProductProps } from '../models/Product'

/**
 * Class to product api control
 */
export class ApiProduct extends ApiBase implements ApiBaseInterface {
  public businessId: number
  public categoryId: number
  public productId: number | null

  constructor (ordering: Ordering, businessId: number, categoryId: number, productId: number | null = null) {
    super(ordering)
    this.ordering = ordering
    this.businessId = businessId
    this.categoryId = categoryId
    this.productId = productId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.productId = id
  }

  /**
   * Get a product if productId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('You must provide the `businessId` param. Example ordering.businesses(businessId).categories(categoryId).products(productId?).get()')
    }
    if (this.productId && this.conditions) {
      throw new Error('The `where` function is not compatible with businesses(businessId).categories(categoryId).products(productId). Example ordering.businesses(businessId).categories(categoryId).products().where(contitions).get()')
    }
    const url = `/business/${this.businessId}/categories/${this.categoryId}/products` + (this.productId ? `/${this.productId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Product, options)
    return response
  }

  /**
   * Update a product if productId is set else create product
   * @param {ProductProps} product Attributes to create or update product
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (product: ProductProps, options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('You must provide the `businessId` param. Example ordering.businesses(businessId).categories(categoryId).products(productId?).save(changes)')
    }
    const url = `/business/${this.businessId}/categories/${this.categoryId}/products` + (this.productId ? `/${this.productId}` : '')
    const response: ApiResponse = await this.makeRequest('POST', url, product, Product, options)
    const { content: { error, result } } = response
    if (!error && !this.productId) {
      this.productId = result.id
    }
    return response
  }

  /**
   * Delete a product by productId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to delete. Example: ordering.businesses(businessId).categories(categoryId).products(productId).delete()')
    }
    if (!this.categoryId) {
      throw new Error('`categoryId` is require to delete. Example: ordering.businesses(businessId).categories(categoryId).products(productId).delete()')
    }
    if (!this.productId) {
      throw new Error('`productId` is require to delete. Example: ordering.businesses(businessId).categories(categoryId).products(productId).delete()')
    }

    const url = `/business/${this.businessId}/categories/${this.categoryId}/products/${this.productId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, Product, options)
    return response
  }
}
