import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { OrderOption, OrderOptionProps } from '../models/OrderOption'

/**
 * Class to order option api control
 */
export class ApiOrderOption extends ApiBase implements ApiBaseInterface {
  private orderOptionId: number

  constructor (ordering: Ordering, orderOptionId: number) {
    super(ordering)
    this.orderOptionId = orderOptionId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.orderOptionId = id
  }

  /**
   * Get a order options if orderOptionId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.orderOptionId) {
      throw new Error('ordering.orderOptions(orderOptionId).get() is not implemented')
    }
    if (this.orderOptionId && this.conditions) {
      throw new Error('The `where` function is not compatible with countries(orderOptionId). Example ordering.orderOptions().where(contitions).get()')
    }
    const url = '/order_options'
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, OrderOption, options)
    return response
  }

  /**
   * Update a order options if orderOptionId is set
   * @param {OrderOptionProps} orderOption Attributes to update order options
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (orderOption: OrderOptionProps, options: RequestOptionsProps = {}) {
    const url = '/order_options'
    const response: ApiResponse = await this.makeRequest('PUT', url, orderOption, OrderOption, options)
    const { content: { error, result } } = response
    if (!error && !this.orderOptionId) {
      this.orderOptionId = result.id
    }
    return response
  }

  /**
   * Delete a country by orderOptionId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (this.orderOptionId || !this.orderOptionId) {
      throw new Error('ordering.orderOptions(orderOptionId).delete() is not implemented.')
    }
    const url = `/order_options/${this.orderOptionId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, null, options)
    return response
  }
}
