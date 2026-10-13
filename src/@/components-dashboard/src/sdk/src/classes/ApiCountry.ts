import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Country, CountryProps } from '../models/Country'
import { ApiCity } from './ApiCity'

/**
 * Class to countries api control
 */
export class ApiCountry extends ApiBase implements ApiBaseInterface {
  private countryId: number

  constructor (ordering: Ordering, countryId: number) {
    super(ordering)
    this.countryId = countryId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.countryId = id
  }

  /**
   * Get a country if countryId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.countryId && this.conditions) {
      throw new Error('The `where` function is not compatible with countries(countryId). Example ordering.countries().where(contitions).get()')
    }
    const url = '/countries' + (this.countryId ? `/${this.countryId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Country, options)
    return response
  }

  /**
   * Update a country if countryId is set else create country
   * @param {CountryProps} country Attributes to create or update country
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (country: CountryProps, options: RequestOptionsProps = {}) {
    const url = '/countries' + (this.countryId ? `/${this.countryId}` : '')
    const response: ApiResponse = await this.makeRequest(this.countryId ? 'PUT' : 'POST', url, country, Country, options)
    const { content: { error, result } } = response
    if (!error && !this.countryId) {
      this.countryId = result.id
    }
    return response
  }

  /**
   * Delete a country by countryId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.countryId) {
      throw new Error('`countryId` is require to delete. Example: ordering.countries(countryId).delete()')
    }
    const url = `/countries/${this.countryId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, null, options)
    return response
  }

  /**
   * Return cities api
   * @param {number} cityId City id is optional
   */
  cities (cityId: number) {
    if (!this.countryId) {
      throw new Error('`countryId` is require to use API cities. Example: ordering.countries(countryId).cities().get()')
    }
    return new ApiCity(this.ordering, this.countryId, cityId)
  }
}
