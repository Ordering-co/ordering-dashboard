import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Product } from '..'

/**
 * Class to category api control
 */
export class ApiBusinessProduct extends ApiBase implements ApiBaseInterface {
  public businessId: number
  public productId: number | null

  constructor (ordering: Ordering, businessId: number, productId: number | null = null) {
    super(ordering)
    this.ordering = ordering
    this.businessId = businessId
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
   * Get all products of a business
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('You must provide the `businessId` param. Example ordering.businesses(businessId).products().get()')
    }
    const url = `/business/${this.businessId}/products`
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Product, options)
    return response
  }

  save (_changes: any, options: RequestOptionsProps = {}): Promise<ApiResponse> {
    throw new Error('Method not implemented.')
  }

  delete (options: RequestOptionsProps = {}): Promise<ApiResponse> {
    throw new Error('Method not implemented.')
  }
}
