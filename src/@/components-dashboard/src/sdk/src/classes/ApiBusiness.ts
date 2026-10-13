import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { RequestOptionsBusinessProps } from '../interfaces/RequestOptionsBusinessProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Business, BusinessProps } from '../models/Business'
import { ApiCategory } from './ApiCategory'
import { ApiMenu } from './ApiMenu'
import { Product } from '../models/Product'
import { ApiBusinessProduct } from './ApiBusinessProduct'

/**
 * Class to configs api control
 */
export class ApiBusiness extends ApiBase implements ApiBaseInterface {
  private businessId: number | string

  constructor (ordering: Ordering, businessId: number | string) {
    super(ordering)
    this.businessId = businessId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.businessId = id
  }

  /**
   * Get a business if businessId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsBusinessProps = {}) {
    if (this.businessId && this.conditions) {
      throw new Error('The `where` function is not compatible with businesses(businessId). Example ordering.businesses().where(contitions).get()')
    }
    const url = options.advancedSearch ? '/search' : ('/business' + (this.businessId ? `/${this.businessId}` : ''))
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Business, options)
    const { content: { error, result } } = response
    if (!error && !this.businessId) {
      this.businessId = result.id
    }
    return response
  }

  /**
   * Update a business if configId is set else create business
   * @param {BusinessProps} business Attributes to create or update business
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (business: BusinessProps, options: RequestOptionsProps = {}) {
    const url = '/business' + (this.businessId ? `/${this.businessId}` : '')
    const response: ApiResponse = await this.makeRequest('POST', url, business, Business, options)
    const { content: { error, result } } = response
    if (!error && !this.businessId) {
      this.businessId = result.id
    }
    return response
  }

  /**
   * Delete a business by configId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to delete. Example: ordering.businesses(businessId).delete()')
    }
    const url = `/business/${this.businessId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, null, options)
    return response
  }

  async validateCart (cart: any, options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to validateCart. Example: ordering.businesses(businessId).validateCart(cart)')
    }
    const url = `/business/${this.businessId}/validate_cart`
    const response: ApiResponse = await this.makeRequest('GET', url, cart, undefined, options)
    return response
  }

  /**
   * Return products api
   */
  products () {
    if (!this.businessId) {
      throw new Error('`businessId` is require to products. Example: ordering.businesses(businessId).products().get()')
    }
    if (typeof this.businessId !== 'number') {
      throw new Error('`businessId` must be a number to use API menus. Example: ordering.businesses(businessId).products().get()')
    }
    return new ApiBusinessProduct(this.ordering, this.businessId)
    // return {
    //   get: async (options: RequestOptionsProps = {}) => {
    //     const url = `/business/${this.businessId}/products`
    //     const response: ApiResponse = await this.makeRequest('GET', url, undefined, Product, options)
    //     return response
    //   }
    // }
  }

  /**
   * Return categories api
   * @param {number} categoryId Category id is optional
   */
  categories (categoryId: number) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to use API categories. Example: ordering.businesses(businessId).categories().get()')
    }
    if (typeof this.businessId !== 'number') {
      throw new Error('`businessId` must be a number to use API categories. Example: ordering.businesses(businessId).categories().get()')
    }
    return new ApiCategory(this.ordering, this.businessId, categoryId)
  }

  /**
   * Return menus api
   * @param {number} menuId Menu id is optional
   */
  menus (menuId: number) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to use API menus. Example: ordering.businesses(businessId).menus().get()')
    }
    if (typeof this.businessId !== 'number') {
      throw new Error('`businessId` must be a number to use API menus. Example: ordering.businesses(businessId).menus().get()')
    }
    return new ApiMenu(this.ordering, this.businessId, menuId)
  }
}
