import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { User, UserProps } from '../models/User'
import { ApiAddress } from './ApiAddress'
import { ApiBaseInterface, ApiBase } from './ApiBase'
import { ApiDriverLocations } from './ApiDriverLocations'

interface CredentialsProps {
  email?: string
  cellphone?: string
  password?: string
}

interface ForgotProps {
  email?: string
}

interface ResetProps {
  code?: string
  random?: string
  password: string
}

interface FacebookProps {
  access_token?: string
}

interface GoogleProps {
  access_token?: string
}

interface LogoutProps {
  token_notification?: string
}

/**
 * Class to user api control
 */
export class ApiUser extends ApiBase implements ApiBaseInterface {
  private userId: number | null
  constructor (ordering: Ordering, userId: number | null = null) {
    super(ordering)
    this.userId = userId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.userId = id
  }

  /**
   * Get a user if userId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.userId && this.conditions) {
      throw new Error('The `where` function is not compatible with users(userId). Example ordering.users().where(contitions).get()')
    }
    const url = '/users' + (this.userId ? `/${this.userId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, User, options)
    return response
  }

  /**
   * Update a user if userId is set else create user
   * @param {UserProps} user Attributes to create or update user
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (user: UserProps, options: RequestOptionsProps = {}) {
    const url = '/users' + (this.userId ? `/${this.userId}` : '')
    const response: ApiResponse = await this.makeRequest('POST', url, user, User, options)
    const { content: { error, result } } = response
    if (!error && !this.userId) {
      this.userId = result.id
    }
    return response
  }

  /**
   * Delete a user by userId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.userId) {
      throw new Error('`userId` is require to delete. Example: ordering.users(userId).delete()')
    }
    const url = `/users/${this.userId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, User, options)
    return response
  }

  /**
   * Get session for a user
   * @param {CredentialsProps} credentials Email/cellphone and password
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async auth (credentials: CredentialsProps, options: RequestOptionsProps = {}) {
    const url = '/auth'
    const response: ApiResponse = await this.makeRequest('POST', url, credentials, User, options)
    const { content: { error, result } } = response
    if (!error) {
      this.userId = result.id
    }
    return response
  }

  /**
   * Close session for a user
   * @param {LogoutProps} logout token_notification to avoid send notification to this device
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async logout (logout: LogoutProps = {}, options: RequestOptionsProps = {}) {
    const url = '/auth/logout'
    const response: ApiResponse = await this.makeRequest('POST', url, logout, User, options)
    return response
  }

  /**
   * Send a email to reset the user password
   * @param {ForgotProps} forgot data to send data to reset password
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async forgotPassword (forgot: ForgotProps, options: RequestOptionsProps = {}) {
    const url = '/users/forgot'
    const response: ApiResponse = await this.makeRequest('POST', url, forgot, User, options)
    return response
  }

  /**
   * Change password with email data
   * @param {ResetProps} reset data to reset password
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async resetPassword (reset: ResetProps, options: RequestOptionsProps = {}) {
    const url = '/users/reset'
    const response: ApiResponse = await this.makeRequest('POST', url, reset, User, options)
    return response
  }

  /**
   * Login with Facebook
   * @param {FacebookProps} facebook access_token to login with Facebook
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async authFacebook (facebook: FacebookProps, options: RequestOptionsProps = {}) {
    const url = '/auth/facebook'
    const response: ApiResponse = await this.makeRequest('POST', url, facebook, User, options)
    const { content: { error, result } } = response
    if (!error) {
      this.userId = result.id
    }
    return response
  }

  /**
   * Login with Google
   * @param {GoogleProps} google access_token to login with Facebook
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async authGoogle (google: GoogleProps, options: RequestOptionsProps = {}) {
    const url = '/auth/google'
    const response: ApiResponse = await this.makeRequest('POST', url, google, User, options)
    const { content: { error, result } } = response
    if (!error) {
      this.userId = result.id
    }
    return response
  }

  /**
   * Return api alert a user by userId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  alerts () {
    if (!this.userId) {
      throw new Error('`userId` is require get alerts. Example: ordering.users(userId).alerts().get()')
    }
    return {
      get: async (options: RequestOptionsProps = {}) => {
        const url = `/users/${this.userId}/alerts`
        const response: ApiResponse = await this.makeRequest('GET', url, undefined, undefined, options)
        return response
      }
    }
  }

  /**
   * Return the api addresses
   * @param {number} addressId Address id is optional
   */
  addresses (addressId: number) {
    if (!this.userId) {
      throw new Error('`userId` is require to use API addresses. Example: ordering.users(userId).addresses().get()')
    }
    return new ApiAddress(this.ordering, this.userId, addressId)
  }

    /**
   * Return the api driver locations
   * @param {number} addressId Address id is optional
   */
  driverLocations()  {
    if (!this.userId) {
      throw new Error('`userId` is require to use API addresses. Example: ordering.users(userId).driverLocations().get()')
    }
    return new ApiDriverLocations(this.ordering, this.userId)
  }

}
