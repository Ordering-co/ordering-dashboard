import { Language, LanguageProps } from '../models/Language'
import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'

export class ApiLanguage extends ApiBase implements ApiBaseInterface {
  private languageId: number;

  constructor (ordering: Ordering, languageId: number) {
    super(ordering)
    this.languageId = languageId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.languageId = id
  }

  /**
   * Get a language if languageId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.languageId && this.conditions) {
      throw new Error('The `where` function is not compatible with languages(languageId). Example ordering.languages().where(contitions).get()')
    }
    const url = '/languages' + (this.languageId ? `/${this.languageId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Language, options)
    return response
  }

  /**
   * Update a language if languageId is set else create language
   * @param {LanguageProps} language Attributes to create or update language
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (language: LanguageProps, options: RequestOptionsProps = {}) {
    const url = '/languages' + (this.languageId ? `/${this.languageId}` : '')
    const response: ApiResponse = await this.makeRequest(!this.languageId ? 'POST' : 'PUT', url, language, Language, options)
    const { content: { error, result } } = response
    if (!error && !this.languageId) {
      this.languageId = result.id
    }
    return response
  }

  /**
   * Delete a language by languageId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.languageId) {
      throw new Error('`languageId` is require to delete. Example: ordering.languages(languageId).delete()')
    }
    const url = `/languages/${this.languageId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, Language, options)
    return response
  }
}
