import { Address, AddressProps } from '../models/Address'
import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'

/**
 * Class to Address api control
 */
export class ApiAddress extends ApiBase implements ApiBaseInterface {
  public userId: number
  public addressId: number | null

  constructor (ordering: Ordering, userId: number, addressId: number | null = null) {
    super(ordering)
    this.ordering = ordering
    this.userId = userId
    this.addressId = addressId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.addressId = id
  }

  /**
   * Get an address if addressId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (!this.userId) {
      throw new Error('You must provide the `userId` param. Example ordering.users(userId).addresses(addressId?).get()')
    }
    if (this.addressId && this.conditions) {
      throw new Error('The `where` function is not compatible with users(userId).addresses(addressId). Example ordering.users(userId).addresses().where(contitions).get()')
    }
    const url = `/users/${this.userId}/addresses` + (this.addressId ? `/${this.addressId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Address, options)
    return response
  }

  /**
   * Update an address if addressId is set else create address
   * @param {AddressProps} address Attributes to create or update address
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (address: AddressProps, options: RequestOptionsProps = {}) {
    if (!this.userId) {
      throw new Error('You must provide the `userId` param. Example ordering.users(userId).addresses(addressId?).save(changes)')
    }
    const url = `/users/${this.userId}/addresses` + (this.addressId ? `/${this.addressId}` : '')
    const response: ApiResponse = await this.makeRequest(!this.addressId ? 'POST' : 'PUT', url, address, Address, options)
    const { content: { error, result } } = response
    if (!error && !this.addressId) {
      this.addressId = result.id
    }
    return response
  }

  /**
   * Delete an address by addressId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.userId) {
      throw new Error('`userId` is require to delete. Example: ordering.users(userId).addresses(addressId).delete()')
    }
    if (!this.addressId) {
      throw new Error('`addressId` is require to delete. Example: ordering.users(userId).addresses(addressId).delete()')
    }

    const url = `/users/${this.userId}/addresses/${this.addressId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, Address, options)
    return response
  }
}
