import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ValidationField, ValidationFieldProps } from '../models/ValidationField'
import { ApiBase, ApiBaseInterface } from './ApiBase'

export class ApiValidationField extends ApiBase implements ApiBaseInterface {
  public fieldId: number
  constructor (ordering: Ordering, fieldId: number) {
    super(ordering)
    this.fieldId = fieldId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.fieldId = id
  }

  /**
   * Get a validation field if fieldId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.fieldId && this.conditions) {
      throw new Error('The `where` function is not compatible with validationFields(fieldId). Example ordering.validationFields().where(contitions).get()')
    }
    const url = '/validationfields' + (this.fieldId ? `/${this.fieldId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, ValidationField, options)
    return response
  }

  /**
   * Update a validation field if fieldId is set else create validation fiel
   * @param {ValidationFieldProps} validationField Attributes to create or update validation field
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (validationField: ValidationFieldProps, options: RequestOptionsProps = {}) {
    const url = '/validationfields' + (this.fieldId ? `/${this.fieldId}` : '')
    const response: ApiResponse = await this.makeRequest(!this.fieldId ? 'POST' : 'PUT', url, validationField, ValidationField, options)
    const { content: { error, result } } = response
    if (!error && !this.fieldId) {
      this.fieldId = result.id
    }
    return response
  }

  /**
   * Delete a validation field by fieldId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.fieldId) {
      throw new Error('`fieldId` is require to delete. Example: ordering.validationFields(fieldId).delete()')
    }
    const url = `/validationfields/${this.fieldId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, ValidationField, options)
    return response
  }

  /**
   * Get only fields for custom
   */
  toType (type: string) {
    this.conditions = [{
      attribute: 'validate',
      value: type
    }]
    return this
  }

  /**
   * Get only fields for checkout
   */
  toCheckout () {
    return this.toType('checkout')
  }

  /**
   * Get only fields for address
   */
  toAddress () {
    return this.toType('address')
  }
}
