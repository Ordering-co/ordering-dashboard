import { ValidationField } from '../models/ValidationField'
import { ApiBase } from './ApiBase'
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
const ApiValidationField = /** @class */ (function (_super) {
  __extends(ApiValidationField, _super)
  function ApiValidationField (ordering, fieldId) {
    const _this = _super.call(this, ordering) || this
    _this.fieldId = fieldId
    return _this
  }
  /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
  ApiValidationField.prototype.setModelId = function (id) {
    this.fieldId = id
  }
  /**
     * Get a validation field if fieldId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiValidationField.prototype.get = function (options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (this.fieldId && this.conditions) {
              throw new Error('The `where` function is not compatible with validationFields(fieldId). Example ordering.validationFields().where(contitions).get()')
            }
            url = '/validationfields' + (this.fieldId ? '/' + this.fieldId : '')
            return [4 /* yield */, this.makeRequest('GET', url, undefined, ValidationField, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Update a validation field if fieldId is set else create validation fiel
     * @param {ValidationFieldProps} validationField Attributes to create or update validation field
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiValidationField.prototype.save = function (validationField, options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response, _a, error, result
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            url = '/validationfields' + (this.fieldId ? '/' + this.fieldId : '')
            return [4 /* yield */, this.makeRequest(!this.fieldId ? 'POST' : 'PUT', url, validationField, ValidationField, options)]
          case 1:
            response = _b.sent()
            _a = response.content, error = _a.error, result = _a.result
            if (!error && !this.fieldId) {
              this.fieldId = result.id
            }
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Delete a validation field by fieldId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
  ApiValidationField.prototype.delete = function (options) {
    if (options === void 0) { options = {} }
    return __awaiter(this, void 0, void 0, function () {
      let url, response
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!this.fieldId) {
              throw new Error('`fieldId` is require to delete. Example: ordering.validationFields(fieldId).delete()')
            }
            url = '/validationfields/' + this.fieldId
            return [4 /* yield */, this.makeRequest('DELETE', url, undefined, ValidationField, options)]
          case 1:
            response = _a.sent()
            return [2 /* return */, response]
        }
      })
    })
  }
  /**
     * Get only fields for custom
     */
  ApiValidationField.prototype.toType = function (type) {
    this.conditions = [{
      attribute: 'validate',
      value: type
    }]
    return this
  }
  /**
     * Get only fields for checkout
     */
  ApiValidationField.prototype.toCheckout = function () {
    return this.toType('checkout')
  }
  /**
     * Get only fields for address
     */
  ApiValidationField.prototype.toAddress = function () {
    return this.toType('address')
  }
  return ApiValidationField
}(ApiBase))
export { ApiValidationField }
// # sourceMappingURL=ApiValidationField.js.map
