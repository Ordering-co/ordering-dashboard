import { Language } from '../models/Language'
import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';

interface DataGetCode {
  email?: string,
  code?: string
}

export class ApiSystem {
  private ordering: Ordering;
  constructor (ordering: Ordering) {
    this.ordering = ordering
  }

  async auth (data: DataGetCode, options: RequestOptionsProps = { json: true, system: true }) {
    const response: ApiResponse = await this.ordering.post('/system/auth', data, options)
    return response
  }

  async getCode (data: DataGetCode, options: RequestOptionsProps = { json: true, system: true }) {
    const response: ApiResponse = await this.ordering.post('/system/code', data, options)
    return response
  }
}