import { TypeApi } from '../types'
import { ConditionInterface } from '../classes/ApiBase'

export interface RequestOptionsBusinessProps {
  CastClass?: any
  json?: boolean
  project?: string
  language?: string,
  system?: boolean,
  headers?: object,
  accessToken?: string,
  query?: any,
  attributes?: string[]
  api?: TypeApi
  conditions?: ConditionInterface[]
  mode?: string,
  advancedSearch?: boolean
}
