import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { Order, OrderProps } from '../models/Order'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { ApiOrderMessage } from './ApiOrderMessage'

/**
 * Class to orders api control
 */
export class ApiOrder extends ApiBase implements ApiBaseInterface {
  private orderId: number | string | null

  constructor (ordering: Ordering, orderId: number | string | null) {
    super(ordering)
    this.orderId = orderId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.orderId = id
  }

  /**
   * Get an order if orderId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.orderId && this.conditions) {
      throw new Error('The `where` function is not compatible with orders(orderId). Example ordering.orders().where(contitions).get()')
    }
    const url = '/orders' + (this.orderId ? `/${this.orderId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Order, options)
    return response
  }

  /**
   * Update an order if orderId is set else create order
   * @param {OrderProps} order Attributes to create or update order
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (order: OrderProps, options: RequestOptionsProps = {}) {
    const url = '/orders' + (this.orderId ? `/${this.orderId}` : '')
    const response: ApiResponse = await this.makeRequest(this.orderId ? 'PUT' : 'POST', url, order, Order, options)
    const { content: { error, result } } = response
    if (!error && !this.orderId) {
      this.orderId = result.id
    }
    return response
  }

  /**
   * Delete an order by orderId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.orderId) {
      throw new Error('`orderId` is require to delete. Example: ordering.orders(orderId).delete()')
    }
    const url = `/orders/${this.orderId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, Order, options)
    return response
  }

  /**
   * Get order summary
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async summary (options: RequestOptionsProps = {}) {
    if (this.orderId) {
      throw new Error('`orderId` is NOT require to summary API. Example: ordering.orders().summary()')
    }
    const url = '/orders/dashboard'
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, undefined, options)
    return response
  }

  /**
   * Return messages api
   * @param {number} orderId Order id is optional
   */
  messages (messagesId: number) {
    if (!this.orderId) {
      throw new Error('`orderId` is require to use API messages. Example: ordering.orders(orderId).messages().get()')
    }
    if (typeof this.orderId !== 'number') {
      throw new Error('`orderId` must be a number to use API messages. Example: ordering.orders(orderId).messages().get()')
    }
    return new ApiOrderMessage(this.ordering, this.orderId, messagesId)
  }

  /**
   * Reorder an order by orderId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async reorder (options: RequestOptionsProps = {}) {
    if (!this.orderId) {
      throw new Error('`orderId` is require to delete. Example: ordering.orders(orderId).reorder()')
    }
    const url = `/orders/${this.orderId}/reorder`
    const response: ApiResponse = await this.makeRequest('POST', url, undefined, undefined, options)
    return response
  }
}
