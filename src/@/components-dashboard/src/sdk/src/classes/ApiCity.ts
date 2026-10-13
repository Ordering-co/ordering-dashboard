import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { City, CityProps } from '../models/City'

/**
 * Class to city api control
 */
export class ApiCity extends ApiBase implements ApiBaseInterface {
  public countryId: number
  public cityId: number | null

  constructor (ordering: Ordering, countryId: number, cityId: number | null = null) {
    super(ordering)
    this.ordering = ordering
    this.countryId = countryId
    this.cityId = cityId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.cityId = id
  }

  /**
   * Get a city if cityId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (!this.countryId) {
      throw new Error('You must provide the `countryId` param. Example ordering.countries(countryId).cities(cityId?).get()')
    }
    if (this.cityId && this.conditions) {
      throw new Error('The `where` function is not compatible with countries(countryId).cities(cityId). Example ordering.countries(countryId).cities().where(contitions).get()')
    }
    const url = `/countries/${this.countryId}/cities` + (this.cityId ? `/${this.cityId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, City, options)
    return response
  }

  /**
   * Update a city if cityId is set else create city
   * @param {CityProps} city Attributes to create or update city
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (city: CityProps, options: RequestOptionsProps = {}) {
    if (!this.countryId) {
      throw new Error('You must provide the `countryId` param. Example ordering.countries(countryId).cities(cityId?).save(changes)')
    }
    const url = `/countries/${this.countryId}/cities` + (this.cityId ? `/${this.cityId}` : '')
    const response: ApiResponse = await this.makeRequest(this.cityId ? 'PUT' : 'POST', url, city, City, options)
    const { content: { error, result } } = response
    if (!error && !this.cityId) {
      this.cityId = result.id
    }
    return response
  }

  /**
   * Delete a city by cityId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.countryId) {
      throw new Error('`countryId` is require to delete. Example: ordering.countries(countryId).cities(cityId).delete()')
    }
    if (!this.cityId) {
      throw new Error('`cityId` is require to delete. Example: ordering.countries(countryId).cities(cityId).delete()')
    }

    const url = `/countries/${this.countryId}/cities/${this.cityId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, undefined, options)
    return response
  }
}
