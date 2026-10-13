import { Model, ModelProps } from './Model'
import { Address } from './Address'
import { TypeApi } from '../types'

export interface SessionProps {
  access_token?: string
  expires_in?: number
  token_type?: string
}

export class Session {
  public access_token: string
  public expires_in: number
  public token_type: string

  constructor (session: SessionProps = {}) {
    this.access_token = session.access_token || ''
    this.expires_in = session.expires_in || 0
    this.token_type = session.token_type || ''
  }
}

export interface UserProps {
  id?: number
  name?: string
  middle_name?: string
  lastname?: string
  second_lastname?: string
  email?: string
  password?: string
  login_type?: number
  social_id?: string
  photo?: string
  birthdate?: string
  phone?:string
  cellphone?: string
  country_phone_code?: string
  city_id?: number
  dropdown_option_id?: number
  address?: string
  address_notes?: string
  zipcode?: string
  location?: any
  push_notifications?: boolean
  level?: number
  language_id?: number
  busy?: boolean
  available?: boolean
  map_data?: string
  enabled?: boolean
  session?: Session
  addresses?: Address[]
  [metadata: string]: any
}

export class User extends Model implements ModelProps {
  public id: number
  public name: string
  public middle_name: string
  public lastname: string
  public second_lastname: string
  public email: string
  public password: string
  public login_type: number
  public social_id: string
  public photo: string
  public birthdate: string
  public phone:string
  public cellphone: string
  public country_phone_code: string
  public city_id: number
  public dropdown_option_id: number
  public address: string
  public address_notes: string
  public zipcode: string
  public location: any
  public push_notifications: boolean
  public level: number
  public language_id: number
  public busy: boolean
  public available: boolean
  public map_data: string
  public enabled: boolean
  public addresses: Address[]
  public session: Session
  [metadata: string]: any

  constructor (user: UserProps = {}, api: TypeApi) {
    super(user, api, ['session', 'addresses'])
    Object.entries(user).map(([key, value]) => {
      this[key] = value
    })
    if (user.session) {
      this.session = new Session(user.session)
    }
  }

  public isAdministrator () {
    return this.level === 0
  }

  public isDriver () {
    return this.level === 4
  }

  public isBusinessOwner () {
    return this.level === 2
  }

  public isCustomer () {
    return this.level === 3
  }

  public getAccessToken () {
    return this.session?.access_token
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }
}
