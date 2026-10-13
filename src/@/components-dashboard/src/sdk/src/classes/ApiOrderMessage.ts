import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { ApiProduct } from './ApiProduct'
import { OrderMessage, OrderMessageProps } from '../models/OrderMessage'

/**
 * Class to order message api control
 */
export class ApiOrderMessage extends ApiBase implements ApiBaseInterface {
  public orderId: number
  public messageId: number | null

  constructor (ordering: Ordering, orderId: number, messageId: number | null = null) {
    super(ordering)
    this.ordering = ordering
    this.orderId = orderId
    this.messageId = messageId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.messageId = id
  }

  /**
   * Get a order message if messageId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (!this.orderId) {
      throw new Error('You must provide the `orderId` param. Example ordering.orders(orderId).messages(messageId?).get()')
    }
    if (this.messageId && this.conditions) {
      throw new Error('The `where` function is not compatible with businesses(orderId).messages(messageId). Example ordering.orders(orderId).messages().where(contitions).get()')
    }
    const url = `/orders/${this.orderId}/messages` + (this.messageId ? `/${this.messageId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, OrderMessage, options)
    return response
  }

  /**
   * Update a order message if messageId is set else create order message
   * @param {OrderMessageProps} order message Attributes to create or update order message
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (orderMessage: OrderMessageProps, options: RequestOptionsProps = {}) {
    if (!this.orderId) {
      throw new Error('You must provide the `orderId` param. Example ordering.orders(orderId).messages(messageId?).save(changes)')
    }
    if (!this.messageId) {
      throw new Error('ordering.orders(orderId).messages(messageId).save(changes) is not implemented.')
    }
    const url = `/orders/${this.orderId}/messages` + (this.messageId ? `/${this.messageId}` : '')
    const response: ApiResponse = await this.makeRequest('POST', url, orderMessage, OrderMessage, options)
    const { content: { error, result } } = response
    if (!error && !this.messageId) {
      this.messageId = result.id
    }
    return response
  }

  /**
   * Delete a order message by messageId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.orderId) {
      throw new Error('ordering.orders(orderId).messages(messageId).delete() is not implemented.')
    }
    if (!this.messageId) {
      throw new Error('ordering.orders(orderId).messages(messageId).delete() is not implemented.')
    }

    const url = `/orders/${this.orderId}/messages/${this.messageId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, OrderMessage, options)
    return response
  }
}
