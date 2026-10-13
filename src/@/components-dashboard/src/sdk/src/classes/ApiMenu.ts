import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Menu, MenuProps } from '../models/Menu'

/**
 * Class to menu api control
 */
export class ApiMenu extends ApiBase implements ApiBaseInterface {
  public businessId: number
  public menuId: number | null

  constructor (ordering: Ordering, businessId: number, menuId: number | null = null) {
    super(ordering)
    this.ordering = ordering
    this.businessId = businessId
    this.menuId = menuId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.menuId = id
  }

  /**
   * Get a menu if menuId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('You must provide the `businessId` param. Example ordering.businesses(businessId).menus(menuId?).get()')
    }
    if (this.menuId && this.conditions) {
      throw new Error('The `where` function is not compatible with businesses(businessId).menus(menuId). Example ordering.businesses(businessId).menus().where(contitions).get()')
    }
    const url = `/business/${this.businessId}/menus` + (this.menuId ? `/${this.menuId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Menu, options)
    return response
  }

  /**
   * Update a menu if menuId is set else create menu
   * @param {MenuProps} menu Attributes to create or update menu
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (menu: MenuProps, options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('You must provide the `businessId` param. Example ordering.businesses(businessId).menus(menuId?).save(changes)')
    }
    const url = `/business/${this.businessId}/menus` + (this.menuId ? `/${this.menuId}` : '')
    const response: ApiResponse = await this.makeRequest(this.menuId ? 'PUT' : 'POST', url, menu, Menu, options)
    const { content: { error, result } } = response
    if (!error && !this.menuId) {
      this.menuId = result.id
    }
    return response
  }

  /**
   * Delete a menu by menuId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to delete. Example: ordering.businesses(businessId).menus(menuId).delete()')
    }
    if (!this.menuId) {
      throw new Error('`menuId` is require to delete. Example: ordering.businesses(businessId).menus(menuId).delete()')
    }

    const url = `/business/${this.businessId}/menus/${this.menuId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, Menu, options)
    return response
  }
}
