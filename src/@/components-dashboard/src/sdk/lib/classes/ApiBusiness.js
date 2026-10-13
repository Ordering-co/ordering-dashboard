import { ApiBase } from './ApiBase'
import { Business } from '../models/Business'
import { ApiCategory } from './ApiCategory'
import { ApiMenu } from './ApiMenu'
import { ApiBusinessProduct } from './ApiBusinessProduct'
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
 * Class to configs api control
 */
const ApiBusiness = /** @class */ (function (_super) {
  __extends(ApiBusiness, _super)
  function ApiBusiness (ordering, businessId) {
    const _this = _super.call(this, ordering) || this
    _this.businessId = businessId
    return _this
  }
  /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
  ApiBusiness.prototype.setModelId = function (id) {
    this.businessId = id
  }
  /**
     * Get a business if businessId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiBusiness.prototype.get = function (options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            if (this.businessId && this.conditions) {
              throw new Error('The `where` function is not compatible with businesses(businessId). Example ordering.businesses().where(contitions).get()')
            }
            url = options.advancedSearch ? '/search' : ('/business' + (this.businessId ? '/' + this.businessId : ''))
            return [4 /* yield */, this.makeRequest('GET', url, undefined, Business, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error && !this.businessId) {
              this.businessId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Update a business if configId is set else create business
     * @param {BusinessProps} business Attributes to create or update business
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiBusiness.prototype.save = function (business, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            url = '/business' + (this.businessId ? '/' + this.businessId : '')
            return [4 /* yield */, this.makeRequest('POST', url, business, Business, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error && !this.businessId) {
              this.businessId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Delete a business by configId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiBusiness.prototype.delete = function (options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!this.businessId) {
              throw new Error('`businessId` is require to delete. Example: ordering.businesses(businessId).delete()')
            }
            url = '/business/' + this.businessId
            return [4 /* yield */, this.makeRequest('DELETE', url, undefined, null, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  ApiBusiness.prototype.validateCart = function (cart, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!this.businessId) {
              throw new Error('`businessId` is require to validateCart. Example: ordering.businesses(businessId).validateCart(cart)')
            }
            url = '/business/' + this.businessId + '/validate_cart'
            return [4 /* yield */, this.makeRequest('GET', url, cart, undefined, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Return products api
     */
  ApiBusiness.prototype.products = function () {
    if (!this.businessId) {
      throw new Error('`businessId` is require to products. Example: ordering.businesses(businessId).products().get()')
    }
    if (typeof this.businessId !== 'number') {
      throw new Error('`businessId` must be a number to use API menus. Example: ordering.businesses(businessId).products().get()')
    }
    return new ApiBusinessProduct(this.ordering, this.businessId)
    // return {
    //   get: async (options: RequestOptionsProps = {}) => {
    //     const url = `/business/${this.businessId}/products`
    //     const response: ApiResponse = await this.makeRequest('GET', url, undefined, Product, options)
    //     return response
    //   }
    // }
  }
  /**
     * Return categories api
     * @param {number} categoryId Category id is optional
     */
  ApiBusiness.prototype.categories = function (categoryId) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to use API categories. Example: ordering.businesses(businessId).categories().get()')
    }
    if (typeof this.businessId !== 'number') {
      throw new Error('`businessId` must be a number to use API categories. Example: ordering.businesses(businessId).categories().get()')
    }
    return new ApiCategory(this.ordering, this.businessId, categoryId)
  }
  /**
     * Return menus api
     * @param {number} menuId Menu id is optional
     */
  ApiBusiness.prototype.menus = function (menuId) {
    if (!this.businessId) {
      throw new Error('`businessId` is require to use API menus. Example: ordering.businesses(businessId).menus().get()')
    }
    if (typeof this.businessId !== 'number') {
      throw new Error('`businessId` must be a number to use API menus. Example: ordering.businesses(businessId).menus().get()')
    }
    return new ApiMenu(this.ordering, this.businessId, menuId)
  }
  return ApiBusiness
}(ApiBase))
export { ApiBusiness }
// # sourceMappingURL=ApiBusiness.js.map
