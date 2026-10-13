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
const ApiBase = /** @class */ (function () {
  function ApiBase (ordering) {
    this.attributes = []
    this.query = {}
    this.ordering = ordering
  }
  /**
     * Select the attributes to get from Ordering API
     * @param attributes List of attributes
     */
  ApiBase.prototype.select = function (attributes) {
    this.attributes = attributes
    return this
  }
  /**
     * Conditions to get from Ordering API
     * @param conditions List of conditions
     */
  ApiBase.prototype.where = function (conditions) {
    this.conditions = conditions
    return this
  }
  /**
     * Change request mode
     * @param mode Request mode
     */
  ApiBase.prototype.setMode = function (mode) {
    this.mode = mode
    return this
  }
  /**
     * Change request mode to dashboard
     */
  ApiBase.prototype.asDashboard = function () {
    this.setMode('dashboard')
    return this
  }
  /**
     * Change request mode to dashboard
     */
  ApiBase.prototype.asDictionary = function () {
    this.setMode('dictionary')
    return this
  }
  /**
     * Change request mode to dashboard
     */
  ApiBase.prototype.parameters = function (parameters) {
    this.query = Object.assign(this.query, parameters)
    return this
  }
  /**
     * Make request by options
     * @param method HTTP method
     */
  ApiBase.prototype.makeRequest = function (method, url, data, model, options) {
    return __awaiter(this, void 0, void 0, function () {
      let _options, key, _a
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            _options = Object.assign({ CastClass: model, json: true, api: this }, options)
            if (method === 'GET') {
              _options.attributes = this.attributes
              _options.conditions = this.conditions
              _options.mode = this.mode
              if (!_options.query) {
                _options.query = {}
              }
              Object.assign(_options.query, this.query)
              if (data) {
                for (key in data) {
                  _options.query[key] = data[key]
                }
              }
            }
            _a = method
            switch (_a) {
              case 'GET': return [3 /* break */, 1]
              case 'POST': return [3 /* break */, 3]
              case 'PUT': return [3 /* break */, 5]
              case 'DELETE': return [3 /* break */, 7]
            }
            return [3 /* break */, 9]
          case 1: return [4 /* yield */, this.ordering.get(url, _options)]
          case 2: return [2 /* return */, _b.sent()]
          case 3: return [4 /* yield */, this.ordering.post(url, data, _options)]
          case 4: return [2 /* return */, _b.sent()]
          case 5: return [4 /* yield */, this.ordering.put(url, data, _options)]
          case 6: return [2 /* return */, _b.sent()]
          case 7: return [4 /* yield */, this.ordering.delete(url, _options)]
          case 8: return [2 /* return */, _b.sent()]
          case 9: throw Error('The `' + method + '` methos is not supported.')
        }
      })
    })
  }
  return ApiBase
}())
export { ApiBase }
// # sourceMappingURL=ApiBase.js.map
