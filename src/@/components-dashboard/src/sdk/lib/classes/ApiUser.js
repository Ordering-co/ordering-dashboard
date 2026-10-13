import { User } from '../models/User'
import { ApiAddress } from './ApiAddress'
import { ApiBase } from './ApiBase'
import { ApiDriverLocations } from './ApiDriverLocations'
const __extends = (this && this.__extends) || (function () {
  let extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b }) ||
            function (d, b) { for (const p in b) if (b.hasOwnProperty(p)) d[p] = b[p] }
    return extendStatics(d, b)
  }
  return function (d, b) {
    extendStatics(d, b)
    function __ () { this.constructor = d }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __())
  }
})()
const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt (value) { return value instanceof P ? value : new P(function (resolve) { resolve(value) }) }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled (value) { try { step(generator.next(value)) } catch (e) { reject(e) } }
    function rejected (value) { try { step(generator.throw(value)) } catch (e) { reject(e) } }
    function step (result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected) }
    step((generator = generator.apply(thisArg, _arguments || [])).next())
  })
}
const __generator = (this && this.__generator) || function (thisArg, body) {
  let _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1] }, trys: [], ops: [] }; let f; let y; let t; let g
  return g = { next: verb(0), throw: verb(1), return: verb(2) }, typeof Symbol === 'function' && (g[Symbol.iterator] = function () { return this }), g
  function verb (n) { return function (v) { return step([n, v]) } }
  function step (op) {
    if (f) throw new TypeError('Generator is already executing.')
    while (_) {
      try {
        if (f = 1, y && (t = op[0] & 2 ? y.return : op[0] ? y.throw || ((t = y.return) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t
        if (y = 0, t) op = [op[0] & 2, t.value]
        switch (op[0]) {
          case 0: case 1: t = op; break
          case 4: _.label++; return { value: op[1], done: false }
          case 5: _.label++; y = op[1]; op = [0]; continue
          case 7: op = _.ops.pop(); _.trys.pop(); continue
          default:
            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue }
            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break }
            if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break }
            if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break }
            if (t[2]) _.ops.pop()
            _.trys.pop(); continue
        }
        op = body.call(thisArg, _)
      } catch (e) { op = [6, e]; y = 0 } finally { f = t = 0 }
    }
    if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true }
  }
}
/**
 * Class to user api control
 */
const ApiUser = /** @class */ (function (_super) {
  __extends(ApiUser, _super)
  function ApiUser (ordering, userId) {
    if (userId === void 0) { userId = null }
    const _this = _super.call(this, ordering) || this
    _this.userId = userId
    return _this
  }
  /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
  ApiUser.prototype.setModelId = function (id) {
    this.userId = id
  }
  /**
     * Get a user if userId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.get = function (options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (this.userId && this.conditions) {
              throw new Error('The `where` function is not compatible with users(userId). Example ordering.users().where(contitions).get()')
            }
            url = '/users' + (this.userId ? '/' + this.userId : '')
            return [4 /* yield */, this.makeRequest('GET', url, undefined, User, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Update a user if userId is set else create user
     * @param {UserProps} user Attributes to create or update user
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.save = function (user, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            url = '/users' + (this.userId ? '/' + this.userId : '')
            return [4 /* yield */, this.makeRequest('POST', url, user, User, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error && !this.userId) {
              this.userId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Delete a user by userId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.delete = function (options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!this.userId) {
              throw new Error('`userId` is require to delete. Example: ordering.users(userId).delete()')
            }
            url = '/users/' + this.userId
            return [4 /* yield */, this.makeRequest('DELETE', url, undefined, User, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Get session for a user
     * @param {CredentialsProps} credentials Email/cellphone and password
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.auth = function (credentials, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            url = '/auth'
            return [4 /* yield */, this.makeRequest('POST', url, credentials, User, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error) {
              this.userId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Close session for a user
     * @param {LogoutProps} logout token_notification to avoid send notification to this device
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.logout = function (logout, options) {
    if (logout === void 0) { logout = {} }
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            url = '/auth/logout'
            return [4 /* yield */, this.makeRequest('POST', url, logout, User, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Send a email to reset the user password
     * @param {ForgotProps} forgot data to send data to reset password
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.forgotPassword = function (forgot, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            url = '/users/forgot'
            return [4 /* yield */, this.makeRequest('POST', url, forgot, User, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Change password with email data
     * @param {ResetProps} reset data to reset password
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.resetPassword = function (reset, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            url = '/users/reset'
            return [4 /* yield */, this.makeRequest('POST', url, reset, User, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Login with Facebook
     * @param {FacebookProps} facebook access_token to login with Facebook
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.authFacebook = function (facebook, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            url = '/auth/facebook'
            return [4 /* yield */, this.makeRequest('POST', url, facebook, User, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error) {
              this.userId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Login with Google
     * @param {GoogleProps} google access_token to login with Facebook
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.authGoogle = function (google, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            url = '/auth/google'
            return [4 /* yield */, this.makeRequest('POST', url, google, User, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error) {
              this.userId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Return api alert a user by userId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiUser.prototype.alerts = function () {
    const _this = this
    if (!this.userId) {
      throw new Error('`userId` is require get alerts. Example: ordering.users(userId).alerts().get()')
    }
    return {
      get: function (options) {
        if (options === void 0) { options = {} }
        return __awaiter(_this, void 0, void 0, function () {
          let url, response
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                url = '/users/' + this.userId + '/alerts'
                return [4 /* yield */, this.makeRequest('GET', url, undefined, undefined, options)]
              case 1:
                response = _a.sent()
                return [2 /* return */, response]
            }
          })
        })
      }
    }
  }
  /**
     * Return the api addresses
     * @param {number} addressId Address id is optional
     */
  ApiUser.prototype.addresses = function (addressId) {
    if (!this.userId) {
      throw new Error('`userId` is require to use API addresses. Example: ordering.users(userId).addresses().get()')
    }
    return new ApiAddress(this.ordering, this.userId, addressId)
  }
  /**
   * Return the api driver locations
   * @param {number} addressId Address id is optional
   */
  ApiUser.prototype.driverLocations = function () {
    if (!this.userId) {
      throw new Error('`userId` is require to use API addresses. Example: ordering.users(userId).driverLocations().get()')
    }
    return new ApiDriverLocations(this.ordering, this.userId)
  }
  return ApiUser
}(ApiBase))
export { ApiUser }
// # sourceMappingURL=ApiUser.js.map
